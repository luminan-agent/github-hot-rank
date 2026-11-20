/**
 * 每日采集：
 * 1) 把当前 daily/weekly 榜快照进 chrome.storage.local，为增速差分积累样本；
 * 2) 采集每个收藏仓的 star 数入库（lib/favorites 快照），差分出 Δ1，
 *    判定涨速突变（Δ1 ≥ 10 且 ≥ 3× 前期日均）→ chrome.notifications 提醒。
 */
import { getTrending } from '@/lib/trending'
import { allSnapshots, fetchStars, getFavorites, markNotified, mutationOf, recordSnapshot, shouldNotify } from '@/lib/favorites'

export default defineBackground(() => {
  chrome.alarms.create('daily-snapshot', { periodInMinutes: 60 * 24 })

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'daily-snapshot') return
    const day = new Date().toISOString().slice(0, 10)
    try {
      const [daily, weekly] = await Promise.all([getTrending('daily', ''), getTrending('weekly', '')])
      await chrome.storage.local.set({ [`snapshot:${day}`]: { daily, weekly } })
    } catch (e) {
      console.warn('[hot-rank] trending 采集失败', e)
    }

    // 收藏仓采集 + 突变检测（串行，收藏量大时不打爆未认证配额）
    const favs = await getFavorites()
    for (const fullName of favs) {
      try {
        const stars = await fetchStars(fullName)
        await recordSnapshot(fullName, stars)
        const snaps = (await allSnapshots())[fullName] ?? {}
        const dates = Object.keys(snaps).sort()
        const starsSeq = dates.map((d) => snaps[d])
        const m = mutationOf(dates, starsSeq)
        if (m?.isMutation && (await shouldNotify(fullName))) {
          await markNotified(fullName)
          chrome.notifications.create(`mutation:${fullName}:${day}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('/icon/128.png'),
            title: `🔥 ${fullName} 涨速突变`,
            message: `今日 +${m.delta1}★（前期日均 ${m.avgPrev.toFixed(1)}★），当前 ${stars.toLocaleString()}★`,
          })
        }
      } catch (e) {
        console.warn(`[hot-rank] ${fullName} 采集失败`, e)
      }
    }
  })
})
