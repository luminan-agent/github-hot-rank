# AGENTS.md · github-hot-rank

浏览器扩展（Chrome MV3，WXT + TS）。仓库地址 `github.com/webkubor/github-hot-rank`，开源 AGPL-3.0。

## UI 改动前置（硬性）

改任何用户可见的 UI（popup、仓库页徽章、官网 `docs/`）之前：

1. 先读根目录 **`DESIGN.md`**——tokens、Do/Don't、决策记录的唯一真源。
2. 颜色/字阶/间距/圆角只引用 tokens（CSS 变量）；新增 token 先改 DESIGN.md + 决策记录补一行，禁止在组件里写裸 hex 或 px 魔数（1px 边线除外）。
3. 不引入 DESIGN.md 未声明的风格元素（插画、emoji 横幅、渐变、第三强调色）。
4. logo：大尺寸（≥48px）用 `brand/svg/v7-flame-tip-star.svg`（焰尖金身），小尺寸（16–26px）用 `brand/svg/v7-small-flame-cap.svg`（完整星 + 顶部橙帽）；几何由 `brand/build_marks.py` 生成，路径已内联 popup 头部与官网页头/主视觉。**已于 2026-11-21 用户定稿**，不得改动几何或换色；改品牌件先改 `brand/build_marks.py`。
5. 改完用真实浏览器截图验收（popup 浅/深两主题都要），证据留存到 `docs/screenshots/`。

构建与验收命令：`pnpm install && pnpm dev`（本地加载 `.output/chrome-mv3/`）、`pnpm build`、`npm run zip`（商店包）。
