/**
 * Trending 页 HTML 解析（Node 版，无 DOM）。
 *
 * 为什么不用 DOMParser：扩展侧用 DOMParser（浏览器原生），服务端是 Node，
 * 没有 DOM。零依赖原则下这里用正则实现。
 *
 * ⚠️ 解析口径必须与扩展侧 lib/trending.ts 的 parseTrending 一致 ——
 * 两边算出的「今日榜第几名」「新增 star 数」若不同，用户会看到矛盾的名次。
 * 一致性由 server/tests/test-trending-parse.mjs 用同一份 HTML 片段断言钉住。
 *
 * 页面结构（GitHub Trending）：
 *   <article class="Box-row">
 *     <h2><a href="/owner/name">owner / name</a></h2>
 *     <p>描述</p>
 *     <span itemprop="programmingLanguage">TypeScript</span>
 *     <a class="Link--muted" href="/owner/name/stargazers">12,345</a>
 *     ... "1,234 stars today"
 *   </article>
 */

/** 从文章块里取出仓库全名。 */
function parseFullName(article) {
  // <h2 ...><a href="/owner/name" ...> ... </a></h2>
  const h2 = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(article)
  if (!h2) return null
  const href = /href="\/([^"?#]+)"/.exec(h2[1])
  if (!href) return null
  const full = href[1].replace(/\/$/, '')
  // 只要 owner/name 两段
  const seg = full.split('/')
  if (seg.length < 2 || !seg[0] || !seg[1]) return null
  return `${seg[0]}/${seg[1]}`
}

/** 去 HTML 标签与多余空白，取纯文本。 */
function textOf(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 解析描述（<p> 块）。 */
function parseDescription(article) {
  const m = /<p[^>]*>([\s\S]*?)<\/p>/.exec(article)
  return m ? textOf(m[1]) : ''
}

/** 解析编程语言。 */
function parseLanguage(article) {
  const m = /itemprop="programmingLanguage"[^>]*>([\s\S]*?)</.exec(article)
  return m ? textOf(m[1]) : ''
}

/** 解析总 star 数（stargazers 链接旁的数字）。 */
function parseTotalStars(article) {
  const m = /<a[^>]*href="[^"]*\/stargazers"[^>]*>([\s\S]*?)<\/a>/.exec(article)
  if (!m) return 0
  const n = Number(textOf(m[1]).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** 解析窗口内新增 star（"1,234 stars today" / "this week" / "this month"）。 */
function parseStarsInWindow(article) {
  const text = textOf(article)
  const m = /([\d,]+)\s+stars?\s+(today|this week|this month)/.exec(text)
  if (!m) return 0
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * 解析整页 Trending HTML。
 * @param {string} html
 * @returns {Array<{fullName:string,url:string,description:string,language:string,starsInWindow:number,totalStars:number}>}
 */
export function parseTrendingHtml(html) {
  if (!html || typeof html !== 'string') return []
  const articles = html.match(/<article\b[^>]*class="[^"]*Box-row[^"]*"[\s\S]*?<\/article>/g) ?? []
  const items = []
  const seen = new Set()
  for (const article of articles) {
    const fullName = parseFullName(article)
    if (!fullName || seen.has(fullName)) continue
    seen.add(fullName)
    items.push({
      fullName,
      url: `https://github.com/${fullName}`,
      description: parseDescription(article),
      language: parseLanguage(article),
      starsInWindow: parseStarsInWindow(article),
      totalStars: parseTotalStars(article),
    })
  }
  return items
}
