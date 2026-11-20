import { getTrending, type HotRepo } from '@/lib/trending'

const $since = document.querySelector<HTMLSelectElement>('#since')!
const $lang = document.querySelector<HTMLInputElement>('#lang')!
const $list = document.querySelector<HTMLOListElement>('#list')!
const $status = document.querySelector<HTMLParagraphElement>('#status')!

function render(items: HotRepo[]) {
  $status.hidden = items.length > 0
  $list.innerHTML = items
    .map((r, i) => {
      const lang = r.language ? ` · ${r.language}` : ''
      const desc = r.description ? `<div class="desc">${r.description}</div>` : ''
      return `<li><span class="rank">${i + 1}</span><a class="name" href="${r.url}" target="_blank">${r.fullName}</a>` +
        `<span class="delta">+${r.starsInWindow}</span>${desc}<div class="desc">${r.totalStars.toLocaleString()}★${lang}</div></li>`
    })
    .join('')
}

async function load() {
  $status.hidden = false
  $status.textContent = '加载中…'
  try {
    render(await getTrending($since.value as 'daily', $lang.value.trim()))
  } catch (e) {
    $status.textContent = `抓取失败：${e}（GitHub 未登录状态可访问 Trending，重试即可）`
  }
}

$since.addEventListener('change', load)
$lang.addEventListener('change', load)
load()
