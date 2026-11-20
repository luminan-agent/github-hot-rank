# Chrome Web Store 上架材料 · GitHub Hot Rank 0.1.0

> 提交前对照：商店包 `.output/github-hot-rank-0.1.0-chrome.zip`（由 `npm run zip` 产出）；
> 截图 `docs/screenshots/store-popup-1280x800.png` / `store-popup-dark-1280x800.png`（1280×800 商店规格）。

## 标题（≤45 字符）

```
GitHub Hot Rank - 按涨幅排 GitHub 新星
```

## 简介（≤132 字符）

```
Trending 按绝对 star 排名，大仓永远压前。本扩展用差分增速重排：涨得快的 2k★ 新仓，排在 200k★ 巨头前面。
```

（78 字符，中文按 1 字符计，余量充足）

## 详细描述

```
GitHub Trending 榜按绝对 star 数排名——赢家永远是老牌大仓，2k★ 的新仓即使今天涨了 +60★ 也排在 200k★ 巨头后面。

GitHub Hot Rank 对同一份 Trending 数据做差分增速重排：按 Δ1 / Δ7 涨幅排序，让涨得快的仓库先被看见。

■ 功能
· 涨幅排行：今日 / 本周 / 本月 + 语言过滤，增速差分重排
· 仓库页徽章：浏览任意 GitHub 仓库时注入当前增速名次
· 突变提醒：收藏仓库每日快照，涨速突变（Δ1 ≥ 10 且 ≥ 3× 前期日均）推送桌面通知，每仓每天至多一次
· 收藏追踪：☆ 收藏仓库，每日自动采集 star 快照，收藏页直接看 Δ7

■ 数据来源与隐私
· 无账号、无遥测、无云端存储——快照与收藏全部存在本机扩展 storage
· 数据来自 github.com / api.github.com 公开接口，不需要 GitHub 授权
· 增速数据 GitHub 官方已不提供（REST stargazers 时间戳接口 404），本扩展以自建每日快照差分计算，跨度不足不出假数

■ 权限说明
storage / alarms / notifications 三个权限只用于本地快照、每日采集与突变提醒；网络访问限 github.com 与 api.github.com。

开源（AGPL-3.0）：https://github.com/webkubor/github-hot-rank
```

## 单一用途声明

```
跟踪 GitHub 仓库的 star 涨速：对 Trending 与用户收藏的仓库做每日快照差分，按涨幅排序展示，并在涨速突变时提醒用户。
```

## 权限 justification

| 权限 | 理由 |
|---|---|
| `storage` | 在本机保存用户收藏的仓库列表与每日 star 快照（差分增速的数据源），不外传 |
| `alarms` | 每日定时触发一次快照采集（收藏仓 star 数 + Trending 数据），保证增速差分有连续数据 |
| `notifications` | 收藏仓库涨速突变时提醒用户（系统桌面通知，点击跳转对应仓库页） |
| `host_permissions: github.com` | 抓取 Trending 榜单页数据、注入仓库页增速名次徽章 |
| `host_permissions: api.github.com` | 查询收藏仓库的公开 star 总数（REST API，无需授权） |

## 隐私政策 URL

```
https://hotrank.webkubor.xyz/#隐私
```

（自定义域名已上线，GitHub Pages 站点经 `hotrank.webkubor.xyz` 提供；隐私声明与实际行为一致：扩展无账号、无遥测。官网访问量用 Cloudflare Web Analytics 匿名统计，声明同样写在该页「隐私」小节。）

## What's New（0.1.0 首发版）

```
首个公开发布版本：

· 涨幅排行：Trending 数据按 Δ1/Δ7 差分增速重排，支持今日/本周/本月与语言过滤
· 仓库页徽章：GitHub 仓库页注入当前增速名次
· 收藏与突变提醒：每日自动快照，涨速突变桌面通知
· 全部数据存本机，无账号无遥测
```

## 提交 checklist

- [ ] zip 上传（manifest 版本 0.1.0 与 CHANGELOG 一致）
- [ ] 截图 1280×800 ×2（浅色 + 深色）
- [ ] 图标 16/48/128px（`public/icon/`：16px 用 `v7-small-flame-cap`、48/128px 用 `v7-flame-tip-star` 渲染）
- [ ] 单一用途、权限 justification 逐项粘贴
- [ ] 隐私政策 URL 可访问
- [ ] 所有者 Google 账号 + $5 注册费（一次性）——需 owner 操作
