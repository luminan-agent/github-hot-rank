# DESIGN.md · GitHub Hot Rank

## 定位与语气

- **定位**：按涨幅（差分增速）排 GitHub 新星的浏览器扩展。受众是每天刷 Trending 找新仓的开发者。
- **语气**：数据先行、克制、有锐度。像 Bloomberg 终端而不是像节日页——强调「增速」这一件事，不加装饰性噪音。
- **核心记忆点**：**火苗橙 = 榜上的热度与增速**，**星标黄 = star 与收藏**；大数字 + 等宽 rank。

## 差异化

竞品（GitHub Trending 本身、star-history、OSS Insight）都是绝对值视角。我们的 UI 刻意不同：**rank 是主角**（大号等宽数字），delta 用火苗色徽章，绝对 star 数降级为次要元信息。页面克制、无插画、无渐变横幅。

配色不借用 GitHub 默认主题的蓝/绿皮肤，而是取自**产品对象本身**：榜单榜前的火苗（trending 的热度语言）与 star 徽章的黄色。

## 视觉系统（tokens 真源）

颜色（语义层，明暗双主题）：

| token | light | dark | 用途 |
|---|---|---|---|
| `--bg` | `#f6f8fa` | `#0d1117` | 页面底 |
| `--panel` | `#ffffff` | `#161b22` | 卡片/列表底 |
| `--border` | `#d0d7de` | `#30363d` | 1px 分隔线、描边 |
| `--fg` | `#1f2328` | `#e6edf3` | 主文字 |
| `--muted` | `#59636e` | `#8b949e` | 次要文字 |
| `--brand` | `#f0883e` | `#fd8c73` | 榜火苗色：logo 主色、图标、强调块 |
| `--brand-ink` | `#bc4c00` | `#fd8c73` | 浅底承载文字的火苗色（rank、徽章文字） |
| `--brand-soft` | `#fff1e5` | `#2e1608` | 火苗色淡底（激活态、徽章底） |
| `--star` | `#e3b341` | `#e3b341` | 星徽章黄：logo 星、收藏星标 |
| `--star-ink` | `#9a6700` | `#e3b341` | 浅底承载文字的星色 |
| `--star-soft` | `#fff8c5` | `#2a2210` | 星色淡底（收藏高亮底） |

**来源与性质**（2026-11-20 实测 `github.com/trending` 页面 CSS 变量）：

- `--brand` light `#f0883e`：trending CSS 中的 attention/ANSI 红橙族主值（榜单火苗橙）。
- `--star` `#e3b341`：trending CSS `--button-star-iconColor`（GitHub star 徽章黄），本产品 star 徽章原值。
- `--brand-ink` light `#bc4c00`：同族文字安全深橙（attention fg，页面命中 43 次）。
- `--star-ink` light `#9a6700`：同族文字安全深黄（attention bold，页面命中 36 次）。
- `--brand` dark `#fd8c73`：trending CSS `--underlineNav-borderColor-active`（榜上活动项下划线色），深底可读性更高。
- `--brand-soft` `#fff1e5` / `#2e1608`、`--star-soft` `#fff8c5` / `#2a2210`：**本次按同色相推导的新增值**（GitHub 无同名 token），GitHub 仅提供 `#fff8c5` 一档 attention 淡底；深底淡底为推导值，不是上游既有规范。
- `--bg` / `--panel` / `--border` / `--fg` / `--muted`：GitHub 浅深主题既有中性值，沿用。

**禁止新增裸 hex**——改色先改本表。

字阶（popup 内 13px 基准，落地页 16px 基准，比例一致）：

- rank 数字：等宽 `ui-monospace, SFMono-Regular, Menlo`，700
- 主文字：系统栈 `-apple-system, "PingFang SC", "Segoe UI"`
- 层级：页面标题 700 / 列表主文字 600 / 次要 400 muted；不用第三种字重

间距 scale：`4 / 8 / 12 / 16 / 24 / 40`，只用这六档。圆角：控件 `6px`、卡片 `10px`、大区块 `12px`。阴影不用（依赖 1px border + 底色分层，克制）。

## Do / Don't

- ✅ rank/delta 用等宽与徽章制造「数据终端」感；✅ 亮暗两套主题都从 tokens 出；✅ 状态（加载中/空/错误）有专门样式；✅ 品牌色只取自产品自身（榜火苗 + 星标黄）。
- ❌ 不加插画、emoji 横幅、渐变光晕；❌ 不引入第三种强调色（蓝/绿等 GitHub 默认皮肤色不进本项目）；❌ 组件里写裸 hex/px 魔数；❌ 不从既有代码或外部色板反推品牌色。

## 决策记录

- 2026-11-20 · 用户判定现有 UI「太丑、无体系、缺 logo」→ 新建 DESIGN.md（当时依据：popup 既有色 + GitHub 官方色板对应值）。
- 2026-11-20 · logo 接入 UI：候选C「突变尖峰」（`brand/svg/c-mutation-spike.svg`）进入 popup 头部与落地页页头（**该方向已被用户否决，见下条**）。
- 2026-11-20 · **推翻候选C 与整套蓝/绿配色**。用户原话：「不是这个项目就是追榜单的火苗和星星标的黄色为核心，你不看产品本身你靠什么决定颜色」→ 色板改从产品对象自身取：榜火苗橙 `#f0883e`、星徽章黄 `#e3b341`；浅底文字安全变体 `#bc4c00` / `#9a6700`，深底变体 `#fd8c73`。依据：2026-11-20 实测 `github.com/trending` 页面 CSS 变量。
- 2026-11-20 · 新增 `--brand*` / `--star*` 六组 token，替换原 `--primary*` / `--accent*`；徽章底与徽章字色由「绿=涨幅」改为「火苗=热度」，收藏星标改用 `--star`。`--brand-soft` / `--star-soft` 为本次推导值，已在 token 表标注。
- 2026-11-20 · **logo 方向推翻「从代码反推」**（用户原话：「我的logo设计是让你从代码反推吗」）→ logo 改为从产品理念（追榜火苗 + star 徽章）直接设计，几何由 `brand/build_marks.py` 生成、脚本可复现。
- 2026-11-20 · **logo 收敛为 v7「焰尖金身」**：星为体（`--star` 金）、火为态（`--brand` 橙火舌取代星上尖）——「仓库在升温」即「star 在涨」。经三轮视觉模型盲审收敛，第三轮（修复版几何：共享凹弧接缝消台阶、钝圆火舌尖、根部加宽）结论 PASS：无渲染缺陷、24px 以上可辨；两弱点如实记录——16px 档 v7 火苗形体感丢失、橙色彗星形有「胡萝卜」误读风险，属设计取舍，**待用户定稿**。小尺寸（16–26px）不用缩放稿，改用专属变体 `v7-small-flame-cap`（完整五角星 + 顶部约 22% 橙帽，用颜色承载「尖在烧」，盲审确认 16px 档明显比 v7 稳）；`v8 焰口托星` 保留为 ≥32px 第二形态候选；v1 降级为单色/反白极简标；v6 出局。
- 2026-11-21 · **用户定稿 v7「焰尖金身」为正式品牌标识**（用户原话：「可以了」）。v7 ≥48px / v7-small-flame-cap 16–26px 的双形态策略随之转正；`v8 焰口托星` 取消候选资格，brand/ 其余 SVG 留作过程证据。
