/**
 * 服务端采集器：每小时拉 Trending HTML + 追踪仓 REST stars，落快照库。
 *
 * 为什么放服务端（而不是每个用户本地采）：
 *   插件市场形态下，每个用户本地采集只能看到自己攒的数据 —— 冷启动无榜单可看。
 *   服务端持续采集，所有用户共享同一份榜单快照。
 *
 * 复用现有能力：
 *   · scripts/collect.mjs —— 追踪仓采集与限流退避的原型；
 *   · lib/trending.ts 的 parseTrending —— Trending 页解析（从 TS 翻成 JS 供 Node 用）。
 *   注意：解析逻辑在 lib/trending.ts 与 server/trending-parse.mjs 各有一份，
 *   是有意为之 —— 扩展要跑在浏览器（DOMParser），服务端跑在 Node（无 DOM），
 *   无法共用同一份实现；但**断言相同**（server/tests 里用固定 HTML 片段校验）。
 *
 * 凭据：可选 GITHUB_TOKEN（未认证 60 次/时，认证 5000 次/时），只从环境读、不落盘。
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTrendingHtml } from './trending-parse.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 默认追踪池（服务端的追踪仓清单，与扩展收藏无关）。 */
const DEFAULT_TRACKED = []

function trackedPath() {
  return process.env.GITHUB_HOT_RANK_TRACKED || path.join(ROOT, 'data', 'tracked.json')
}

export function readTracked() {
  const p = trackedPath()
  if (!existsSync(p)) return [...DEFAULT_TRACKED]
  try {
    const v = JSON.parse(readFileSync(p, 'utf8'))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function writeTracked(list) {
  const p = trackedPath()
  mkdirSync(path.dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(list, null, 2) + '\n')
}

/**
 * 拉一个仓库的元数据。
 * @returns {Promise<{missing?:true, stars?:number, forks?:number, issues?:number, pushedAt?:string, archived?:boolean}>}
 */
export async function fetchRepo(fullName, { fetchImpl = fetch } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'github-hot-rank-server',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await fetchImpl(`https://api.github.com/repos/${fullName}`, { headers })
  if (res.status === 404) return { missing: true }
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset')
    const at = reset ? new Date(Number(reset) * 1000).toISOString() : '未知'
    throw new Error(`GitHub 限流（403），额度重置于 ${at}`)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  return {
    stars: j.stargazers_count,
    forks: j.forks_count,
    issues: j.open_issues_count,
    pushedAt: j.pushed_at,
    archived: j.archived,
  }
}

/**
 * 拉 Trending 页并解析。
 * @param {'daily'|'weekly'|'monthly'} window
 * @param {string} lang 空串 = 不限语言
 */
export async function fetchTrending(window, lang = '', { fetchImpl = fetch } = {}) {
  const url = `https://github.com/trending/${encodeURIComponent(lang)}?since=${window}`
  const res = await fetchImpl(url, { headers: { Accept: 'text/html', 'User-Agent': 'github-hot-rank-server' } })
  if (!res.ok) throw new Error(`trending ${window} ${res.status}`)
  return parseTrendingHtml(await res.text())
}

/**
 * 跑一轮完整采集：Trending（3 个窗口）+ 追踪仓 stars。
 *
 * @param {import('./store.mjs').SnapshotStore} store
 * @param {{windows?:string[], langs?:string[], tracked?:string[], fetchImpl?:Function}} opts
 */
export async function collectOnce(store, opts = {}) {
  const windows = opts.windows ?? ['daily', 'weekly', 'monthly']
  const langs = opts.langs ?? ['']
  const tracked = opts.tracked ?? readTracked()
  const fetchImpl = opts.fetchImpl ?? fetch
  const date = dayKey()
  const now = new Date().toISOString()

  store.recordSnapshotBatch(date, now)

  // Trending
  let trendingCount = 0
  for (const window of windows) {
    for (const lang of langs) {
      try {
        const items = await fetchTrending(window, lang, { fetchImpl })
        store.saveTrending(date, lang, window, items)
        trendingCount += items.length
      } catch (e) {
        console.error(`✗ trending ${window} lang=${lang || 'any'}: ${e.message}`)
      }
      await sleep(200)
    }
  }

  // 追踪仓 stars
  const repos = {}
  let missing = 0
  for (const fullName of tracked) {
    try {
      const data = await fetchRepo(fullName, { fetchImpl })
      if (data.missing) {
        console.warn(`- ${fullName}: 仓库不存在或已转私有，跳过`)
        missing++
        continue
      }
      repos[fullName] = data
    } catch (e) {
      // 限流时中止本轮，避免半截快照被当成全天数据（与 scripts/collect.mjs 同策略）
      console.error(`✗ ${fullName}: ${e.message}`)
      return { ok: false, error: e.message, date, trendingCount, repoCount: Object.keys(repos).length }
    }
    await sleep(300)
  }
  if (Object.keys(repos).length) store.saveRepoStars(date, repos)

  return { ok: true, date, trendingCount, repoCount: Object.keys(repos).length, missing }
}
