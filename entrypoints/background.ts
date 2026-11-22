/**
 * 薄客户端的 background：消费服务端榜单 API，不再本地采集。
 *
 * 架构变更（owner 拍板）：服务端持续采集 + 差分出榜，扩展只消费 API。
 * 之前是每个用户本地采集 Trending 与收藏仓 stars —— 插件市场形态下，
 * 新用户本地没有任何历史快照，冷启动既没有榜单也没有突变事件。
 *
 * 数据流：
 *   服务端（每小时采集 + 差分） → 榜单 API → background 拉取并缓存
 *   → popup / content script 读缓存
 *
 * ⚠️ 降级：API 不可用时不阻塞扩展 —— 保留一条本地直抓 Trending 的兜底路径
 * （lib/trending.ts），并在缓存里标记 degraded=true，让 UI 明确告知用户
 * 「服务端不可用，当前是本地实时抓取」。宁可慢一点，不能让扩展变砖。
 */
import { fetchHealth, fetchRankings, fetchTrending, type RankingItem, type TrendingItem } from '@/lib/api'
import { getTrending } from '@/lib/trending'
import { getFavorites } from '@/lib/favorites'

const CACHE_KEY = 'api:cache'

export interface ApiCache {
  updatedAt: number
  /** true = 服务端不可用，当前数据来自本地兜底抓取 */
  degraded: boolean
  /** 降级原因（给用户看，不藏） */
  reason?: string
  rankings: Record<'1d' | '7d' | '30d', RankingItem[]>
  trending: Record<'daily' | 'weekly' | 'monthly', TrendingItem[]>
  mutations: { date: string; fullName: string; delta1: number; avgPrev: number; stars: number | null }[]
  /** 服务端最新快照日期 */
  serverDate: string | null
}

export async function readCache(): Promise<ApiCache | undefined> {
  return (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] as ApiCache | undefined
}

async function writeCache(cache: ApiCache): Promise<void> {
  await chrome.storage.local.set({ [CACHE_KEY]: cache })
}

/**
 * 拉一次服务端数据并写缓存。
 * @returns true = 服务端正常；false = 已降级
 */
export async function refreshFromServer(): Promise<boolean> {
  const rankings = { '1d': [], '7d': [], '30d': [] } as ApiCache['rankings']
  const trending = { daily: [], weekly: [], monthly: [] } as ApiCache['trending']
  let mutations: ApiCache['mutations'] = []
  let serverDate: string | null = null
  let degraded = false
  let reason: string | undefined

  const note = (msg: string) => {
    degraded = true
    reason = reason ? `${reason}；${msg}` : msg
  }

  try {
    const health = await fetchHealth()
    serverDate = health.latestDate
  } catch (e) {
    note(`服务端健康检查失败：${e instanceof Error ? e.message : String(e)}`)
  }

  // 增速榜：三个窗口（任一失败只影响该窗口，不整体崩）
  for (const w of ['1d', '7d', '30d'] as const) {
    try {
      const res = await fetchRankings(w)
      rankings[w] = res.items ?? []
    } catch (e) {
      note(`增速榜 ${w} 拉取失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Trending 榜：三个窗口
  for (const w of ['daily', 'weekly', 'monthly'] as const) {
    try {
      const res = await fetchTrending(w)
      trending[w] = res.items ?? []
    } catch (e) {
      note(`Trending ${w} 拉取失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 突变事件流：服务端出的突变（收藏仓的本地突变检测已下沉到服务端）
  try {
    const res = await fetch('/api/mutations').catch(() => null)
    if (res && res.ok) {
      const body = await res.json()
      mutations = body?.items ?? []
    }
  } catch {
    /* 突变流失败不阻塞其余数据 */
  }

  // 🔴 降级兜底：服务端完全不可用时，本地直抓 Trending，保证 popup 不是空的
  if (degraded && trending.daily.length === 0) {
    try {
      trending.daily = await getTrending('daily', '')
      note('已回退到本地实时抓取 Trending')
    } catch (e) {
      note(`本地兜底也失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  await writeCache({
    updatedAt: Date.now(),
    degraded,
    reason,
    rankings,
    trending,
    mutations,
    serverDate,
  })
  return !degraded
}

/** 突变事件 → 通知（每仓每天至多一次，通知历史存 chrome.storage.local）。 */
async function notifyMutations(cache: ApiCache): Promise<void> {
  const NOTIFY_KEY = 'mut:lastNotified'
  const hist = ((await chrome.storage.local.get(NOTIFY_KEY))[NOTIFY_KEY] as Record<string, string>) ?? {}
  const favs = await getFavorites()
  const today = new Date().toISOString().slice(0, 10)
  for (const m of cache.mutations) {
    // 只提醒用户收藏过的仓（未收藏的仓不进扩展）
    if (!favs.includes(m.fullName)) continue
    const key = `${m.fullName}`
    if (hist[key] === today) continue
    hist[key] = today
    const starsText = m.stars === null ? '' : `，当前 ${m.stars.toLocaleString()}★`
    chrome.notifications.create(`mutation:${m.fullName}:${today}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('/icon/128.png'),
      title: `🔥 ${m.fullName} 涨速突变`,
      message: `今日 +${m.delta1}★（前期日均 ${m.avgPrev.toFixed(1)}★）${starsText}`,
    })
  }
  await chrome.storage.local.set({ [NOTIFY_KEY]: hist })
}

export default defineBackground(() => {
  // 首次安装即拉一次
  chrome.runtime.onInstalled.addListener(() => {
    void refreshFromServer()
  })

  // 每小时刷新榜单（服务端也是每小时采集，节奏对齐）
  chrome.alarms.create('refresh-rankings', { periodInMinutes: 60 })

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'refresh-rankings') return
    try {
      const ok = await refreshFromServer()
      const cache = await readCache()
      if (cache) await notifyMutations(cache)
      if (!ok) console.warn('[hot-rank] 服务端不可用，已降级：', cache?.reason)
    } catch (e) {
      console.warn('[hot-rank] 刷新榜单失败', e)
    }
  })
})
