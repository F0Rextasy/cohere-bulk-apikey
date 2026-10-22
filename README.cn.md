<div align="center">

```
 ██████╗ ██████╗ ██╗  ██╗███████╗██████╗ ███████╗
██╔════╝██╔═══██╗██║  ██║██╔════╝██╔══██╗██╔════╝
██║     ██║   ██║███████║█████╗  ██████╔╝█████╗
██║     ██║   ██║██╔══██║██╔══╝  ██╔══██╗██╔══╝
╚██████╗╚██████╔╝██║  ██║███████╗██║  ██║███████╗
 ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝
```

# cohere-bulk-apikey

**批量创建带自动生成 API 密钥的 Cohere 账户——兼容 OpenAI 的推理 + 9Router 连接器。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 快速开始](#-quick-start) · [🎁 免费额度](#-free-tier--how-much-you-get) · [🤖 模型](#-models--all-35-of-them) · [🧪 使用 API](#-how-to-use-the-api) · [✅ 已验证](#-verified-working--every-key-is-tested) · [🧭 工作原理](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ 选项](#️-cli-options) · [🛰️ 代理](#️-behind-a-proxy) · [🐞 问题](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ 为什么有这个项目

Cohere 的免费额度存在于**账户**上：控制台会为每个账户生成一个 `TRIAL` API 密钥（在试用活动期间记录为**每账户每月 1,000 次调用**），而生产密钥是一个单独的、受合同限制的流程。因此有用的单位是*每个密钥一个账户*，绝不是一个账户生成多个密钥。

注册流程很小——一个邮箱字段、一个密码——但页面只有在真实浏览器中运行时才会生成可用账户，而确认邮件之后的所有环节都是普通 HTTP：

```
proxies.txt ─▶ exit preflight (egress check; CGNAT/own IP rejected)
                    │
                    ▼
  fresh mailbox ──▶ Chrome context pinned to one exit
                    ├─ register page (the small SSR form)
                    └─ RegisterWithEmail  → 200
                                  │
   mail (SendGrid click-tracking) ─▶ Location ─▶ /confirm-email?token=…
                                  │                └─ 307 ─▶ /api/auth/confirm_email  (first touch consumes it)
                                  ▼
            AuthV2 bearer ─▶ AgreeToOnboarding(PROFILE_SETUP) ─▶ GetOrCreateDefaultAPIKey
                                  │
        GET /v1/models 200 + POST /v1/chat 200  ◀── live verification ──┘
                                  ▼
                               keys.txt
```

## 🎁 免费额度——你能获得多少

Cohere 的免费额度是**账户上的试用密钥**——**每账户每月 1,000 次 API 调用**（活动期间记录下来的配额；[dashboard.cohere.com](https://dashboard.cohere.com) 的控制台始终会显示你当前的计划和限制，Cohere 可能会更改这些内容）。生产密钥受合同限制。

| 项目 | 值 |
| --- | --- |
| 欢迎额度 | 每个账户一个 `TRIAL` 密钥——每月 1,000 次调用（活动） |
| 需要银行卡 | **不需要** |
| 注册 | 在真实浏览器中使用邮箱 + 密码；通过链接确认邮箱；完成入门协议 |
| 可扩展的单位 | **一个账户 = 一个密钥** → `--count N` 就是 N 份试用预算 |
| 如何查看你的限制 | [dashboard.cohere.com](https://dashboard.cohere.com)——计划限制的实时来源 |

> 💡 免费额度由 Cohere 设定，并且可能会变化。请在 [cohere.com](https://cohere.com) 查看实时数字——并让工具自身的校验来决定：

```bash
node src/cli.js verify --keys=keys.txt     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 模型——全部 35 个

一个通过验证的密钥会在 `GET /v1/models` 上看到**整个账户目录——35 个模型**，由第一个通过验证的密钥写入 [`src/models.json`](src/models.json)：

实时聊天探测（2026-10-19，2 个密钥）在这些 17 个 id 上返回 `200`；其余目录条目是兼容端点不提供的 embedding / rerank / transcribe id：

|模型|✓|
|---|---|
|`command-a-03-2025`|✓|
|`c4ai-aya-expanse-32b`|✓|
|`c4ai-aya-vision-32b`|✓|
|`command-a-plus-05-2026`|✓|
|`command-a-reasoning-08-2025`|✓|
|`command-a-translate-08-2025`|✓|
|`command-a-vision-07-2025`|✓|
|`command-r-08-2024`|✓|
|`command-r-plus-08-2024`|✓|
|`command-r7b-12-2024`|✓|
|`command-r7b-arabic-02-2025`|✓|
|`north-mini-code-1-0`|✓|
|`north-small-translate-09-2026`|✓|
|`tiny-aya-earth`|✓|
|`tiny-aya-fire`|✓|
|`tiny-aya-global`|✓|
|`tiny-aya-water`|✓|

对一个密钥进行实时探测：

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 如何使用 API

Cohere API 密钥（`Bearer <key>`）可访问兼容端点 `https://api.cohere.com/compatibility/v1`——兼容 OpenAI——以及原生聊天端点 `https://api.cohere.com/v1/chat`。同一个密钥对两者都有效；9Router 指向兼容 URL。

**任何 SDK / curl（兼容端点）：**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**原生聊天（验证器使用的端点）：**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 快速开始

```bash
git clone https://github.com/F0Rextasy/cohere-bulk-apikey.git
cd cohere-bulk-apikey

# 1) your proxy list, one exit per line (http://, socks5://, socks4:// or bare host:port)
printf 'http://127.0.0.1:8080\n' > proxies.txt

# 2) mailboxes — a local broker that hands out disposable inboxes over plain HTTP

#    (a Mailtrap-backed broker on :9700 served the shipped batch; an inboxes.com
#     broker on :9701 is the built-in fallback)

# 3) go
node src/launcher.js                    # interactive menu: mint / finish / verify / settings
node src/cli.js mint --count=30         # create fresh accounts and mint one key each
node src/cli.js verify --keys=keys.txt  # re-check the keys already on disk

# the sign-up phase drives a real Chrome over CDP — Google Chrome must be installed
```

运行过程中会写入磁盘的内容：

| 路径 | 内容 |
| --- | --- |
| `src/` | 该工具——从仓库根目录以 `node src/<file>.js` 运行（`src/launcher.js`、`src/cli.js`） |
| `keys.txt` | 密钥，**每行一个**，在密钥通过实时检查的那一刻追加 |
| `accounts.json` | 每个账户一条记录：邮箱、密码、密钥、生成该密钥的出口 |
| `out/` | 每次尝试的运行目录（截图 + DOM/网络转储）、批处理日志、出口记录 |
| `src/models.json` | 由 `verify` 写入——第一个通过验证的密钥的实时 `GET /v1/models` 响应 |

### 🖱️ 启动器

启动器是 `src/launcher.js`：一个覆盖 mint / finish / verify / settings（+ 9Router）的菜单。它会在 `launcher.config.json` 中记住 `count`/`conc`，并在标题栏显示 `proxies.txt` 中有多少个出口以及磁盘上有多少个密钥。`node src/launcher.js --connect-9router` 会将密钥注册到本地 9Router。

## ✅ 已验证可用——每个密钥都会测试

只有当实时 API 使用某个密钥成功响应后，该密钥才会写入 `keys.txt`：

| 检查 | 调用 | 预期 |
| --- | --- | --- |
| 认证 + 模型列表 | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| 真实生成 | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` 且带文本 |

本仓库发布时所用的批次，根据运行日志统计：

| 测量项 | 结果 |
| --- | --- |
| 完整链路 | **15 个账户 → 15 个密钥**，2026-10-14，19:16–20:07——注册 → 邮件 → 确认 → 入门 → 密钥 |
| 验证 | **15/15 实时通过**（`models 200` + `chat 200`，`command-a-03-2025`） |
| 证明策略 | 实时检查未干净响应的密钥**不会**写入——该工具宁可缺少密钥，也不愿写入未经验证的密钥 |
| 确认路由 | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…`——第一次访问即消耗该 token |
| 入门门槛 | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, key call `200`；没有它则 `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

## 🧭 工作原理

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

每个账户分两个阶段，使用一个全新邮箱和一个全新出口：

1. **浏览器阶段**——一个隔离的 Chrome 上下文，固定到一个出口。注册页面加载，页面自身的 reCAPTCHA Enterprise 挑战完成，随后执行页面内的 `RegisterWithEmail` POST。验证码资源会缓存到磁盘一次，之后从那里提供给每个上下文，因此短寿命出口只需承载小型表单页面和该 POST。如果页面传输在中途中断，则通过轮换出口从 Node 重试注册 POST。
2. **后处理阶段**——普通 HTTP、轮换出口、无浏览器。读取收件箱 → 从 `Location` 头解析 SendGrid 包装链接（使用不跟随重定向的 GET）→ 消耗确认链接路由 → `AuthV2` bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → 实时验证 → 追加到 `keys.txt` 和 `accounts.json`。

## ⚙️ CLI 选项

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| 任务 | 参数 |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>`（均为 `=` 形式，`--cross` = 交叉检查该邮箱盒） |
| `verify` | `--keys=<file>`（默认 `keys.txt`）· `--limit=N`（0 = 全部） |

建议使用 Turbo（5）；更多并发会在性能较弱的电脑上带来负载/封禁风险。

调度器的 `help` 任务会列出所有任务；参数按 `--name=value` 读取。`node src/launcher.js` 提供 mint · finish · verify · settings——标题栏会显示 `proxies.txt` 中有多少个出口以及磁盘上有多少个密钥，设置会持久化到 `launcher.config.json`。

| 环境变量 | 默认值 | 含义 |
| --- | --- | --- |
| `COHERE_MAILBOX` | loopback broker | 收件箱后端（设置后为 `emailnator`） |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap inbox | 用于捕获的 Mailtrap 文件夹 |

## 🛰️ 在代理之后

* `proxies.txt`——每行一个出口，`scheme://host:port`，支持 `http` / `socks4` / `socks5`；支持 `user:pass@` 凭据，`#` 开始注释，裸 `host:port` 默认使用 `http://`。空行会被跳过。
* **使用前预检：** 只有在出口刚刚完成真实出站检查后才会使用该出口；私有/CGNAT 响应会被直接拒绝。目标流量只会通过池中的出口离开。
* **出口轮换阶段：** 后处理阶段会在整个池中重试（确认路由有 12 次尝试），而 `verify` 会在 `403` 时轮换出口，仅在 `401` 时判定密钥失败。
* **没有每个出口一个账户的规则：** 一个出口可以承载多个账户——在发布的批次中，5 个出口承载了 15 个密钥，其中一个承载了 9 个。

## 📄 文件

| 路径 | 内容 |
| --- | --- |
| `keys.txt` | 密钥，**每行一个**，在密钥通过实时检查的那一刻追加 |
| `accounts.json` | 每个账户一条记录：邮箱、密码、密钥、生成该密钥的出口 |
| `out/` | 每次尝试的运行目录（截图 + DOM/网络转储）、批处理日志、出口记录 |
| `src/models.json` | 由 `verify` 写入——第一个通过验证的密钥的实时 `GET /v1/models` 响应 |

## 🔌 连接到 9Router

[9Router](https://9router.com) 是一个自托管、兼容 OpenAI 的路由器。Cohere 兼容 OpenAI（兼容端点 `https://api.cohere.ai/compatibility/v1`），因此注册一次即可使用每个密钥：

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt` 中的每个密钥都会成为 `cohere` 提供者节点的一个连接（`--api-key <key>` 改为注册单个密钥，`--model <id>` 覆盖默认值）。然后在 9Router 内选择一个模型：

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

将连接器指向刷新后的 `keys.txt` 即可添加更多账户；节点及其模型列表保持不变。`node src/launcher.js --connect-9router` 正是执行此操作，并会先询问基础 URL 和密码。

默认值：`--base http://localhost:20128`、`--password 123456`、`--name Cohere`、`--prefix cohere`、`--base-url https://api.cohere.ai/compatibility/v1`、`--model command-a-03-2025`。

## 🔌 连接到 OmniRoute

[OmniRoute](https://omniroute.online) 是一个自托管、兼容 OpenAI 的路由器。Cohere 兼容 OpenAI（兼容端点 `https://api.cohere.ai/compatibility/v1`），因此注册一次即可使用每个密钥：

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt` 中的每个密钥都会成为 `cohere` 提供者节点的一个连接（`--api-key <key>` 改为注册单个密钥，`--model <id>` 覆盖默认值）。然后在 OmniRoute 内选择一个模型：

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

将连接器指向刷新后的 `keys.txt` 即可添加更多账户；节点及其模型列表保持不变。`node src/launcher.js --connect-omniroute` 正是执行此操作，并会先询问基础 URL 和密码。

默认值：`--base http://localhost:20128`、`--password 123456`、`--name Cohere`、`--prefix cohere`、`--base-url https://api.cohere.ai/compatibility/v1`、`--model command-a-03-2025`。
## 🔑 一个密钥能给你什么

| | |
| --- | --- |
| 🏢 提供商 | **Cohere**——[cohere.com](https://cohere.com) |
| 🎁 提供商提供什么 | 每个账户 1 个试用密钥（活动期间每月 1,000 次调用）——真实 Chrome + SendGrid 确认门槛 |
| 🔑 一个密钥能给你什么 | 一个作用于其自身账户的 API 密钥：下方端点上的 35 个模型 id，受你的计划限制。配额存在于**账户**上，这正是该工具为每个密钥创建一个账户的原因 |
| 🌐 API 形态 | 兼容 OpenAI：`POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 你的数据 | 只会联系 cohere.com 和你配置的收件箱后端；密钥保留在你的机器上 |

## 🐞 问题

Cohere 更改了 RPC、确认路由或注册政策？该工具会停在失败的步骤并说明原因。请**[提交 issue](../../issues)**，附上你运行的命令和确切输出——`out/` 下每次尝试的转储（截图、DOM 和网络记录）可以让故障可复现，同时不会泄露密钥。欢迎 PR。

## 📄 许可证

MIT © 2026——参见 [LICENSE](LICENSE)。

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey 贡献者

</div>