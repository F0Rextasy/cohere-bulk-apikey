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

**Bulk-create Cohere accounts with auto-generated API keys — OpenAI-compatible inference + 9Router connector.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Quick start](#-quick-start) · [🎁 Free tier](#-free-tier--how-much-you-get) · [🤖 Models](#-models--all-35-of-them) · [🧪 Use the API](#-how-to-use-the-api) · [✅ Verified](#-verified-working--every-key-is-tested) · [🧭 How it works](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Issues](#-issues)

</div>

---

## ✨ Why this exists

Cohere's free tier lives on the **account**: the console mints one `TRIAL` API key per account (recorded as **1,000 calls/month per account** while the trial campaign ran), and a production key is a separate, contract-gated process. So the useful unit is *one account per key*, never many keys from one account.

Sign-up is small — one email field, one password — but the page only produces a working account when it runs in a real browser, with everything after the confirmation mail plain HTTP:

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

## 🎁 Free tier — how much you get

Cohere's free tier is the **trial key on the account** — **1,000 API calls per month per account** (the quota recorded for the campaign; the console at [dashboard.cohere.com](https://dashboard.cohere.com) always shows your current plan and limits, which Cohere can change). A production key is contract-gated.

| What | Value |
| --- | --- |
| Welcome allowance | one `TRIAL` key per account — 1,000 calls/month (campaign) |
| Card required | **No** |
| Sign-up | e-mail + password in a real browser; e-mail confirmation by link; onboarding agreement |
| The unit that scales | **one account = one key** → `--count N` is N trial budgets |
| How to see your limits | [dashboard.cohere.com](https://dashboard.cohere.com) — the live source of plan limits |

> 💡 The free tier is set by Cohere and can change. Check the live numbers at [cohere.com](https://cohere.com) — and let the tool's own gate decide:

```bash
node src/cli.js verify --keys=keys.txt     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Models — all 35 of them

A verified key sees the **whole account catalogue — 35 models** on `GET /v1/models`, written to [`src/models.json`](src/models.json) by the first key that passes verification:

| Family | Examples |
| --- | --- |
| Command (chat/generation) | `command-a-03-2025`, `command-a-plus-05-2026`, `command-a-reasoning-08-2025`, `command-a-translate-08-2025`, `command-a-vision-07-2025` |
| Command R | `command-r-08-2024`, `command-r-plus-08-2024`, `command-r7b-12-2024`, `command-r7b-arabic-02-2025` |
| Tiny Aya (small models) | `tiny-aya-earth`, `tiny-aya-fire`, `tiny-aya-global`, `tiny-aya-water` |
| Embed | `embed-v4.0`, `embed-v5.0-pro`, `embed-v5.0-fast`, `embed-english-v3.0`, `embed-multilingual-v3.0` |
| Rerank | `rerank-v4.0-pro`, `rerank-v4.0-fast`, `rerank-v3.5`, `rerank-english-v3.0`, `rerank-multilingual-v3.0` |
| Aya / speech / code | `c4ai-aya-expanse-32b`, `c4ai-aya-vision-32b`, `cohere-transcribe-03-2026`, `north-mini-code-1-0` |

Live probe of one key:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 How to use the API

The Cohere API key (`Bearer <key>`) reaches the compatibility endpoint `https://api.cohere.com/compatibility/v1` — OpenAI-compatible — and the native chat endpoint `https://api.cohere.com/v1/chat`. The same key answers both; 9Router is pointed at the compatibility URL.

**Any SDK / curl (compatibility):**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**Native chat (what the verifier uses):**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 Quick start

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

What lands on disk while it runs:

| Path | Content |
| --- | --- |
| `src/` | the tool — run it as `node src/<file>.js` from the repository root (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | the keys, **one per line**, appended the moment a key passes the live check |
| `accounts.json` | one record per account: mailbox, password, key, the exit that minted it |
| `out/` | per-attempt run directories (screenshots + DOM/network dumps), the batch log, exit bookkeeping |
| `src/models.json` | written by `verify` — the live `GET /v1/models` answer of the first key that verifies |

### 🖱️ The launcher

The launcher is `src/launcher.js`: a menu over mint / finish / verify / settings (+ 9Router). It remembers `count`/`conc` in `launcher.config.json` and shows how many exits `proxies.txt` holds and how many keys are on disk in the header. `node src/launcher.js --connect-9router` registers the keys with a local 9Router.

## ✅ Verified working — every key is tested

A key is written to `keys.txt` only after the live API answers with it:

| check | call | expected |
| --- | --- |
| auth + model list | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| real generation | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` with text |

The batch this repository shipped from, measured from the run logs:

| Measurement | Result |
| --- | --- |
| Whole chain | **15 accounts → 15 keys** on 2026-10-14, 19:16–20:07 — register → mail → confirm → onboarding → key |
| Verification | **15/15 live** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Proof policy | a key whose live check does not answer clean is **not** written — the tool prefers a missing key over an unproven one |
| Confirm route | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — the first touch consumes the token |
| Onboarding gate | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, key call `200`; without it `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

## 🧭 How it works

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

Per account, two phases, one fresh mailbox and one fresh exit:

1. **Browser phase** — one isolated Chrome context, pinned to one exit. The register page loads, the page's own reCAPTCHA Enterprise challenge resolves, and the in-page `RegisterWithEmail` POST follows. The captcha assets are cached on disk once and served to every context from there, so a short-lived exit only has to carry the small form page and the POST. If the page transport dies mid-flight, the register POST is retried from Node through a rotated exit.
2. **Post phase** — plain HTTP, exit-rotating, no browser. Read the inbox → resolve the SendGrid wrapper from the `Location` header (with a no-follow GET) → consume the confirm link route → `AuthV2` bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → live verify → append to `keys.txt` and `accounts.json`.

## ⚙️ CLI options

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| Task | Flags |
| --- | --- |
| `mint` | `--count N` — default `30`, any N |
| `finish` | — (logs in to already-created accounts and finishes their key) |
| `verify` | `--keys <file>` — default `keys.txt` |

Every task module also answers `--help` directly (`node <task-file> --help`). `node src/launcher.js` offers mint · finish · verify · settings — the header shows how many exits `proxies.txt` holds and how many keys are on disk, and settings persist in `launcher.config.json`.

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `COHERE_MAILBOX` | loopback broker | inbox backend (`emailnator` when set) |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap inbox | Mailtrap folder for captures |

## 🛰️ Behind a proxy

* `proxies.txt` — one exit per line, `scheme://host:port` with `http` / `socks4` / `socks5`; `user:pass@` credentials are supported, `#` starts a comment, and a bare `host:port` defaults to `http://`. Blank lines are skipped.
* **Point-of-use preflight:** an exit is used only after it has just carried a real egress check; private/CGNAT answers are rejected outright. Target traffic only ever leaves through a pool exit.
* **Exit-rotating phase:** the post phase retries across the whole pool (the confirm route gets 12 tries), and `verify` rotates exits on `403` while failing a key only on `401`.
* **No account-per-exit rule:** one exit may carry many accounts — in the shipped batch, 5 exits carried 15 keys and one of them carried 9.

## 📄 Files

| Path | Contents |
| --- | --- |
| `keys.txt` | the keys, **one per line**, appended the moment a key passes the live check |
| `accounts.json` | one record per account: mailbox, password, key, the exit that minted it |
| `out/` | per-attempt run directories (screenshots + DOM/network dumps), the batch log, exit bookkeeping |
| `src/models.json` | written by `verify` — the live `GET /v1/models` answer of the first key that verifies |

## 🔌 Connect to 9Router

[9Router](https://9router.com) is a self-hosted, OpenAI-compatible router. Cohere is OpenAI-compatible (compatibility endpoint `https://api.cohere.ai/compatibility/v1`), so register it once and use every key:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Every key in `keys.txt` becomes one connection of the `cohere` provider node (`--api-key <key>` registers a single key instead, `--model <id>` overrides the default). Then pick a model inside 9Router:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Point the connector at a refreshed `keys.txt` to add more accounts; the node and its model list stay the same. `node src/launcher.js --connect-9router` runs exactly this and asks for the base URL and password first.

Defaults: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 What one key gets you

| | |
| --- | --- |
| 🏢 Provider | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 What the provider gives | 1 trial key per account (1,000 calls/month when the campaign ran) — real Chrome + SendGrid confirm gate |
| 🔑 What one key gets you | one API key scoped to its own account: the 35 model ids on the endpoint below, at your plan's limits. The quota lives on the **account**, which is exactly why this tool creates one account per key |
| 🌐 API shape | OpenAI-compatible: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Your data | only cohere.com and the inbox backend you configure are contacted; keys stay on your machine |

## 🐞 Issues

Cohere changed the RPC, the confirm route or the sign-up policy? The tool stops at the failing step and says so. **[Open an issue](../../issues)** with the command you ran and the exact output — the per-attempt dumps under `out/` (screenshots, DOM and network records) make failures reproducible without leaking a key. PRs are welcome.

## 📄 License

MIT © 2026 — see [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>
