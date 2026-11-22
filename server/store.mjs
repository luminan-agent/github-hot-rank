/**
 * 快照库：SQLite（Node 22 内置 node:sqlite，零外部依赖）。
 *
 * 为什么 SQLite：单机起步够用，备份就是拷一个文件；Postgres 要额外部署，
 * 而这个服务的写入量是「每小时几百行」，远没到需要 PG 的量级。
 * 迁 PG 时只需替换本文件。
 *
 * 表结构：
 *   snapshots(date, collected_at)                     —— 每日快照批次的元信息
 *   repo_stars(date, full_name, stars, forks, ...)     —— 每仓每天的 star 数
 *   trending(date, lang, window, full_name, ...)       —— 每次 Trending 抓取的条目
 *   mutations(date, full_name, delta1, avg_prev)       —— 突变事件（可回溯）
 *
 * 幂等：同一天重复采集用 REPLACE 覆盖，不追加重复行。
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export class SnapshotStore {
  /** @param {string} file  数据库文件路径；':memory:' 用于测试 */
  constructor(file) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true })
    this.db = new DatabaseSync(file)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.#migrate()
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        date         TEXT PRIMARY KEY,
        collected_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS repo_stars (
        date      TEXT NOT NULL,
        full_name TEXT NOT NULL,
        stars     INTEGER NOT NULL,
        forks     INTEGER,
        issues    INTEGER,
        pushed_at TEXT,
        archived  INTEGER,
        PRIMARY KEY (date, full_name)
      );
      CREATE INDEX IF NOT EXISTS idx_repo_stars_name ON repo_stars(full_name, date);
      CREATE TABLE IF NOT EXISTS trending (
        date       TEXT NOT NULL,
        lang       TEXT NOT NULL,
        window     TEXT NOT NULL,
        full_name  TEXT NOT NULL,
        url        TEXT,
        description TEXT,
        language   TEXT,
        stars_in_window INTEGER,
        total_stars INTEGER,
        PRIMARY KEY (date, lang, window, full_name)
      );
      CREATE INDEX IF NOT EXISTS idx_trending_lookup ON trending(window, lang, date DESC);
      CREATE TABLE IF NOT EXISTS mutations (
        date      TEXT NOT NULL,
        full_name TEXT NOT NULL,
        delta1    INTEGER NOT NULL,
        avg_prev  REAL NOT NULL,
        stars     INTEGER,
        PRIMARY KEY (date, full_name)
      );
    `)
  }

  /** 记一次快照批次。 */
  recordSnapshotBatch(date, collectedAt) {
    this.db
      .prepare('INSERT INTO snapshots(date, collected_at) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET collected_at = excluded.collected_at')
      .run(date, collectedAt)
  }

  /**
   * 写入一批仓库 star 数据（同日期覆盖）。
   * @param {string} date
   * @param {Record<string, {stars:number,forks?:number,issues?:number,pushedAt?:string,archived?:boolean}>} repos
   */
  saveRepoStars(date, repos) {
    const stmt = this.db.prepare(`
      INSERT INTO repo_stars(date, full_name, stars, forks, issues, pushed_at, archived)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, full_name) DO UPDATE SET
        stars = excluded.stars, forks = excluded.forks, issues = excluded.issues,
        pushed_at = excluded.pushed_at, archived = excluded.archived
    `)
    for (const [full, d] of Object.entries(repos)) {
      stmt.run(date, full, d.stars, d.forks ?? null, d.issues ?? null, d.pushedAt ?? null, d.archived ? 1 : 0)
    }
  }

  /**
   * 写入一批 Trending 条目（同日期/语言/窗口/仓库覆盖）。
   * @param {string} date
   * @param {string} lang
   * @param {string} window
   * @param {Array<{fullName:string,url?:string,description?:string,language?:string,starsInWindow?:number,totalStars?:number}>} items
   */
  saveTrending(date, lang, window, items) {
    const stmt = this.db.prepare(`
      INSERT INTO trending(date, lang, window, full_name, url, description, language, stars_in_window, total_stars)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, lang, window, full_name) DO UPDATE SET
        url = excluded.url, description = excluded.description, language = excluded.language,
        stars_in_window = excluded.stars_in_window, total_stars = excluded.total_stars
    `)
    for (const it of items) {
      stmt.run(date, lang, window, it.fullName, it.url ?? null, it.description ?? null, it.language ?? null, it.starsInWindow ?? 0, it.totalStars ?? 0)
    }
  }

  /** 记一次突变事件。 */
  saveMutation(date, fullName, delta1, avgPrev, stars) {
    this.db
      .prepare('INSERT INTO mutations(date, full_name, delta1, avg_prev, stars) VALUES (?, ?, ?, ?, ?) ON CONFLICT(date, full_name) DO UPDATE SET delta1 = excluded.delta1, avg_prev = excluded.avg_prev, stars = excluded.stars')
      .run(date, fullName, delta1, avgPrev, stars ?? null)
  }

  /** 某天的仓库快照 → shared/growth.mjs 认的 Snapshot 结构。 */
  snapshotFor(date) {
    const rows = this.db.prepare('SELECT full_name, stars FROM repo_stars WHERE date = ?').all(date)
    const repos = {}
    for (const r of rows) repos[r.full_name] = { stars: Number(r.stars) }
    return { date, repos }
  }

  /** 按日期升序的全部仓库快照（差分用）。 */
  allRepoSnapshots() {
    const dates = this.db.prepare('SELECT DISTINCT date FROM repo_stars ORDER BY date').all().map((r) => r.date)
    return dates.map((d) => this.snapshotFor(d))
  }

  /** 最近 n 份快照（差分用）。 */
  recentRepoSnapshots(limit = 30) {
    const dates = this.db
      .prepare('SELECT DISTINCT date FROM repo_stars ORDER BY date DESC LIMIT ?')
      .all(limit)
      .map((r) => r.date)
    return dates.sort().map((d) => this.snapshotFor(d))
  }

  /** 某仓的按日 star 序列（升序）。 */
  repoStarSeries(fullName, limit = 30) {
    return this.db
      .prepare('SELECT date, stars FROM repo_stars WHERE full_name = ? ORDER BY date DESC LIMIT ?')
      .all(fullName, limit)
      .reverse()
      .map((r) => ({ date: r.date, stars: Number(r.stars) }))
  }

  /**
   * 取某窗口某语言的 Trending 条目（取最新一份抓取）。
   * @param {string} window daily|weekly|monthly
   * @param {string} lang  空串表示不限语言
   */
  trendingFor(window, lang) {
    const date = this.db
      .prepare(
        `SELECT date FROM trending WHERE window = ? AND (? = '' OR lang = ?) ORDER BY date DESC LIMIT 1`,
      )
      .get(window, lang, lang)
    if (!date) return { date: null, items: [] }
    const rows = this.db
      .prepare('SELECT full_name, url, description, language, stars_in_window, total_stars FROM trending WHERE date = ? AND window = ? AND (? = \'\' OR lang = ?) ORDER BY stars_in_window DESC')
      .all(date.date, window, lang, lang)
    return {
      date: date.date,
      items: rows.map((r) => ({
        fullName: r.full_name,
        url: r.url ?? `https://github.com/${r.full_name}`,
        description: r.description ?? '',
        language: r.language ?? '',
        starsInWindow: Number(r.stars_in_window ?? 0),
        totalStars: Number(r.total_stars ?? 0),
      })),
    }
  }

  /** 最近一次突变事件（可选按时间窗过滤）。 */
  recentMutations(sinceDate) {
    const rows = sinceDate
      ? this.db.prepare('SELECT date, full_name, delta1, avg_prev, stars FROM mutations WHERE date >= ? ORDER BY date DESC, delta1 DESC').all(sinceDate)
      : this.db.prepare('SELECT date, full_name, delta1, avg_prev, stars FROM mutations ORDER BY date DESC, delta1 DESC LIMIT 50').all()
    return rows.map((r) => ({
      date: r.date,
      fullName: r.full_name,
      delta1: Number(r.delta1),
      avgPrev: Number(r.avg_prev),
      stars: r.stars === null ? null : Number(r.stars),
    }))
  }

  /** 库里已有的快照日期（升序）。 */
  snapshotDates() {
    return this.db.prepare('SELECT DISTINCT date FROM repo_stars ORDER BY date').all().map((r) => r.date)
  }

  close() {
    this.db.close()
  }
}
