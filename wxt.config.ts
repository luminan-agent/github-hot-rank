import { defineConfig } from 'wxt'

// 权限最小化：storage 存快照，alarms 做每日采集，notifications 只用于收藏仓涨速突变提醒；
// host 给 github.com（Trending 页与公开仓库页）与 api.github.com（收藏仓 star 采集）。
//
// 🔴 必须包含自家 API 域名：扩展是薄客户端，榜单数据全部来自服务端 API
//（lib/api.ts 的 API_BASE 默认 https://api.hotrank.webkubor.xyz/api —— 用 api. 子域，
//  不与官网根域名 hotrank.webkubor.xyz（GitHub Pages）冲突）。
// 少了这条 host_permissions，浏览器会直接拒绝跨域 fetch ⇒
// 「走 API」整条链路在真机上必然失败，而 UI 会静默退回本地抓取，
// 看起来「能用」—— 冷启动没榜单的问题原样复发，且没人能发现。
export default defineConfig({
  manifest: {
    name: 'GitHub Hot Rank',
    description: 'GitHub 热点项目追踪排行：按涨幅（而非绝对 star）排新星',
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: [
      'https://github.com/*',
      'https://api.github.com/*',
      // 自家榜单 API（可用 VITE_HOT_RANK_API 换域名，此处用通配覆盖 *.webkubor.xyz）
      'https://*.webkubor.xyz/*',
      // 本地开发自测服务端（localhost:8787）
      'http://localhost/*',
      'http://127.0.0.1/*',
    ],
  },
})
