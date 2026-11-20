#!/usr/bin/env node
/**
 * 增速榜：对 data/snapshots/ 下的每日快照做差分，输出 Δ1 / Δ7 涨幅。
 *
 * 用法：node scripts/growth.mjs
 * 数据由 scripts/collect.mjs 每日采集；快照不足两份时提示先积累。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { growth } from './collect.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOTS = path.join(ROOT, 'data', 'snapshots')

if (!existsSync(SNAPSHOTS)) {
  console.log('还没有快照：先跑 node scripts/collect.mjs')
  process.exit(0)
}

const snapshots = readdirSync(SNAPSHOTS)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(SNAPSHOTS, f), 'utf8')))

console.log(`快照 ${snapshots.length} 份（${snapshots[0].date} → ${snapshots.at(-1).date}）`)

for (const [label, days] of [['Δ1', 1], ['Δ7', 7]]) {
  const rows = growth(days, snapshots)
  console.log(`\n${label}（最近 ${days} 天）`)
  if (!rows.length) {
    console.log('  快照跨度不足，继续每日采集后自动出数')
    continue
  }
  for (const r of rows) {
    console.log(`  ${String(r.delta).padStart(6)}★  ${r.fullName.padEnd(48)} 现 ${r.stars}★`)
  }
}
