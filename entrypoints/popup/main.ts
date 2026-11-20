import { getTrending, type HotRepo } from '@/lib/trending'
import { allSnapshots, delta7Of, getFavorites, toggleFavorite } from '@/lib/favorites'

const $since = document.querySelector<HTMLSelectElement>('#since')!
const $lang = document.querySelector<HTMLInputElement>('#lang')!
const $list = document.querySelector<HTMLOListElement>('#list')!
const $status = document.querySelector<HTMLParagraphElement>('#status')!
const $hot = document.querySelector<HTMLButtonElement>('#tab-hot')!
const $fav = document.querySelector<HTMLButtonElement>('#tab-fav')!
const $header = document.querySelector<HTMLElement>('#filters')!

let tab: 'hot' | 'fav' = 'hot'

function setTab(t: typeof tab) {
  tab = t
  $hot.classList.toggle('on', tab === 'hot')
  $fav.classList.toggle('on', tab === 'fav')
  // 收藏页不涉及时间窗/语言过滤，控件隐藏
  $header.hidden = tab === 'fav'
  load()
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

async function renderHot(items: HotRepo[]) {
  const favs = await getFavorites()
  $list.innerHTML = items
    .map((r, i) => {
      const lang = r.language ? ` · ${r.language}` : ''
      const desc = r.description ? `<div class="desc">${esc(r.description)}</div>` : ''
      const starred = favs.includes(r.fullName) ? 'on' : ''
      return `<li><button class="fav ${starred}" data-repo="${esc(r.fullName)}" title="收藏/取消">${starred ? '★' : '☆'}</button>` +
        `<div class="body"><div class="row1"><span class="rank">${i + 1}</span>` +
        `<a class="name" href="${r.url}" target="_blank">${esc(r.fullName)}</a>` +
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
      const d7 = delta7Of(dates, dates.map((d) => repo[d]))
      const delta = d7 === null ? '采集中' : `+${d7}/7天`
      const starsText = stars === null ? '' : `${stars.toLocaleString()}★ · `
      return `<li><button class="fav" data-repo="${esc(full)}" title="取消收藏">★</button>` +
        `<div class="body"><div class="row1">` +
        `<a class="name" href="https://github.com/${esc(full)}" target="_blank">${esc(full)}</a>` +
        `<span class="delta">${delta}</span></div>` +
        `<div class="desc">${starsText}快照 ${dates.length} 天</div></div></li>`
    })
    .join('')
}

async function load() {
  $status.hidden = false
  if (tab === 'fav') {
    const favs = await getFavorites()
    if (!favs.length) {
      $list.innerHTML = ''
      $status.textContent = '还没收藏：去热榜点 ☆ 追踪仓库，每日自动采快照，涨速突变会提醒'
      return
    }
    $status.hidden = true
    await renderFav()
    return
  }
  $status.textContent = '加载中…'
  try {
    const items = await getTrending($since.value as 'daily', $lang.value.trim())
    $status.hidden = items.length > 0
    if (!items.length) $status.textContent = '没抓到条目，稍后重试'
    await renderHot(items)
  } catch (e) {
    $status.textContent = `抓取失败：${e}（GitHub 未登录状态可访问 Trending，重试即可）`
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
load()
