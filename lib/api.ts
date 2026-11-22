/**
 * 榜单 API 客户端（薄客户端的数据入口）。
 *
 * 架构：服务端持续采集 + 差分，扩展只消费 API。
 * 为什么不是每个用户本地采：插件市场形态下，本地采集只能看到用户自己攒的数据，
 * 冷启动无榜单可看。owner 明确要求「浏览器插件是要上插件市场的」。
 *
 * 降级策略（重要）：API 挂了不能让扩展变成废铁。
 * 拉不到榜单时回退到本地直抓 Trending（lib/trending.ts 的原路径），
 * 并在 UI 上标出「服务端不可用，显示的是本地实时抓取」。
 */

/** API 基址。生产走自有域名；开发可指向本机。 */
export const API_BASE = (import.meta.env?.VITE_HOT_RANK_API ?? 'https://hotrank.webkubor.xyz/api').replace(/\/+$/, '')

/** 单个请求超时（毫秒）。服务端不该让扩展干等。 */
const TIMEOUT_MS = 8000

export interface RankingItem {
  rank: number
  fullName: string
  delta: number
  stars: number
  spanDays: number
}

export interface TrendingItem {
  fullName: string
  url: string
  description: string
  language: string
  starsInWindow: number
  totalStars: number
}

export interface RankingsResponse {
  window: string
  ready: boolean
  /** 样本不足时的说明（ready=false） */
  message?: string
  snapshotCount?: number
  items: RankingItem[]
}

export interface TrendingResponse {
  window: string
  lang: string
  snapshotDate: string | null
  ready: boolean
  items: TrendingItem[]
}

async function getJSON<T>(path: string): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 拉增速榜（差分口径）。
 * @param window 1d | 7d | 30d
 */
export async function fetchRankings(window: '1d' | '7d' | '30d' = '7d'): Promise<RankingsResponse> {
  return getJSON<RankingsResponse>(`/rankings?window=${encodeURIComponent(window)}`)
}

/**
 * 拉 Trending 榜（原始热度，服务端每小时抓一次）。
 * @param window daily | weekly | monthly
 * @param lang 空串 = 不限语言
 */
export async function fetchTrending(window: 'daily' | 'weekly' | 'monthly' = 'daily', lang = ''): Promise<TrendingResponse> {
  return getJSON<TrendingResponse>(`/rankings/trending?window=${encodeURIComponent(window)}&lang=${encodeURIComponent(lang)}`)
}

/** 拉单仓增速与突变。 */
export async function fetchRepoGrowth(owner: string, name: string) {
  return getJSON<{
    fullName: string
    currentStars: number
    snapshotCount: number
    windows: Record<string, { delta: number; stars: number; spanDays: number } | null>
    mutation: { delta1: number; avgPrev: number; isMutation: boolean } | null
  }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/growth`)
}

/** 服务端健康检查（扩展可据此显示「服务端在线/离线」）。 */
export async function fetchHealth(): Promise<{ ok: boolean; snapshots: number; latestDate: string | null }> {
  return getJSON('/health')
}
