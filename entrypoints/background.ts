/**
 * 每日采集：把当前 daily/weekly 榜快照进 chrome.storage.local，
 * 为后续「自建差分」积累样本（today 值 × 天数即可推出 7d/30d 涨幅序列）。
 */
import { getTrending } from '@/lib/trending'

export default defineBackground(() => {
  chrome.alarms.create('daily-snapshot', { periodInMinutes: 60 * 24 })
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'daily-snapshot') return
    try {
      const [daily, weekly] = await Promise.all([getTrending('daily', ''), getTrending('weekly', '')])
      const day = new Date().toISOString().slice(0, 10)
      await chrome.storage.local.set({ [`snapshot:${day}`]: { daily, weekly } })
    } catch (e) {
      console.warn('[hot-rank] 每日采集失败', e)
    }
  })
})
