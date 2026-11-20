import { defineConfig } from 'wxt'

// 权限最小化：storage 存快照，alarms 做每日采集，notifications 只用于收藏仓涨速突变提醒；
// host 给 github.com（Trending 页与公开仓库页）与 api.github.com（收藏仓 star 采集）。
export default defineConfig({
  manifest: {
    name: 'GitHub Hot Rank',
    description: 'GitHub 热点项目追踪排行：按涨幅（而非绝对 star）排新星',
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: ['https://github.com/*', 'https://api.github.com/*'],
  },
})
