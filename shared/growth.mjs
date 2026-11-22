/**
 * 增速差分与突变判定的共享纯函数（服务端与扩展共用）。
 *
 * 为什么抽出来：同一个口径要跑在两个地方 ——
 *   · 服务端（server/）每小时采快照，差分出 Δ1/Δ7 与突变事件，出 API；
 *   · 扩展（lib/）薄客户端只消费 API。
 * 口径若各写一份，服务端说「突变」而扩展说「没突变」时无法排查。
 * 所以这里只放**纯函数**（无 IO、无 chrome API、无 fs），两边都 import 它。
 *
 * 历史沿革：
 *   · scripts/collect.mjs 的 growth() —— 服务端差分的原型；
 *   · lib/favorites.ts 的 mutationOf() —— 扩展侧的突变判定。
 * 两份逻辑同构但各写一处，本模块把它们合并为唯一口径。
 *
 * 纯函数约定：输入快照数组、输出排行数组；不做任何 IO，方便两侧共用与测试。
 */

/**
 * 一个快照的最小结构：日期 + 各仓 star 数。
 * @typedef {{ date: string, repos: Record<string, { stars: number }> }} Snapshot
 */

/**
 * 一行的增速结果。
 * @typedef {{ fullName: string, delta: number, stars: number, spanDays: number }} GrowthRow
 */

const DAY_MS = 86400000

/**
 * 取「距最新快照 days 天之前最近的那份快照」作为基准。
 *
 * 容差 ±1.5 天：采集可能因故延后，不能要求严格对齐。
 * 找不到基准（或基准就是最新那份）时返回 null —— 调用方据此判定「样本不足」，
 * 而不是拿 0 冒充没有增长。
 */
export function pickBaseSnapshot(snapshots, days) {
  if (snapshots.length < 2) return null
  const latest = snapshots[snapshots.length - 1]
  const targetMs = Date.parse(latest.date) - days * DAY_MS
  let base = null
  let best = Infinity
  for (const s of snapshots) {
    const diff = Math.abs(Date.parse(s.date) - targetMs)
    if (diff < best) {
      best = diff
      base = s
    }
  }
  if (!base || best > 1.5 * DAY_MS || base.date === latest.date) return null
  return base
}

/**
 * 差分：最新快照 vs days 天前的基准快照，按增量降序。
 *
 * 只统计两边都有的仓库（一边缺数据说明那天没采到，不能算成负增长）。
 * 基准缺失（样本不足）时返回空数组。
 */
export function growth(days, snapshots) {
  const base = pickBaseSnapshot(snapshots, days)
  if (!base) return []
  const latest = snapshots[snapshots.length - 1]
  const rows = []
  for (const [full, now] of Object.entries(latest.repos)) {
    const prev = base.repos[full]
    if (!prev) continue
    rows.push({
      fullName: full,
      delta: now.stars - prev.stars,
      stars: now.stars,
      spanDays: Math.round((Date.parse(latest.date) - Date.parse(base.date)) / DAY_MS),
    })
  }
  return rows.sort((a, b) => b.delta - a.delta)
}

/**
 * 突变判定结果。
 * @typedef {{ delta1: number, avgPrev: number, isMutation: boolean }} MutationResult
 */

/**
 * Δ1 与突变判定：Δ1 ≥ 10 且 ≥ 3× 前期日均。
 *
 * 阈值取 10 与 3× 是本仓既定口径（见 lib/favorites.ts 原实现与 README），
 * 服务端与扩展必须一致，所以放在共享模块。
 *
 * 快照不足两天时返回 null（判不了，不是「没突变」）。
 */
export function mutationOf(dates, stars) {
  if (dates.length < 2) return null
  const last = stars.length - 1
  const delta1 = stars[last] - stars[last - 1]
  const prevDeltas = []
  for (let i = 1; i < last; i++) prevDeltas.push(stars[i] - stars[i - 1])
  const avgPrev = prevDeltas.length ? prevDeltas.reduce((a, b) => a + b, 0) / prevDeltas.length : 0
  // Math.max(avgPrev, 1)：前期日均可能是 0 或负（掉粉），此时阈值取 1，
  // 避免「Δ1 ≥ 3× 负数」恒真、把任何波动都判成突变。
  const isMutation = delta1 >= 10 && delta1 >= 3 * Math.max(avgPrev, 1)
  return { delta1, avgPrev, isMutation }
}

/**
 * 从按日期排序的快照序列里取某个仓的突变判定。
 * 序列可以是服务端快照库里查出来的 [{date, stars}]。
 */
export function mutationOfSeries(series) {
  if (!series.length) return null
  const dates = series.map((s) => s.date)
  const stars = series.map((s) => s.stars)
  return mutationOf(dates, stars)
}
