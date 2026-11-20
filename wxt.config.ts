import { defineConfig } from 'wxt'

// 权限最小化：storage 存快照，alarms 做每日采集；
// host 只给 github.com —— 数据源就是 Trending 页与公开仓库页，不出网。
export default defineConfig({
  manifest: {
    name: 'GitHub Hot Rank',
    description: 'GitHub 热点项目追踪排行：按涨幅（而非绝对 star）排新星',
    permissions: ['storage', 'alarms'],
    host_permissions: ['https://github.com/*'],
  },
})
