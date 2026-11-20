/**
 * 收藏与涨速突变检测。
 *
 * 快照结构：chrome.storage.local 的 `fav:snapshots`
 *   { [fullName]: { [YYYY-MM-DD]: stars } }
 * 由 background 每日 alarm 采集（GET api.github.com/repos/{full}，未认证 60 次/时
 * 足够个人收藏规模），差分逻辑与本仓 scripts/growth.mjs 同构。
 */
export type FavSnapshots = Record<string, Record<string, number>>

export const FAV_KEY = 'favorites'
export const SNAP_KEY = 'fav:snapshots'
const NOTIFY_KEY = 'fav:lastNotified'

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)

export async function getFavorites(): Promise<string[]> {
  const v = (await chrome.storage.local.get(FAV_KEY))[FAV_KEY]
  return Array.isArray(v) ? v : []
}

export async function toggleFavorite(fullName: string): Promise<boolean> {
  const favs = await getFavorites()
  const has = favs.includes(fullName)
  const next = has ? favs.filter((f) => f !== fullName) : [...favs, fullName]
  await chrome.storage.local.set({ [FAV_KEY]: next })
  return !has
}

export async function recordSnapshot(fullName: string, stars: number): Promise<void> {
  const all = ((await chrome.storage.local.get(SNAP_KEY))[SNAP_KEY] as FavSnapshots) ?? {}
  const repo = all[fullName] ?? {}
  repo[dayKey()] = stars
  all[fullName] = repo
  await chrome.storage.local.set({ [SNAP_KEY]: all })
}

export async function allSnapshots(): Promise<FavSnapshots> {
  return ((await chrome.storage.local.get(SNAP_KEY))[SNAP_KEY] as FavSnapshots) ?? {}
}

export async function fetchStars(fullName: string): Promise<number> {
  const headers = { Accept: 'application/vnd.github+json' }
  const res = await fetch(`https://api.github.com/repos/${fullName}`, { headers })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  return (await res.json()).stargazers_count
}

/** Δ1（最近两天差分）与突变判定：Δ1 ≥ 10 且 ≥ 3× 前期日均增速 */
export function mutationOf(dates: string[], stars: number[]): { delta1: number; avgPrev: number; isMutation: boolean } | null {
  if (dates.length < 2) return null
  const last = stars.length - 1
  const delta1 = stars[last] - stars[last - 1]
  const prevDeltas: number[] = []
  for (let i = 1; i < last; i++) prevDeltas.push(stars[i] - stars[i - 1])
  const avgPrev = prevDeltas.length ? prevDeltas.reduce((a, b) => a + b, 0) / prevDeltas.length : 0
  const isMutation = delta1 >= 10 && delta1 >= 3 * Math.max(avgPrev, 1)
  return { delta1, avgPrev, isMutation }
}

/** 收藏仓的 Δ7（最早与最新快照差，跨度 ≤ 8 天才算数） */
export function delta7Of(dates: string[], stars: number[]): number | null {
  if (dates.length < 2) return null
  const span = (Date.parse(dates.at(-1)!) - Date.parse(dates[0])) / 86400000
  if (span > 8) return null
  return stars.at(-1)! - stars[0]
}

/** 每仓每日至多提醒一次；通知历史存 `fav:lastNotified` */
export async function shouldNotify(fullName: string): Promise<boolean> {
  const hist = ((await chrome.storage.local.get(NOTIFY_KEY))[NOTIFY_KEY] as Record<string, string>) ?? {}
  return hist[fullName] !== dayKey()
}

export async function markNotified(fullName: string): Promise<void> {
  const hist = ((await chrome.storage.local.get(NOTIFY_KEY))[NOTIFY_KEY] as Record<string, string>) ?? {}
  hist[fullName] = dayKey()
  await chrome.storage.local.set({ [NOTIFY_KEY]: hist })
}
