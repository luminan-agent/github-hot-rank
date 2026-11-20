#!/usr/bin/env node
/**
 * GitHub 仓库每日快照采集器（零依赖，Node 18+）。
 *
 * 背景：REST stargazers 时间戳接口已死（404），GraphQL 又拿不到 edges，
 * 增速数据只能自建每日快照差分。本脚本就是这个差分的数据生产端。
 *
 * 用法：
 *   node scripts/collect.mjs                        采集全部 tracked 仓库，写 data/snapshots/<今天>.json
 *   node scripts/collect.mjs add owner/repo [...]   追踪新仓库
 *   node scripts/collect.mjs remove owner/repo [...]  停止追踪
 *   node scripts/collect.mjs list                   列出 tracked 仓库
 *
 * 凭据：可选 GITHUB_TOKEN 环境变量（未认证 60 次/时，认证 5000 次/时）。
 *       token 只从环境读取，不落盘、不进日志。
 *
 * 幂等：同一天重复执行直接覆盖当天的快照文件。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TRACKED = path.join(ROOT, 'data', 'tracked.json')
const SNAPSHOTS = path.join(ROOT, 'data', 'snapshots')

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const READ_OK = existsSync(TRACKED)
function readTracked() {
  return READ_OK ? JSON.parse(readFileSync(TRACKED, 'utf8')) : []
}
function writeTracked(list) {
  mkdirSync(path.dirname(TRACKED), { recursive: true })
  writeFileSync(TRACKED, JSON.stringify(list, null, 2) + '\n')
}

async function fetchRepo(fullName) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'github-hot-rank-collector',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await fetch(`https://api.github.com/repos/${fullName}`, { headers })
  if (res.status === 404) return { missing: true }
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset')
    const at = reset ? new Date(Number(reset) * 1000).toISOString() : '未知'
    throw new Error(`GitHub 限流（403），额度重置于 ${at}。追踪量大时请设 GITHUB_TOKEN`)
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

async function collect() {
  const tracked = readTracked()
  if (!tracked.length) {
    console.log('tracked 为空：先 node scripts/collect.mjs add owner/repo')
    return
  }
  mkdirSync(SNAPSHOTS, { recursive: true })
  const date = dayKey()
  const repos = {}
  let missing = 0
  for (const fullName of tracked) {
    let data
    try {
      data = await fetchRepo(fullName)
    } catch (e) {
      console.error(`✗ ${fullName}: ${e.message}`)
      return // 限流时中止，避免半截快照被误当全天数据
    }
    await sleep(300) // 未认证也能跑：60 次/时 > 日常追踪量
    if (data.missing) {
      console.warn(`- ${fullName}: 仓库不存在或已转私有，跳过`)
      missing++
      continue
    }
    repos[fullName] = data
    console.log(`✓ ${fullName} ${data.stars}★`)
  }
  const snapshot = { date, collectedAt: new Date().toISOString(), repos }
  const file = path.join(SNAPSHOTS, `${date}.json`)
  writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`\n快照写入 ${path.relative(ROOT, file)}：${Object.keys(repos).length} 个仓库${missing ? `（跳过 ${missing}）` : ''}`)
}

/** 增速计算：最新快照 vs 指定天数前最近的快照 */
export function growth(days, snapshots) {
  const latest = snapshots[snapshots.length - 1]
  const targetMs = Date.parse(latest.date) - days * 86400000
  // 容差 ±1 天：取离目标最近的旧快照
  let base = null
  let best = Infinity
  for (const s of snapshots) {
    const d = Math.abs(Date.parse(s.date) - targetMs)
    if (d < best) { best = d; base = s }
  }
  if (!base || best > 1.5 * 86400000 || base.date === latest.date) return []
  const rows = []
  for (const [full, now] of Object.entries(latest.repos)) {
    const prev = base.repos[full]
    if (!prev) continue
    rows.push({ fullName: full, delta: now.stars - prev.stars, stars: now.stars, spanDays: Math.round((Date.parse(latest.date) - Date.parse(base.date)) / 86400000) })
  }
  return rows.sort((a, b) => b.delta - a.delta)
}

// 仅直接执行本文件时进入 CLI；被 growth.mjs import 时自动跳过
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...args] = process.argv.slice(2)
  if (cmd === 'add' || cmd === 'remove') {
    const valid = args.filter((a) => /^[\w.-]+\/[\w.-]+$/.test(a))
    if (!valid.length) { console.error('用法：node scripts/collect.mjs add owner/repo [...]'); process.exit(1) }
    const tracked = readTracked()
    const next = cmd === 'add'
      ? [...new Set([...tracked, ...valid])]
      : tracked.filter((t) => !valid.includes(t))
    writeTracked(next)
    console.log(`${cmd === 'add' ? '已追踪' : '已移除'}：${valid.join(' ')}（当前 ${next.length} 个）`)
  } else if (cmd === 'list') {
    const tracked = readTracked()
    console.log(tracked.length ? tracked.join('\n') : '（空）')
  } else {
    await collect()
  }
}
