# 埋点与数据口径 · GitHub Hot Rank

> 本文是数据采集的唯一口径真源：官网（hotrank.webkubor.xyz）与浏览器扩展分别采集什么、采到哪儿、保留多久、以及**当前为什么拿不到某些数据**。
> 与商店上架材料 [store-listing.md](store-listing.md) 的「无遥测」表述必须一致；两者冲突以本文为准并同步修订商店材料。

## 结论先行

1. **官网层已在采集**：Cloudflare Web Analytics 已接入落地页（`docs/index.html` 的 `data-cf-beacon` 片段），当前能拿到的是**自动指标**——访问量、页面浏览量、加载耗时、Core Web Vitals，以及国家 / 来源 / 设备 / 浏览器等维度。无需 cookie、无需登录、无跨站追踪。
2. **官网层拿不到的是自定义事件**：CTA 点击、下载、FAQ 展开这类"用户主动做了什么"的数据，Web Analytics **不提供**——自定义事件属于 Cloudflare Zaraz（`zaraz.track()`），且要求站点 DNS 走 Cloudflare 代理。当前 `hotrank` 记录是 `proxied: false`，所以这条路暂时不通。
3. **扩展层当前零遥测**：扩展不向任何自有服务上报数据，权限只有 `storage` / `alarms` / `notifications`，网络访问限 `github.com` 与 `api.github.com`。这一条已写进商店材料与隐私政策，是对外承诺，不是实现细节。
4. **推荐路径（当前）**：官网维持 Web Analytics 自动指标 + 扩展维持零遥测。理由是收益/成本比最高：不需要改 DNS 状态、不需要新增后端、不需要动商店材料，代价是拿不到自定义事件。
5. **升级触发条件**：当"用户到底点了哪个 CTA / 哪些功能真的被用"成为产品决策瓶颈时，再按下面路径 C→A→B 逐级升级，每级都有明确的判定门槛。

## 一、分层现状

| 层 | 采集方式 | 状态 | 采集内容 | 送往 |
|---|---|---|---|---|
| 官网落地页 | Cloudflare Web Analytics（beacon 脚本） | **已上线** | 页面访问、来源、设备、浏览器、耗时、CWV | Cloudflare（cookieless） |
| 扩展 popup | 无 | **零遥测** | — | — |
| 扩展 content script | 无 | **零遥测** | — | — |
| 扩展 background | 无 | **零遥测** | — | — |
| 采集脚本（`scripts/`） | 本地文件 | 开发期工具 | 快照、Δ1 / Δ7 差分 | 仅本机 `data/` |

## 二、官网层：Cloudflare Web Analytics

### 采集方式

落地页 `docs/index.html` 内联一段 `static.cloudflareinsights.com/beacon.min.js`，通过 `data-cf-beacon` 属性带上该站点的公开嵌入标识（这是公开标识，任何访客看源码都能读到，**不是凭据**，不能用于调用 Cloudflare API）。

- **站点已走代理时**：数据发往 `https://<你的域名>/cdn-cgi/rum`。
- **站点未走代理时**（当前状态）：数据发往 `https://cloudflareinsights.com/cdn-cgi/rum`。

两种情况下数据都由 Cloudflare 接收，区别只在于是否经过自己的域名。

### 隐私特性（Cloudflare 官方口径）

- 不使用 cookie，不写 `localStorage`，不做浏览器指纹。
- 不做采样（默认全量）。
- 不收集表单内容、不采集页面上的具体输入值。

### 指标口径

| 指标 | 口径 | 读的时候注意 |
|---|---|---|
| Visits | 一次访问会话 | **referer 主机名与本站不匹配才计一次访问**——从 `github.com` 跳进来的算一次访问，从站内页面互跳不算 |
| Page views | 返回 HTML 且 content-type 正确的一次成功响应 | 静态资源（`.js` / `.css` / `.png`）**不计** |
| Page load time | 首字节到页面加载完成 | 单页站（本站只有一个 `index.html`）只有一种页面时长 |
| Core Web Vitals | LCP / INP / CLS | 另有 LCP / INP 子阶段指标可下钻 |

### 维度口径

| 维度 | 可下钻到 | 用途 |
|---|---|---|
| Country | — | 地域分布 |
| Host | — | 域名级 |
| Path | — | 本站只有 `/` 与 `/#隐私` 等 hash 路径（hash 不单独计数） |
| Referer | referer 主机名 / 路径 | 判断是从 GitHub 仓库页还是搜索来的 |
| Device type | — | desktop / mobile / tablet |
| Browser | — | 浏览器版本 |
| Operating system | — | 系统 |
| Site | — | 站点级对比 |
| Exclude Bots | — | 排除机器人流量 |
| Navigation type | — | 导航类型 |

### 这个口径能回答什么 / 不能回答什么

**能回答**：
- 官网一个月有多少人来过，来自哪个国家 / 哪个浏览器 / 哪个来源站；
- 落地页的加载速度与 Core Web Vitals 表现；
- GitHub 仓库页引流到官网的量级。

**不能回答**：
- 用户点了哪个 CTA（"安装 · 开发者模式" vs "GitHub 仓库 →"）；
- 哪个功能被真正使用（排名列表是否被浏览到第几屏）；
- FAQ 哪一条被展开过；
- 扩展的真实使用量——扩展跑在用户本机，官网统计**完全看不到**扩展行为。

> 最后一条是最容易误判的地方：**官网的访问量 ≠ 扩展的使用量**。两者之间隔着"下载 → 安装 → 打开 popup"这条无法用 Web Analytics 观测的链路。

## 三、为什么拿不到自定义事件

Cloudflare Web Analytics 只提供**自动指标**——它由 Cloudflare 在请求链路上被动采集，不接受业务代码传入的事件。

自定义事件在 Cloudflare 侧的对应产品是 **Zaraz**：

```js
// 仅在站点 DNS 走 Cloudflare 代理、且已启用 Zaraz 时可用
zaraz.track('cta_click', { cta: 'install_dev_mode' });
```

两个前提条件：

1. 站点必须由 Cloudflare 代理（DNS 记录开启代理橙云）；
2. 需要在 Zaraz 里配置事件名与属性（Zaraz 走 Cloudflare 的事件管理，不是 Web Analytics 的自动指标）。

当前 `hotrank` 的 DNS 记录是 CNAME 指向 GitHub Pages 且 **未开代理**，所以：Web Analytics 可用（数据走 `cloudflareinsights.com`），Zaraz 自定义事件不可用。

## 四、三条路径取舍

| 路径 | 能拿到什么 | 前置条件 | 代价 | 适用场景 |
|---|---|---|---|---|
| **C. 只用自动指标**（当前） | 访问量、来源、设备、耗时、CWV | 无 | 零 | 运营够用即可，隐私面最小 |
| **A. 开代理 + Zaraz** | C 的全部 + 任意自定义事件 | DNS 记录状态变更（owner 拍板）、开启代理、启用 Zaraz 并配事件 | TLS 由 Cloudflare 终止；DNS 记录状态变更属对外发布动作；需自行维护事件命名与属性口径 | 需要精确知道 CTA 转化与功能使用 |
| **B. 自建上报端点**（Cloudflare Worker + KV/D1） | 完全自定义的事件与属性 | 部署 Worker、定义数据模型与隐私口径、扩展需新增权限 | 新增后端与数据面；隐私声明要同步改商店材料；多一份要防滥用的责任 | 需要把扩展端行为也纳入统计 |

### 关于"开代理会不会让官网读到旧 HTML"

**不会**——这是常见误解。Cloudflare CDN **默认不缓存 HTML 与 JSON**，默认缓存的是静态资源（图片、CSS、JS 等）。想缓存 HTML 需要主动配置 Cache Rules，而 Cache Rules 本身要求 DNS 记录走代理。

各套餐可用的 Cache Rules 条数：Free 10 条、Pro 25 条、Business 50 条、Enterprise 300 条。

所以路径 A 的真实代价是：**TLS 终止方式变化 + DNS 记录状态变更 + 需要维护 Zaraz 事件定义**，而不是"官网内容变陈旧"。真正要防的是另一件事：一旦配了 Cache Rules 缓存 HTML，那才会引入陈旧内容风险——不配即可。

## 五、扩展层：当前零遥测

### 现状（对外承诺）

- 无账号体系，无遥测，无云端存储；快照与收藏全部存在本机扩展 storage。
- 权限只有 `storage` / `alarms` / `notifications`；host 权限限 `github.com` 与 `api.github.com`。
- 数据不出本机。这条已写进 [store-listing.md](store-listing.md) 的详细描述与权限 justification，并作为隐私政策 URL 的内容基础。

### 如果未来要开遥测，前提条件

1. **默认关闭、显式 opt-in**，且可一键关闭并清除已上报数据。
2. 商店材料与隐私政策同步更新，权限 justification 逐项说明——这是商店审核项，不是可选项。
3. 上报走自有服务（与路线图里的 API 服务同一套后端），不引入第三方分析 SDK。
4. 数据最小化到"能回答产品问题"的最小集合。

### 事件与属性候选表（opt-in 后可上报的最小集合）

| 事件 | 触发时机 | 建议属性 | 用途 |
|---|---|---|---|
| `popup_open` | 打开 popup | `since`（今日/本周/本月）、`lang_filter` 是否为空 | 知道有多少人真的用这个扩展、默认看哪个时间窗 |
| `rank_item_click` | 点击榜单条目 | `rank`（名次区间，不传具体仓库名） | 榜单哪一段被真的点开 |
| `favorite_add` / `favorite_remove` | 收藏 / 取消收藏 | `count_bucket`（1-5 / 6-20 / 20+） | 收藏功能的采纳率 |
| `badge_injected` | 仓库页注入徽章成功 | `position`（名次区间） | 徽章功能的实际触发场景 |
| `notification_shown` | 推送突变提醒 | `threshold_bucket` | 突变阈值是否设得太敏感 |
| `api_call_result` | 调用榜单接口 | `status`（ok / error）、`duration_bucket` | 服务端可用性监控（这个更适合放服务端日志而非客户端上报） |

### 明确禁报（红线）

- GitHub 用户名、账号标识、邮箱。
- `GITHUB_TOKEN` 或任何凭据的任何片段——包括长度、前缀、后缀。
- 完整仓库全名（`owner/repo`）——除非用户显式 opt-in **且**该字段仅用于用户自己的个性化展示，不进任何聚合统计。
- 设备指纹、浏览器指纹、canvas / 字体 / 硬件特征。
- 含私有路径的完整 URL（GitHub 上的私有仓库路径）。
- 任何用户输入的原文内容（README 正文、issue 正文、评论）。

> 判据一句话：**上报的数据里，任何一条都不能单独还原出一个用户的浏览行为或仓库身份。**

### 数据最小化与保留期

| 数据 | 保留期 | 说明 |
|---|---|---|
| 扩展本地快照（star 数） | 90 天 | 超出后自动清理；增速差分需要连续数据，90 天足够算 Δ7 与月环比 |
| 扩展本地收藏 | 至用户删除 | 用户数据，用户可一键清空全部 |
| 服务端聚合事件（若开） | 按天聚合，180 天 | 只存聚合结果，不存原始事件流 |
| 原始事件日志（若开） | 7 天 | 用于排查异常，之后仅保留聚合值 |
| 官网 Web Analytics | Cloudflare 侧默认保留期（免费套餐 24 个月） | 可在 Cloudflare 后台调短 |

一键清空入口必须在扩展设置里可见，不能只存在于文档里。

## 六、落地顺序与判定门槛

| 阶段 | 动作 | 进入下一阶段的门槛 |
|---|---|---|
| 现在 | 路径 C：官网 Web Analytics + 扩展零遥测 | — |
| +1 | 依据 Referer 维度判断引流来源是否需要优化 | 出现"官网流量高但安装数不明"且自动指标已无法定位问题 |
| +2 | 路径 A：DNS 开代理 + Zaraz 自定义事件 | 需要回答"哪个 CTA 转化更好"超过一个版本周期仍无结论 |
| +3 | 路径 B：自建上报端点 + 扩展 opt-in 遥测 | 产品形态已切到 API 服务 + 薄客户端，服务端已有稳定流量可观测 |

每一级都要重新过一次商店材料与隐私政策的同步修订，不允许"先埋了再说"。

## 七、待拍板项

| # | 事项 | 需要谁拍 | 影响面 |
|---|---|---|---|
| 1 | `hotrank` DNS 记录是否开启 Cloudflare 代理 | owner | 决定 Zaraz 自定义事件是否可用；同时改变 TLS 终止方 |
| 2 | 扩展是否允许开 opt-in 遥测 | owner | 决定商店材料、权限 justification 与隐私政策是否需要修订 |
| 3 | 官网是否需要非自动指标（如 A/B 或"查看 README"外链计数） | owner | 决定是否值得为路径 A 付出代理与 Zaraz 的维护成本 |

## 相关文档

- 上架材料与权限 justification：[store-listing.md](store-listing.md)
- 落地页实现（beacon 片段）：[index.html](index.html)
- 界面设计规范（tokens 真源）：[../DESIGN.md](../DESIGN.md)
