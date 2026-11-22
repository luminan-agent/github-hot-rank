/**
 * popup：读 background 缓存的服务端榜单，不再自己抓数据。
 *
 * 架构（owner 拍板）：服务端采集 + 差分出榜，扩展是薄客户端。
 * popup 只做两件事：读缓存渲染、把筛选条件交给 API。
 *
 * 降级可见性：服务端不可用时 background 会标记 degraded 并回退本地抓取，
 * popup 必须把这件事告诉用户（不然用户会以为看到的是「官方榜单」）。
 */
import { readCache } from '@/entrypoints/background'
import { fetchTrending, type TrendingItem } from '@/lib/api'
import { allSnapshots, getFavorites, toggleFavorite } from '@/lib/favorites'

const $since = document.querySelector<HTMLSelectElement>('#since')!
const $lang = document.querySelector<HTMLInputElement>('#lang')!
const $list = document.querySelector<HTMLOListElement>('#list')!
const $status = document.querySelector<HTMLParagraphElement>('#status')!
const $hot = document.querySelector<HTMLButtonElement>('#tab-hot')!
const $fav = document.querySelector<HTMLButtonElement>('#tab-fav')!
const $header = document.querySelector<HTMLElement>('#filters')!
const $degraded = document.querySelector<HTMLElement>('#degraded')!

let tab: 'hot' | 'fav' = 'hot'

function setTab(t: typeof tab) {
  tab = t
  $hot.classList.toggle('on', tab === 'hot')
  $fav.classList.toggle('on', tab === 'fav')
  // 收藏页不涉及时间窗/语言过滤，控件隐藏
  $header.hidden = tab === 'fav'
  void load()
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** 服务端降级提示条：告诉用户当前数据不是官方榜单。 */
function showDegraded(reason?: string): void {
  if (!reason) {
    $degraded.hidden = true
    return
  }
  $degraded.hidden = false
  $degraded.textContent = `⚠ 服务端不可用，当前为本地实时抓取：${reason}`
}

async function renderHot(items: TrendingItem[]) {
  const favs = await getFavorites()
  $list.innerHTML = items
    .map((r, i) => {
      const lang = r.language ? ` · ${r.language}` : ''
      const desc = r.description ? `<div class="desc">${esc(r.description)}</div>` : ''
      const starred = favs.includes(r.fullName) ? 'on' : ''
      return `<li><button class="fav ${starred}" data-repo="${esc(r.fullName)}" title="收藏/取消">${starred ? '★' : '☆'}</button>` +
        `<div class="body"><div class="row1"><span class="rank">${i + 1}</span>` +
        `<a class="name" href="${esc(r.url)}" target="_blank">${esc(r.fullName)}</a>` +
        `<span class="delta">+${r.starsInWindow}</span></div>${desc}` +
        `<div class="desc">${r.totalStars.toLocaleString()}★${lang}</div></div></li>`
    })
    .join('')
}

async function renderFav() {
  const favs = await getFavorites()
  const snaps = await allSnapshots()
  $list.innerHTML = favs
    .map((full) => {
      const repo = snaps[full] ?? {}
      const dates = Object.keys(repo).sort()
      const stars = dates.length ? repo[dates.at(-1)!] : null
      const starsText = stars === null ? '' : `${stars.toLocaleString()}★ · `
      return `<li><button class="fav" data-repo="${esc(full)}" title="取消收藏">★</button>` +
        `<div class="body"><div class="row1">` +
        `<a class="name" href="https://github.com/${esc(full)}" target="_blank">${esc(full)}</a>` +
        `<span class="delta">—</span></div>` +
        `<div class="desc">${starsText}${dates.length ? `本地快照 ${dates.length} 天` : '增速由服务端统计'}</div></div></li>`
    })
    .join('')
}

async function load() {
  $status.hidden = false
  if (tab === 'fav') {
    const favs = await getFavorites()
    if (!favs.length) {
      $list.innerHTML = ''
      $status.textContent = '还没收藏：去热榜点 ☆ 追踪仓库，涨速突变会提醒'
      return
    }
    $status.hidden = true
    await renderFav()
    return
  }

  $status.textContent = '加载中…'
  try {
    const cache = await readCache()
    const since = $since.value as 'daily' | 'weekly' | 'monthly'
    const lang = $lang.value.trim()

    let items: TrendingItem[] = []
    if (cache) {
      showDegraded(cache.degraded ? cache.reason : undefined)
      // 缓存是「不限语言」的服务端榜；用户填了语言过滤时必须现问 API
      items = lang ? [] : (cache.trending?.[since] ?? [])
    } else {
      showDegraded('尚未拉到服务端缓存')
    }

    if (!items.length) {
      const res = await fetchTrending(since, lang)
      items = res.items ?? []
      if (!res.ready) {
        $status.textContent = '服务端榜单还没准备好（刚部署时需要积累快照）'
        $list.innerHTML = ''
        return
      }
    }

    $status.hidden = items.length > 0
    if (!items.length) $status.textContent = '没抓到条目，稍后重试'
    await renderHot(items)
  } catch (e) {
    $status.textContent = `加载失败：${e instanceof Error ? e.message : String(e)}`
  }
}

// 收藏按钮：事件委托，点击后重渲染当前页
$list.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button.fav')
  if (!btn) return
  void toggleFavorite(btn.dataset.repo!).then(load)
})

$hot.addEventListener('click', () => setTab('hot'))
$fav.addEventListener('click', () => setTab('fav'))
$since.addEventListener('change', load)
$lang.addEventListener('change', load)
void load()
