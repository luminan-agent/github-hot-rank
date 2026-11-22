#!/usr/bin/env node
/**
 * github-hot-rank 服务端入口：榜单 API + 每小时采集 worker。
 *
 * 用法：
 *   node server/index.mjs              —— 起 API + 定时采集（默认每小时一轮）
 *   node server/index.mjs --collect-once  —— 只跑一轮采集就退出（给 cron 用）
 *   node server/index.mjs --no-collect  —— 只起 API（采集交给外部 cron）
 *
 * 环境变量：
 *   PORT                        监听端口（默认 8787）
 *   GITHUB_HOT_RANK_DB          SQLite 路径（默认 data/server.db）
 *   GITHUB_HOT_RANK_INTERVAL_MIN 采集间隔分钟（默认 60）
 *   GITHUB_TOKEN                可选，提高 GitHub API 限额（只从环境读，不落盘）
 *   GITHUB_HOT_RANK_TRACKED      追踪仓清单路径（默认 data/tracked.json）
 *
 * 采集与 API 同进程：单机起步省一个部署单元；量大了再拆（worker 独立进程）。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SnapshotStore } from './store.mjs'
import { collectOnce, readTracked } from './collector.mjs'
import { createApiServer } from './api.mjs'
import { mutationOfSeries } from '../shared/growth.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const hasFlag = (f) => argv.includes(f)

const PORT = Number(process.env.PORT ?? 8787)
const DB_FILE = process.env.GITHUB_HOT_RANK_DB ?? path.join(ROOT, 'data', 'server.db')
const INTERVAL_MIN = Number(process.env.GITHUB_HOT_RANK_INTERVAL_MIN ?? 60)

/**
 * 采集完跑一次突变检测，把突变事件写进库（供 /mutations 出流）。
 * @param {SnapshotStore} store
 */
export function detectMutations(store) {
  const snapshots = store.recentRepoSnapshots(30)
  if (snapshots.length < 2) return 0
  const latestDate = snapshots.at(-1).date
  let count = 0
  const names = new Set()
  for (const snap of snapshots) {
    for (const full of Object.keys(snap.repos)) names.add(full)
  }
  for (const full of names) {
    const series = store.repoStarSeries(full, 30)
    const m = mutationOfSeries(series)
    if (!m || !m.isMutation) continue
    // 同一天同仓只留一条（saveMutation 是 upsert）
    store.saveMutation(latestDate, full, m.delta1, m.avgPrev, series.at(-1)?.stars ?? null)
    count++
  }
  return count
}

/** 跑一轮采集 + 突变检测。 */
export async function runCollection(store, opts = {}) {
  const result = await collectOnce(store, opts)
  if (result.ok) {
    const mutations = detectMutations(store)
    console.log(`[worker] 采集完成：Trending ${result.trendingCount} 条 / 追踪仓 ${result.repoCount} 个 / 突变 ${mutations} 个`)
  } else {
    console.error(`[worker] 采集失败：${result.error}`)
  }
  return result
}

async function main() {
  const store = new SnapshotStore(DB_FILE)

  if (hasFlag('--collect-once')) {
    await runCollection(store)
    store.close()
    return
  }

  const server = createApiServer(store, PORT)

  if (!hasFlag('--no-collect')) {
    console.log(`[worker] 采集间隔 ${INTERVAL_MIN} 分钟`)
    // 启动后先跑一轮，再按间隔跑
    await runCollection(store)
    const timer = setInterval(() => {
      runCollection(store).catch((e) => console.error('[worker] 采集轮次异常', e))
    }, INTERVAL_MIN * 60 * 1000)
    timer.unref?.()
  }

  const shutdown = () => {
    console.log('[api] 收到退出信号，关闭中…')
    server.close(() => {
      store.close()
      process.exit(0)
    })
    // 兜底：5 秒后强制退出
    setTimeout(() => process.exit(0), 5000).unref?.()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

// 直接执行本文件时启动服务；被 import 时不启动（便于测试）
if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
