# DESIGN.md · GitHub Hot Rank

## 定位与语气

- **定位**：按涨幅（差分增速）排 GitHub 新星的浏览器扩展。受众是每天刷 Trending 找新仓的开发者。
- **语气**：数据先行、克制、有锐度。像 Bloomberg 终端而不是像节日页——强调「增速」这一件事，不加装饰性噪音。
- **核心记忆点**：绿色 = 突变/涨幅（与 logo 的绿色尖端同义）；大数字 + 等宽 rank。

## 差异化

竞品（GitHub Trending 本身、star-history、OSS Insight）都是绝对值视角。我们的 UI 刻意不同：**rank 是主角**（大号等宽数字），delta 是绿色徽章，绝对 star 数降级为次要元信息。页面克制、无插画、无渐变横幅。

## 视觉系统（tokens 真源）

颜色（OKLCH 语义层，明暗双主题）：

| token | light | dark | 用途 |
|---|---|---|---|
| `--bg` | `#f6f8fa` | `#0d1117` | 页面底 |
| `--panel` | `#ffffff` | `#161b22` | 卡片/列表底 |
| `--border` | `#d0d7de` | `#30363d` | 1px 分隔线、描边 |
| `--fg` | `#1f2328` | `#e6edf3` | 主文字 |
| `--muted` | `#59636e` | `#8b949e` | 次要文字 |
| `--primary` | `#0969da` | `#4493f8` | rank、激活态、链接、logo 主体 |
| `--primary-soft` | `#ddf4ff` | `#121d2f` | 激活底色 |
| `--accent` | `#1a7f37` | `#3fb950` | delta 涨幅、突变、logo 尖端 |
| `--accent-soft` | `#dafbe1` | `#0f2417` | delta 徽章底 |

来源：popup 既有色 `#0969da` / `#1a7f37`（GitHub 蓝 + 涨幅绿）原值沿用；dark 提亮到 GitHub dark 主题对应值。**禁止新增裸 hex**——改色先改本表。

字阶（popup 内 13px 基准，落地页 16px 基准，比例一致）：

- rank 数字：等宽 `ui-monospace, SFMono-Regular, Menlo`，700
- 主文字：系统栈 `-apple-system, "PingFang SC", "Segoe UI"`
- 层级：页面标题 700 / 列表主文字 600 / 次要 400 muted；不用第三种字重

间距 scale：`4 / 8 / 12 / 16 / 24 / 40`，只用这六档。圆角：控件 `6px`、卡片 `10px`、大区块 `12px`。阴影不用（依赖 1px border + 底色分层，克制）。

## Do / Don't

- ✅ rank/delta 用等宽与徽章制造「数据终端」感；✅ 亮暗两套主题都从 tokens 出；✅ 状态（加载中/空/错误）有专门样式。
- ❌ 不加插画、emoji 横幅、渐变光晕；❌ 不新增第三种强调色；❌ 组件里写裸 hex/px 魔数。

## 决策记录

- 2026-11-20 · 用户判定现有 UI「太丑、无体系、缺 logo」→ 本次新建 DESIGN.md（依据：popup 既有两色 + GitHub 官方色板对应值，推断项：dark 提亮值与间距档位）。
- 2026-11-20 · logo 接入 UI：候选C「突变尖峰」（`brand/svg/c-mutation-spike.svg`，盲审唯一保留候选）进入 popup 头部与落地页页头；logo 候选稿状态不变，定稿前页面保留候选说明。
