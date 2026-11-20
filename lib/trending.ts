/**
 * Trending 抓取与解析（MVP 数据源）。
 *
 * 为什么抓 Trending 页而不是算 stargazers 差分：GitHub 已把带时间戳的
 * stargazers 列表关掉（REST 404，GraphQL 只有总数），增速的免费来源只剩
 * Trending 自带的 today/week/month。抓页低频（popup 打开时按需 + 每日 alarm
 * 一次），带 UA、缓存 30 分钟，不做并发。
 */

export interface HotRepo {
  /** owner/name */
  fullName: string
  url: string
  description: string
  language: string
  /** 本窗口新增 star（Trending 页原文，如 "1,234 stars today"） */
  starsInWindow: number
  totalStars: number
}

const TRENDING_URL = (since: 'daily' | 'weekly' | 'monthly', lang: string) =>
  `https://github.com/trending/${encodeURIComponent(lang)}?since=${since}`

const CACHE_TTL_MS = 30 * 60 * 1000

export function parseTrending(html: string): HotRepo[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const rows = doc.querySelectorAll('article.Box-row')
  const items: HotRepo[] = []
  for (const row of rows) {
    const a = row.querySelector('h2 a')
    if (!a) continue
    const fullName = (a.getAttribute('href') || '').replace(/^\//, '')
    if (!fullName) continue
    const descEl = row.querySelector('p')
    const langEl = row.querySelector('[itemprop="programmingLanguage"]')
    const starsText = row.querySelector('a.Link--muted[href$="/stargazers"]')?.textContent?.trim() || '0'
    const deltaMatch = /([\d,]+)\s+stars?\s+(today|this week|this month)/.exec(row.textContent || '')
    items.push({
      fullName,
      url: `https://github.com/${fullName}`,
      description: descEl?.textContent?.trim() || '',
      language: langEl?.textContent?.trim() || '',
      totalStars: Number(starsText.replace(/,/g, '')) || 0,
      starsInWindow: deltaMatch ? Number(deltaMatch[1].replace(/,/g, '')) || 0 : 0,
    })
  }
  return items
}

async function fetchWithCache(since: 'daily' | 'weekly' | 'monthly', lang: string): Promise<HotRepo[]> {
  const key = `trending:${since}:${lang || 'any'}`
  const cached = (await chrome.storage.local.get(key))[key] as { at: number; items: HotRepo[] } | undefined
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.items
  const res = await fetch(TRENDING_URL(since, lang), {
    headers: { Accept: 'text/html' },
    credentials: 'omit',
  })
  if (!res.ok) throw new Error(`trending ${res.status}`)
  const items = parseTrending(await res.text())
  await chrome.storage.local.set({ [key]: { at: Date.now(), items } })
  return items
}

/** popup 直接调用；background 的每日采集也走它。 */
export const getTrending = fetchWithCache
