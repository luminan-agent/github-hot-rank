/**
 * 服务端核心逻辑测试：共享差分/突变口径 + 存储层 + Trending 解析 + API。
 *
 * 用 node:test（Node 22 内置），零依赖。
 * 跑： node --test server/tests/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { growth, mutationOf, mutationOfSeries, pickBaseSnapshot } from '../../shared/growth.mjs'
import { SnapshotStore } from '../store.mjs'
import { parseTrendingHtml } from '../trending-parse.mjs'
import { handleRequest } from '../api.mjs'

const snap = (date, repos) => ({ date, repos })

// ── 共享口径：差分 ────────────────────────────────────────────────

test('growth：按 delta 降序排列', () => {
  const snapshots = [
    snap('2026-11-01', { 'a/b': { stars: 100 }, 'c/d': { stars: 50 } }),
    snap('2026-11-08', { 'a/b': { stars: 180 }, 'c/d': { stars: 55 } }),
  ]
  const rows = growth(7, snapshots)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].fullName, 'a/b')
  assert.equal(rows[0].delta, 80)
  assert.equal(rows[1].delta, 5)
})

test('growth：快照不足两份时返回空（不是 0 冒充）', () => {
  assert.deepEqual(growth(7, [snap('2026-11-01', { 'a/b': { stars: 1 } })]), [])
  assert.deepEqual(growth(7, []), [])
})

test('growth：基准离目标太远时返回空（样本不足要明说）', () => {
  // 只有 01-01 与 11-08 两份，7 天窗口找不到基准
  const snapshots = [snap('2026-01-01', { 'a/b': { stars: 1 } }), snap('2026-11-08', { 'a/b': { stars: 2 } })]
  assert.deepEqual(growth(7, snapshots), [])
})

test('growth：只统计两边都有的仓（缺数据不当负增长）', () => {
  const snapshots = [
    snap('2026-11-01', { 'a/b': { stars: 100 }, 'x/y': { stars: 100 } }),
    snap('2026-11-08', { 'a/b': { stars: 150 } }),
  ]
  const rows = growth(7, snapshots)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].fullName, 'a/b')
  assert.equal(rows[0].delta, 50)
})

test('pickBaseSnapshot：取离目标日最近的那份（7 天窗口基准 = 7 天前那份）', () => {
  const snapshots = [
    snap('2026-11-01', {}),
    snap('2026-11-07', {}),
    snap('2026-11-08', {}),
  ]
  // 目标是 11-08 往前 7 天 = 11-01 ⇒ 正好命中，11-07 差 6 天更远
  const base = pickBaseSnapshot(snapshots, 7)
  assert.equal(base.date, '2026-11-01')
})

test('pickBaseSnapshot：没有正好命中时取最近的（容差 ±1.5 天内）', () => {
  const snapshots = [
    snap('2026-11-01', {}),
    snap('2026-11-06', {}),  // 目标 11-01，差 5 天 → 太远
    snap('2026-11-08', {}),
  ]
  // 7 天窗口的目标是 11-01：11-01 命中
  assert.equal(pickBaseSnapshot(snapshots, 7).date, '2026-11-01')
  // 1 天窗口的目标是 11-07：11-06 差 1 天（在容差内），11-01 差 6 天 ⇒ 取 11-06
  assert.equal(pickBaseSnapshot(snapshots, 1).date, '2026-11-06')
})

// ── 共享口径：突变判定 ────────────────────────────────────────────

test('mutationOf：Δ1≥10 且 ≥3× 前期日均 → 突变', () => {
  const m = mutationOf(['2026-11-01', '2026-11-02', '2026-11-03'], [100, 102, 130])
  assert.equal(m.delta1, 28)
  assert.equal(m.avgPrev, 2)
  assert.equal(m.isMutation, true)
})

test('mutationOf：Δ1 < 10 → 不是突变', () => {
  const m = mutationOf(['2026-11-01', '2026-11-02'], [100, 105])
  assert.equal(m.isMutation, false)
})

test('mutationOf：Δ1 够大但不到 3× 日均 → 不是突变', () => {
  // 前期日均 10，Δ1=20 < 3×10=30
  const m = mutationOf(['2026-11-01', '2026-11-02', '2026-11-03'], [100, 110, 130])
  assert.equal(m.delta1, 20)
  assert.equal(m.isMutation, false)
})

test('mutationOf：前期日均为 0 时阈值取 1（不让负/零日均把任何波动判成突变）', () => {
  const m = mutationOf(['2026-11-01', '2026-11-02'], [100, 100])
  assert.equal(m.avgPrev, 0)
  assert.equal(m.isMutation, false) // Δ1=0，不满足 ≥10
})

test('mutationOf：快照不足两天返回 null（判不了 ≠ 没突变）', () => {
  assert.equal(mutationOf(['2026-11-01'], [100]), null)
})

test('mutationOfSeries：从 {date,stars} 序列判定', () => {
  const m = mutationOfSeries([
    { date: '2026-11-01', stars: 100 },
    { date: '2026-11-02', stars: 101 },
    { date: '2026-11-03', stars: 140 },
  ])
  assert.equal(m.isMutation, true)
})

// ── 存储层 ────────────────────────────────────────────────────────

function withStore(fn) {
  const store = new SnapshotStore(':memory:')
  try {
    fn(store)
  } finally {
    store.close()
  }
}

test('store：同日期重复写入覆盖而非追加', () => {
  withStore((store) => {
    store.saveRepoStars('2026-11-01', { 'a/b': { stars: 100 } })
    store.saveRepoStars('2026-11-01', { 'a/b': { stars: 120 } })
    const s = store.snapshotFor('2026-11-01')
    assert.equal(s.repos['a/b'].stars, 120)
    assert.equal(Object.keys(s.repos).length, 1)
  })
})

test('store：allRepoSnapshots 按日期升序', () => {
  withStore((store) => {
    store.saveRepoStars('2026-11-02', { 'a/b': { stars: 2 } })
    store.saveRepoStars('2026-11-01', { 'a/b': { stars: 1 } })
    const snaps = store.allRepoSnapshots()
    assert.deepEqual(snaps.map((s) => s.date), ['2026-11-01', '2026-11-02'])
  })
})

test('store：repoStarSeries 按日期升序返回', () => {
  withStore((store) => {
    store.saveRepoStars('2026-11-01', { 'a/b': { stars: 1 } })
    store.saveRepoStars('2026-11-02', { 'a/b': { stars: 2 } })
    store.saveRepoStars('2026-11-03', { 'a/b': { stars: 3 } })
    const series = store.repoStarSeries('a/b')
    assert.deepEqual(series.map((s) => s.stars), [1, 2, 3])
  })
})

test('store：trendingFor 取最新一份抓取', () => {
  withStore((store) => {
    store.saveTrending('2026-11-01', '', 'daily', [{ fullName: 'old/x', starsInWindow: 1 }])
    store.saveTrending('2026-11-02', '', 'daily', [{ fullName: 'new/x', starsInWindow: 5 }])
    const { date, items } = store.trendingFor('daily', '')
    assert.equal(date, '2026-11-02')
    assert.equal(items[0].fullName, 'new/x')
  })
})

test('store：trendingFor 语言过滤生效', () => {
  withStore((store) => {
    store.saveTrending('2026-11-01', 'rust', 'daily', [{ fullName: 'r/x', starsInWindow: 1 }])
    store.saveTrending('2026-11-01', 'go', 'daily', [{ fullName: 'g/x', starsInWindow: 2 }])
    assert.equal(store.trendingFor('daily', 'rust').items[0].fullName, 'r/x')
    assert.equal(store.trendingFor('daily', 'go').items[0].fullName, 'g/x')
  })
})

// ── Trending 解析 ────────────────────────────────────────────────

const TRENDING_HTML = `
<html><body>
<article class="Box-row">
  <h2><a href="/owner/name" data-view-component="true">owner / name</a></h2>
  <p>A cool project &amp; more</p>
  <span itemprop="programmingLanguage" class="color-fg-default text-bold mr-1">TypeScript</span>
  <a class="Link--muted" href="/owner/name/stargazers">12,345</a>
  <span class="d-inline-block float-sm-right">1,234 stars today</span>
</article>
<article class="Box-row">
  <h2><a href="/rust-lang/rust">rust / rust</a></h2>
  <p>Fast</p>
  <a class="Link--muted" href="/rust-lang/rust/stargazers">99,999</a>
  <span class="d-inline-block float-sm-right">567 stars this week</span>
</article>
</body></html>
`

test('parseTrendingHtml：解析出条目与字段', () => {
  const items = parseTrendingHtml(TRENDING_HTML)
  assert.equal(items.length, 2)
  assert.equal(items[0].fullName, 'owner/name')
  assert.equal(items[0].url, 'https://github.com/owner/name')
  assert.equal(items[0].description, 'A cool project & more')
  assert.equal(items[0].language, 'TypeScript')
  assert.equal(items[0].totalStars, 12345)
  assert.equal(items[0].starsInWindow, 1234)
})

test('parseTrendingHtml：this week 窗口也认', () => {
  const items = parseTrendingHtml(TRENDING_HTML)
  assert.equal(items[1].fullName, 'rust-lang/rust')
  assert.equal(items[1].starsInWindow, 567)
})

test('parseTrendingHtml：空输入返回空数组', () => {
  assert.deepEqual(parseTrendingHtml(''), [])
  assert.deepEqual(parseTrendingHtml(null), [])
})

test('parseTrendingHtml：非 Trending 页返回空数组', () => {
  assert.deepEqual(parseTrendingHtml('<html><body><p>nothing</p></body></html>'), [])
})

// ── API ───────────────────────────────────────────────────────────

/** 用假 req/res 调 handleRequest，收集状态码与 body。 */
function callApi(store, url, method = 'GET') {
  const req = { method, url, headers: { host: 'localhost' } }
  let statusCode = 0
  let body = ''
  const res = {
    writeHead(status, headers) {
      statusCode = status
      this._headers = headers
    },
    end(payload) {
      body = payload ?? ''
    },
  }
  handleRequest(req, res, store)
  return { status: statusCode, body: body ? JSON.parse(body) : null }
}

test('api：GET /health 返回快照数', () => {
  withStore((store) => {
    const r = callApi(store, '/health')
    assert.equal(r.status, 200)
    assert.equal(r.body.ok, true)
    assert.equal(r.body.snapshots, 0)
  })
})

test('api：GET /rankings 快照不足时 ready=false 且明说原因', () => {
  withStore((store) => {
    const r = callApi(store, '/rankings?window=7d')
    assert.equal(r.status, 200)
    assert.equal(r.body.ready, false)
    assert.match(r.body.message, /快照不足/)
    assert.deepEqual(r.body.items, [])
  })
})

// 🔴 前缀一致性：扩展的 API_BASE 默认是「https://域名/api」（lib/api.ts），
// 而服务端路由本身是 /rankings、/health —— 两者不一致时扩展侧直接 404，
// 整个「薄客户端走 API」链路静默失效（UI 会退回本地抓取，看起来"能用"）。
// 这条用例钉住「带 /api 与不带返回同一份数据」，防有人改路由时只改一边。
test('api：带 /api 前缀与不带前缀返回同一份数据（扩展与服务端路径必须一致）', () => {
  withStore((store) => {
    store.saveRepoStars('2026-11-01', { 'a/b': { stars: 100 } })
    store.saveRepoStars('2026-11-08', { 'a/b': { stars: 160 } })
    const bare = callApi(store, '/rankings?window=7d')
    const prefixed = callApi(store, '/api/rankings?window=7d')
    assert.equal(prefixed.status, 200)
    assert.equal(bare.status, prefixed.status)
    assert.deepEqual(prefixed.body.items, bare.body.items)
    assert.equal(prefixed.body.ready, true)
    // /api/health 与 /health 同理
    assert.equal(callApi(store, '/api/health').body.ok, true)
    assert.equal(callApi(store, '/api/health').body.snapshots, callApi(store, '/health').body.snapshots)
  })
})

test('api：GET /rankings 有数据时出榜并带 rank', () => {
  withStore((store) => {
    store.saveRepoStars('2026-11-01', { 'a/b': { stars: 100 }, 'c/d': { stars: 10 } })
    store.saveRepoStars('2026-11-08', { 'a/b': { stars: 200 }, 'c/d': { stars: 12 } })
    const r = callApi(store, '/rankings?window=7d')
    assert.equal(r.body.ready, true)
    assert.equal(r.body.items[0].rank, 1)
    assert.equal(r.body.items[0].fullName, 'a/b')
    assert.equal(r.body.items[0].delta, 100)
  })
})

test('api：GET /rankings 非法 window 返回 400', () => {
  withStore((store) => {
    const r = callApi(store, '/rankings?window=99d')
    assert.equal(r.status, 400)
    assert.equal(r.body.error, 'bad_window')
  })
})

test('api：GET /rankings/trending 出 Trending 榜', () => {
  withStore((store) => {
    store.saveTrending('2026-11-02', '', 'daily', [{ fullName: 'a/b', starsInWindow: 99, totalStars: 100 }])
    const r = callApi(store, '/rankings/trending?window=daily')
    assert.equal(r.body.ready, true)
    assert.equal(r.body.items[0].fullName, 'a/b')
    assert.equal(r.body.items[0].starsInWindow, 99)
  })
})

test('api：GET /repos/:owner/:name/growth 返回单仓增速与突变', () => {
  withStore((store) => {
    store.saveRepoStars('2026-11-01', { 'a/b': { stars: 100 } })
    store.saveRepoStars('2026-11-02', { 'a/b': { stars: 102 } })
    store.saveRepoStars('2026-11-03', { 'a/b': { stars: 150 } })
    const r = callApi(store, '/repos/a/b/growth')
    assert.equal(r.status, 200)
    assert.equal(r.body.currentStars, 150)
    assert.equal(r.body.mutation.isMutation, true)
    assert.equal(r.body.mutation.delta1, 48)
  })
})

test('api：GET /repos 不存在的仓返回 404', () => {
  withStore((store) => {
    const r = callApi(store, '/repos/no/such/growth')
    assert.equal(r.status, 404)
  })
})

test('api：GET /mutations 出突变流', () => {
  withStore((store) => {
    store.saveMutation('2026-11-03', 'a/b', 48, 2, 150)
    const r = callApi(store, '/mutations')
    assert.equal(r.body.items.length, 1)
    assert.equal(r.body.items[0].fullName, 'a/b')
    assert.equal(r.body.items[0].delta1, 48)
  })
})

test('api：未知路由返回 404', () => {
  withStore((store) => {
    const r = callApi(store, '/nope')
    assert.equal(r.status, 404)
  })
})

test('api：非 GET 方法返回 405', () => {
  withStore((store) => {
    const r = callApi(store, '/rankings', 'POST')
    assert.equal(r.status, 405)
  })
})

test('api：CORS 头存在（扩展是跨源调用）', () => {
  withStore((store) => {
    const req = { method: 'GET', url: '/health', headers: { host: 'localhost' } }
    let headers = null
    const res = { writeHead: (s, h) => { headers = h }, end: () => {} }
    handleRequest(req, res, store)
    assert.equal(headers['Access-Control-Allow-Origin'], '*')
  })
})
