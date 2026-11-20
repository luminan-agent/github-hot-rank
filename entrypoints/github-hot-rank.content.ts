/**
 * repo 页注入「当前增速名次」。
 *
 * 为什么在 content script 里直接 fetch：本脚本就跑在 github.com 上，
 * 抓 /trending 是同源请求，不受 MV3 的 CORS 限制，无需经过 background。
 *
 * GitHub 是 SPA（turbo/pjax 导航），URL 变了 DOM 换了但脚本不重跑 ——
 * 用 MutationObserver 监听 <title> 变化来重渲染。
 */
import { parseTrending } from '@/lib/trending'

const WINDOWS = ['daily', 'weekly', 'monthly'] as const
type Window = (typeof WINDOWS)[number]

const BADGE_ID = 'hot-rank-badge'
const LABEL: Record<Window, string> = { daily: '今日', weekly: '本周', monthly: '本月' }

/** repo 页判定：/owner/name 两段路径，排除 trending/settings 等非仓库页 */
function repoFullName(pathname: string): string | null {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/')
  if (seg.length < 2) return null
  if (['trending', 'settings', 'topics', 'collections', 'sponsors', 'features', 'orgs', 'marketplace', 'login', 'signup'].includes(seg[0])) return null
  return `${seg[0]}/${seg[1]}`
}

async function ranksFor(fullName: string): Promise<{ win: Window; rank: number; delta: number }[]> {
  const results = []
  for (const win of WINDOWS) {
    try {
      const res = await fetch(`https://github.com/trending?since=${win}`, { credentials: 'omit' })
      if (!res.ok) continue
      const items = parseTrending(await res.text())
      const idx = items.findIndex((r) => r.fullName.toLowerCase() === fullName.toLowerCase())
      if (idx >= 0) results.push({ win, rank: idx + 1, delta: items[idx].starsInWindow })
    } catch {
      // 网络失败静默：徽章不打扰正常浏览
    }
  }
  return results
}

function inject(fullName: string, ranks: { win: Window; rank: number; delta: number }[]) {
  document.getElementById(BADGE_ID)?.remove()
  // 实测 repo 页无 #repository-container-header；标题锚点用 h1.heading-element，
  // 徽章插在 h1 之后，与仓库名同行。
  const h1 = document.querySelector('h1.heading-element') ?? document.querySelector('h1')
  if (!h1) return
  const badge = document.createElement('div')
  badge.id = BADGE_ID
  badge.style.cssText =
    'display:inline-flex;gap:8px;align-items:center;font-size:12px;color:#0969da;' +
    'background:#ddf4ff;border:1px solid #54aeff66;border-radius:6px;padding:2px 8px;margin-left:8px;vertical-align:middle'
  badge.innerHTML = ranks.length
    ? ranks.map((r) => `<span>🔥 ${LABEL[r.win]}榜 <b>#${r.rank}</b>（+${r.delta.toLocaleString()}）</span>`).join('')
    : `<span>🔥 未入今日榜</span>`
  h1.insertAdjacentElement('afterend', badge)
}

async function refresh() {
  const fullName = repoFullName(location.pathname)
  document.getElementById(BADGE_ID)?.remove()
  if (!fullName) return
  inject(fullName, []) // 先占位，避免闪烁后再插入
  inject(fullName, await ranksFor(fullName))
}

export default defineContentScript({
  matches: ['https://github.com/*'],
  runAt: 'document_idle',
  main() {
    let last = ''
    new MutationObserver(() => {
      if (location.href !== last) {
        last = location.href
        void refresh()
      }
    }).observe(document, { subtree: true, childList: true })
    void refresh()
  },
})
