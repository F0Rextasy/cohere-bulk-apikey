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

**批量创建 Cohere 账户并自动生成 API 密钥 — 兼容 OpenAI 的推理 + 9Router 连接器。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 快速开始](#-quick-start) · [🎁 免费额度](#-free-tier--how-much-you-get) · [🤖 模型](#-models--all-35-of-them) · [🧪 使用 API](#-how-to-use-the-api) · [✅ 已验证](#-verified-working--every-key-is-tested) · [🧭 工作原理](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ 选项](#️-cli-options) · [🛰️ 代理](#️-behind-a-proxy) · [🐞 问题反馈](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>


---

## ✨ 为什么需要它

Cohere 的免费额度绑定在**账户**上：控制台为每个账户生成一个 `TRIAL` API 密钥（在试用活动期间记录为**每账户每月 1,000 次调用**），而生产密钥是单独的、需签约的流程。因此有用的单位是*一个账户对应一个密钥*，而不是从一个账户获取多个密钥。

注册流程很小——一个邮箱字段、一个密码——但只有在真实浏览器中运行时页面才会生成可用的账户，且确认邮件之后的一切都是纯 HTTP：

```
proxies.txt ─▶ 出口预检（出站检查；拒绝 CGNAT/自有 IP）
                    │
                    ▼
  全新邮箱 ──▶ Chrome 上下文固定到单一出口
                    ├─ 注册页面（小型 SSR 表单）
                    └─ RegisterWithEmail  → 200
                                  │
   邮件（SendGrid 点击跟踪）─▶ Location ─▶ /confirm-email?token=…
                                  │                └─ 307 ─▶ /api/auth/confirm_email  （首次访问即消耗）
                                  ▼
            AuthV2 bearer ─▶ AgreeToOnboarding(PROFILE_SETUP) ─▶ GetOrCreateDefaultAPIKey
                                  │
        GET /v1/models 200 + POST /v1/chat 200  ◀── 实时验证 ──┘
                                  ▼
                               keys.txt
```

## 🎁 免费额度 — 你能获得多少

Cohere 的免费额度是**账户上的试用密钥**——**每账户每月 1,000 次 API 调用**（活动期间记录的配额；[dashboard.cohere.com](https://dashboard.cohere.com) 上的控制台始终显示你当前的套餐和限制，Cohere 可能会更改）。生产密钥需签约。

| 项目 | 值 |
| --- | --- |
| 欢迎额度 | 每账户一个 `TRIAL` 密钥 — 每月 1,000 次调用（活动） |
| 需要信用卡 | **否** |
| 注册 | 在真实浏览器中输入邮箱 + 密码；通过链接确认邮箱；同意引导协议 |
| 可扩展的单位 | **一个账户 = 一个密钥** → `--count N` 即 N 份试用预算 |
| 如何查看你的限制 | [dashboard.cohere.com](https://dashboard.cohere.com) — 套餐限制的实时来源 |

> 💡 免费额度由 Cohere 设定，可能会变化。请在 [cohere.com](https://cohere.com) 查看实时数字——并让工具自身的关卡来判定：

```bash
node src/cli.js verify --keys=keys.txt     # keys.txt 中的每个密钥都会用真实聊天调用重新测试
```

## 🤖 模型 — 全部 35 个

一个已验证的密钥可以看到**整个账户目录——35 个模型**，通过 `GET /v1/models` 获取，由第一个通过验证的密钥写入 [`src/models.json`](src/models.json)：

|模型|✓|
|---|---|
|`command-a-03-2025`|✓|

单个密钥的实时探测：

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 如何使用 API

Cohere API 密钥（`Bearer <key>`）可访问兼容端点 `https://api.cohere.com/compatibility/v1`——兼容 OpenAI——以及原生聊天端点 `https://api.cohere.com/v1/chat`。同一个密钥对两者都有效；9Router 指向兼容 URL。

**任意 SDK / curl（兼容模式）：**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**原生聊天（验证器使用的）：**

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

运行过程中写入磁盘的内容：

| 路径 | 内容 |
| --- | --- |
| `src/` | 工具本体——从仓库根目录以 `node src/<file>.js` 运行（`src/launcher.js`、`src/cli.js`） |
| `keys.txt` | 密钥，**每行一个**，在密钥通过实时检查的那一刻追加 |
| `accounts.json` | 每个账户一条记录：邮箱、密码、密钥、生成它的出口 |
| `out/` | 每次尝试的运行目录（截图 + DOM/网络转储）、批次日志、出口记账 |
| `src/models.json` | 由 `verify` 写入——第一个通过验证的密钥的实时 `GET /v1/models` 响应 |

### 🖱️ 启动器

启动器是 `src/launcher.js`：一个覆盖 mint / finish / verify / settings（+ 9Router）的菜单。它会在 `launcher.config.json` 中记住 `count`/`conc`，并在头部显示 `proxies.txt` 中有多少出口以及磁盘上有多少密钥。`node src/launcher.js --connect-9router` 会将密钥注册到本地 9Router。

## ✅ 已验证可用 — 每个密钥都经过测试

只有当实时 API 用密钥成功应答后，密钥才会写入 `keys.txt`：

| 检查 | 调用 | 预期 |
| --- | --- | --- |
| 认证 + 模型列表 | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| 真实生成 | `POST https://api.cohere.com/v1/chat`（`command-a-03-2025`） | `200` 且带文本 |

本仓库发布时所依据的批次，根据运行日志统计：

| 测量项 | 结果 |
| --- | --- |
| 完整链路 | **15 个账户 → 15 个密钥**，2026-10-14，19:16–20:07 — 注册 → 邮件 → 确认 → 引导 → 密钥 |
| 验证 | **15/15 实时**（`models 200` + `chat 200`，`command-a-03-2025`） |
| 证明策略 | 实时检查未干净应答的密钥**不会**被写入——工具宁可缺少密钥，也不写入未经验证的密钥 |
| 确认路由 | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — 首次访问即消耗令牌 |
| 引导关卡 | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`、`accessType=FULL`、密钥调用 `200`；没有它则 `401` |

```bash
node src/cli.js verify --keys=keys.txt    # 为你自己的文件重现这两项检查
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

1. **浏览器阶段** — 一个隔离的 Chrome 上下文，固定到一个出口。注册页面加载，页面自身的 reCAPTCHA Enterprise 挑战完成，随后是页面内的 `RegisterWithEmail` POST。验证码资源在磁盘上缓存一次，之后提供给每个上下文，因此短命出口只需承载小型表单页面和该 POST。如果页面传输中途中断，注册 POST 会从 Node 通过轮换的出口重试。
2. **后置阶段** — 纯 HTTP，出口轮换，无浏览器。读取收件箱 → 从 `Location` 头解析 SendGrid 包装（使用不跟随的 GET）→ 消耗确认链接路由 → `AuthV2` bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → 实时验证 → 追加到 `keys.txt` 和 `accounts.json`。

## ⚙️ CLI 选项

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| 任务 | 标志 |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>`（均为 `=` 形式，`--cross` = 交叉检查邮箱） |
| `verify` | `--keys=<file>`（默认 `keys.txt`）· `--limit=N`（0 = 全部） |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

调度器的 `help` 任务列出所有任务；标志以 `--name=value` 形式读取。`node src/launcher.js` 提供 mint · finish · verify · settings——头部显示 `proxies.txt` 中有多少出口以及磁盘上有多少密钥，设置持久化在 `launcher.config.json` 中。

| 环境变量 | 默认值 | 含义 |
| --- | --- | --- |
| `COHERE_MAILBOX` | 回环代理 | 收件箱后端（设置后为 `emailnator`） |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap 收件箱 | 用于捕获的 Mailtrap 文件夹 |

## 🛰️ 在代理后面

* `proxies.txt` — 每行一个出口，`scheme://host:port`，支持 `http` / `socks4` / `socks5`；支持 `user:pass@` 凭据，`#` 开始注释，裸 `host:port` 默认为 `http://`。空行会被跳过。
* **使用点预检：** 出口只有在刚刚承载过真实出站检查后才会被使用；私有/CGNAT 应答会被直接拒绝。目标流量只会通过池中出口离开。
* **出口轮换阶段：** 后置阶段在整个池中重试（确认路由有 12 次尝试），`verify` 在 `403` 时轮换出口，仅在 `401` 时判定密钥失败。
* **无每出口一账户规则：** 一个出口可以承载多个账户——在发布的批次中，5 个出口承载了 15 个密钥，其中一个承载了 9 个。

## 📄 文件

| 路径 | 内容 |
| --- | --- |
| `keys.txt` | 密钥，**每行一个**，在密钥通过实时检查的那一刻追加 |
| `accounts.json` | 每个账户一条记录：邮箱、密码、密钥、生成它的出口 |
| `out/` | 每次尝试的运行目录（截图 + DOM/网络转储）、批次日志、出口记账 |
| `src/models.json` | 由 `verify` 写入——第一个通过验证的密钥的实时 `GET /v1/models` 响应 |

## 🔌 连接到 9Router

[9Router](https://9router.com) 是一个自托管、兼容 OpenAI 的路由器。Cohere 兼容 OpenAI（兼容端点 `https://api.cohere.ai/compatibility/v1`），因此注册一次即可使用所有密钥：

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt` 中的每个密钥都会成为 `cohere` 提供商节点的一个连接（`--api-key <key>` 则注册单个密钥，`--model <id>` 覆盖默认值）。然后在 9Router 中选择模型：

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

将连接器指向刷新后的 `keys.txt` 即可添加更多账户；节点及其模型列表保持不变。`node src/launcher.js --connect-9router` 正是运行此操作，并会先询问基础 URL 和密码。

默认值：`--base http://localhost:20128`、`--password 123456`、`--name Cohere`、`--prefix cohere`、`--base-url https://api.cohere.ai/compatibility/v1`、`--model command-a-03-2025`。

## 🔑 一个密钥能给你什么

| | |
| --- | --- |
| 🏢 提供商 | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 提供商提供什么 | 每账户 1 个试用密钥（活动期间每月 1,000 次调用）— 真实 Chrome + SendGrid 确认关卡 |
| 🔑 一个密钥能给你什么 | 一个限定于其自身账户的 API 密钥：下方端点上的 35 个模型 id，按你套餐的限制。配额绑定在**账户**上，这正是本工具为每个密钥创建一个账户的原因 |
| 🌐 API 形态 | 兼容 OpenAI：`POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 你的数据 | 仅联系 cohere.com 和你配置的收件箱后端；密钥保留在你的机器上 |

## 🐞 问题反馈

Cohere 更改了 RPC、确认路由或注册政策？工具会在失败的步骤停下并说明原因。**[提交 issue](../../issues)**，附上你运行的命令和确切输出——`out/` 下的每次尝试转储（截图、DOM 和网络记录）使失败可复现且不会泄露密钥。欢迎 PR。

## 📄 许可证

MIT © 2026 — 见 [LICENSE](LICENSE)。

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>