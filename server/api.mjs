/**
 * 榜单 API：给薄客户端扩展消费。
 *
 * 无鉴权、只读、公开 —— 这是产品形态决定的：扩展要上插件市场，
 * 每个用户不该有自己的 API key。服务端的数据是公开的 GitHub 榜单，
 * 聚合后公开不涉及隐私。
 *
 * 路由：
 *   GET /rankings?window=1d|7d|30d&lang=      —— 增速榜（差分口径）
 *   GET /rankings/trending?window=daily|weekly|monthly&lang=  —— Trending 榜（原始热度）
 *   GET /repos/:owner/:name/growth              —— 单仓增速与突变
 *   GET /mutations?since=YYYY-MM-DD             —— 突变事件流
 *   GET /health                                 —— 健康检查（给部署探活用）
 *
 * 窗口参数用 1d/7d/30d（对外口径），内部映射到差分天数。
 */
import { createServer } from 'node:http'
import { growth, mutationOfSeries } from '../shared/growth.mjs'

/** 对外窗口 → 差分天数 */
const WINDOW_DAYS = { '1d': 1, '7d': 7, '30d': 30 }

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60',
  })
  res.end(payload)
}

function notFound(res, what) {
  json(res, 404, { error: 'not_found', message: `${what} 不存在` })
}

/**
 * 处理一次请求。抽成独立函数是为了能直接测（不起真实端口）。
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {import('./store.mjs').SnapshotStore} store
 */
export function handleRequest(req, res, store) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
  let path = url.pathname.replace(/\/+$/, '') || '/'
  // 扩展客户端的 API_BASE 默认带 /api 前缀（部署在域名/api 下），
  // 而服务端路由本身是 /rankings、/health。
  // 两种都支持：剥掉前缀再分派 —— 否则扩展连不上（路径 404）。
  if (path === '/api') path = '/'
  else if (path.startsWith('/api/')) path = path.slice(4)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }
  if (req.method !== 'GET') {
    json(res, 405, { error: 'method_not_allowed' })
    return
  }

  if (path === '/health') {
    const dates = store.snapshotDates()
    json(res, 200, {
      ok: true,
      snapshots: dates.length,
      latestSnapshot: dates.at(-1) ?? null,
      latestDate: dates.at(-1) ?? null,
    })
    return
  }

  if (path === '/rankings') {
    const window = url.searchParams.get('window') ?? '7d'
    const days = WINDOW_DAYS[window]
    if (!days) {
      json(res, 400, { error: 'bad_window', message: `window 只能是 ${Object.keys(WINDOW_DAYS).join(' / ')}` })
      return
    }
    const snapshots = store.recentRepoSnapshots(Math.max(days + 5, 35))
    const rows = growth(days, snapshots)
    if (!rows.length) {
      // 🔴 样本不足要明说，不能返回空数组让客户端以为「今天没人涨」。
      json(res, 200, {
        window,
        generatedAt: new Date().toISOString(),
        snapshotCount: snapshots.length,
        ready: false,
        message: snapshots.length < 2
          ? `快照不足两份（现有 ${snapshots.length} 份），差分需要至少两天`
          : `最近 ${days} 天窗口内没有可比对的快照`,
        items: [],
      })
      return
    }
    json(res, 200, {
      window,
      generatedAt: new Date().toISOString(),
      snapshotCount: snapshots.length,
      ready: true,
      items: rows.map((r, i) => ({ rank: i + 1, ...r })),
    })
    return
  }

  if (path === '/rankings/trending') {
    const window = url.searchParams.get('window') ?? 'daily'
    const lang = url.searchParams.get('lang') ?? ''
    if (!['daily', 'weekly', 'monthly'].includes(window)) {
      json(res, 400, { error: 'bad_window', message: 'window 只能是 daily / weekly / monthly' })
      return
    }
    const { date, items } = store.trendingFor(window, lang)
    json(res, 200, { window, lang, snapshotDate: date, generatedAt: new Date().toISOString(), ready: !!date, items })
    return
  }

  if (path === '/mutations') {
    const since = url.searchParams.get('since') ?? null
    const items = store.recentMutations(since)
    json(res, 200, { generatedAt: new Date().toISOString(), items })
    return
  }

  const repoMatch = /^\/repos\/([^/]+)\/([^/]+)\/growth$/.exec(path)
  if (repoMatch) {
    const fullName = `${repoMatch[1]}/${repoMatch[2]}`
    const series = store.repoStarSeries(fullName)
    if (!series.length) {
      notFound(res, `仓库 ${fullName} 的快照`)
      return
    }
    const mutation = mutationOfSeries(series)
    const byWindow = {}
    for (const [label, days] of [['1d', 1], ['7d', 7], ['30d', 30]]) {
      const rows = growth(days, store.recentRepoSnapshots(Math.max(days + 5, 35)))
      const row = rows.find((r) => r.fullName.toLowerCase() === fullName.toLowerCase())
      byWindow[label] = row ? { delta: row.delta, stars: row.stars, spanDays: row.spanDays } : null
    }
    json(res, 200, {
      fullName,
      currentStars: series.at(-1).stars,
      snapshotCount: series.length,
      windows: byWindow,
      mutation: mutation
        ? { delta1: mutation.delta1, avgPrev: mutation.avgPrev, isMutation: mutation.isMutation }
        : null,
      series,
    })
    return
  }

  json(res, 404, { error: 'not_found', message: `无此路由：${path}` })
}

/**
 * 起服务。
 * @param {import('./store.mjs').SnapshotStore} store
 * @param {number} port
 */
export function createApiServer(store, port = 8787) {
  const server = createServer((req, res) => {
    try {
      handleRequest(req, res, store)
    } catch (e) {
      console.error('[api] 处理请求出错', e)
      try {
        json(res, 500, { error: 'internal_error', message: String(e?.message ?? e) })
      } catch {
        res.end()
      }
    }
  })
  server.listen(port, () => {
    console.log(`[api] 榜单 API 已启动：http://127.0.0.1:${port}`)
  })
  return server
}
