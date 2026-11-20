# github-hot-rank

GitHub 热点项目追踪排行扩展（Chrome MV3，WXT）。

- 扩展：popup 按 今日/本周/本月 + 语言过滤渲染 Trending 榜；repo 页注入当前增速名次徽章。
- 采集：`scripts/` 提供零依赖的本地每日快照采集与增速差分（增速数据只能自建快照差分——REST stargazers 时间戳接口已 404，GraphQL 无 edges）。

## 本地跑

```bash
pnpm install && pnpm dev      # 扩展开发（加载 .output/chrome-mv3）
```

## 每日采集（scripts/）

```bash
node scripts/collect.mjs add owner/repo   # 追踪仓库（当前池见 data/tracked.json）
node scripts/collect.mjs                  # 采集今日快照 → data/snapshots/<日期>.json
node scripts/growth.mjs                   # 差分出 Δ1 / Δ7 增速榜
```

- 未认证 60 次/时够日常追踪；池子变大设 `GITHUB_TOKEN` 环境变量（只从环境读取，不落盘）。
- 快照目录不入库（`.gitignore` 的 `data/snapshots/`），数据资产本地沉淀。

License: AGPL-3.0
