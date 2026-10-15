<div align="center">

```
███████╗ ██████╗ ██████╗ ███████╗██╗  ██╗████████╗ █████╗ ███████╗██╗   ██╗
██╔════╝██╔═████╗██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔══██╗██╔════╝╚██╗ ██╔╝
█████╗  ██║██╔██║██████╔╝█████╗   ╚███╔╝    ██║   ███████║███████╗ ╚████╔╝
██╔══╝  ████╔╝██║██╔══██╗██╔══╝   ██╔██╗    ██║   ██╔══██║╚════██║  ╚██╔╝
██║     ╚██████╔╝██║  ██║███████╗██╔╝ ██╗   ██║   ██║  ██║███████║   ██║
╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝   ╚═╝
```

# cohere-bulk-apikey

**One [Cohere](https://cohere.com) account per API key — sign-up, mailbox confirm, onboarding and the trial key, with every key live-verified (models + chat) before it lands in `keys.txt`.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Verified](https://img.shields.io/badge/keys%20live--verified-15%2F15-2ea043?style=for-the-badge)](#-verified-working--every-key-is-tested)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Quick start](#-quick-start) · [✅ Verified](#-verified-working--every-key-is-tested) · [🤖 Models & free tier](#-models--free-tier) · [🧭 How it works](#-how-it-works) · [⚙️ Options](#️-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Issues](#-issues)

</div>

---

> **Mint as many accounts/keys as you need — there is no cap.** `--count N` (default `30`)
> accepts any N; N accounts, N keys, one account per key.

## ✨ Why this exists

Cohere's free tier lives on the **account**: the console mints one `TRIAL` API key per account
(recorded as **1,000 calls/month per account** while the trial campaign ran), and a production key is a
separate, contract-gated process. So the useful unit is *one account per key*, never many keys from one
account.

Sign-up is small — one email field, one password — but the page only produces a working account when it
runs in a real browser, with everything after the confirmation mail plain HTTP:

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

This tool walks the whole path unattended, over your proxy list, and records a key only after the live
API answers with it.

## 🤖 Models & free tier

A verified key sees the **whole account catalogue — 35 models** on `GET /v1/models`, written to
[`models.json`](models.json) by the first key that passes verification:

| Family | Examples |
| --- | --- |
| Command (chat/generation) | `command-a-03-2025`, `command-a-plus-05-2026`, `command-a-reasoning-08-2025`, `command-a-translate-08-2025`, `command-a-vision-07-2025` |
| Command R | `command-r-08-2024`, `command-r-plus-08-2024`, `command-r7b-12-2024`, `command-r7b-arabic-02-2025` |
| Tiny Aya (small models) | `tiny-aya-earth`, `tiny-aya-fire`, `tiny-aya-global`, `tiny-aya-water` |
| Embed | `embed-v4.0`, `embed-v5.0-pro`, `embed-v5.0-fast`, `embed-english-v3.0`, `embed-multilingual-v3.0` |
| Rerank | `rerank-v4.0-pro`, `rerank-v4.0-fast`, `rerank-v3.5`, `rerank-english-v3.0`, `rerank-multilingual-v3.0` |
| Aya / speech / code | `c4ai-aya-expanse-32b`, `c4ai-aya-vision-32b`, `cohere-transcribe-03-2026`, `north-mini-code-1-0` |

**The free tier is the trial key on the account:** **1,000 API calls per month per account** (the quota
recorded for the campaign; the console at [dashboard.cohere.com](https://dashboard.cohere.com) always
shows your current plan and limits, which Cohere can change). A production key is a separate,
contract-gated process.

**Want more of it?** The quota is per account and this tool's unit is exactly that — `--count N` gives
you N accounts, each with its own trial key and its own monthly call budget. The keys never share a
quota.

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## ✅ Verified working — every key is tested

A key is written to `keys.txt` only after the live API answers with it:

| check | call | expected |
| --- | --- | --- |
| auth + model list | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| real generation | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` with text |

The batch this repository shipped from, measured from the run logs:

| Measurement | Result |
| --- | --- |
| Whole chain | **15 accounts → 15 keys** on 2026-10-14, 19:16–20:07 — register → mail → confirm → onboarding → key |
| Verification | **15/15 live** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Proof policy | a key whose live check does not answer clean is **not** written — the tool prefers a missing key over an unproven one |
| Confirm route | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — the first touch consumes the token and confirms the account |
| Onboarding gate | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, key call `200`; without it the key call answers `401` |

`node cli.js verify --keys keys.txt` reproduces exactly that pair of checks for your own file.

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
node launcher.js                    # interactive menu: mint / finish / verify / settings
node cli.js mint --count 30         # create fresh accounts and mint one key each
node cli.js verify --keys keys.txt  # re-check the keys already on disk

# the sign-up phase drives a real Chrome over CDP — Google Chrome must be installed
```

What lands on disk while it runs:

| Path | Content |
| --- | --- |
| `keys.txt` | the keys, **one per line**, appended the moment a key passes the live check |
| `accounts.json` | one record per account: mailbox, password, key, the exit that minted it |
| `out/` | per-attempt run directories (screenshots + DOM/network dumps), the batch log, exit bookkeeping |
| `models.json` | written by `verify` — the live `GET /v1/models` answer of the first key that verifies |

## 🧭 How it works

Per account, two phases, one fresh mailbox and one fresh exit:

1. **Browser phase** — one isolated Chrome context, pinned to one exit. The register page loads, the
   page's own reCAPTCHA Enterprise challenge resolves, and the in-page `RegisterWithEmail` POST follows.
   The captcha assets are cached on disk once and served to every context from there, so a short-lived
   exit only has to carry the small form page and the POST. If the page transport dies mid-flight, the
   register POST is retried from Node through a rotated exit — that one step is the only one that needs
   an exit to survive.
2. **Post phase** — plain HTTP, exit-rotating, no browser. Read the inbox → resolve the SendGrid
   wrapper from the `Location` header (with a no-follow GET) → consume the confirm link route →
   `AuthV2` bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → live verify → append to
   `keys.txt` and `accounts.json`.

Operational notes:

* **One Chrome per run**, one isolated context per account (its own exit + storage). Several accounts
  can be in flight at once.
* **Runs resume.** The target count is compared against `keys.txt`, so re-running `mint --count N`
  only produces the missing keys.
* **Your own line is never used** for target traffic: an exit is accepted only after an egress check
  (ipify / myip / ifconfig.me), private and CGNAT egress is rejected, and if no exit passes, the run
  waits instead of leaking.
* **`finish` rescues registered accounts** without mail: it signs in with the recorded credentials,
  signs the onboarding agreement and pulls the key — so an account whose mail phase died is not lost.
* Transient `403`s on single console calls are retried on a rotated exit rather than failing the account.

## ⚙️ Options

```bash
node cli.js mint   --count 30        # create fresh accounts and mint one key each
node cli.js finish                   # log in to accounts already created and finish their key
node cli.js verify --keys keys.txt   # re-check keys that are already on disk
node cli.js help                     # tasks and flags
```

| Task | Flags |
| --- | --- |
| `mint` | `--count N` — default `30`, any N |
| `finish` | — |
| `verify` | `--keys <file>` — default `keys.txt` |

Every task module also answers `--help` directly (`node <task-file> --help`).

Prefer a menu? `node launcher.js` offers **mint · finish · verify · settings** — the header shows
how many exits `proxies.txt` holds and how many keys are on disk, and settings (count, concurrency)
persist in `launcher.config.json`.

## 🛰️ Behind a proxy

* `proxies.txt` — one exit per line, `scheme://host:port` with `http` / `socks4` / `socks5`;
  `user:pass@` credentials are supported, `#` starts a comment, and a bare `host:port` defaults to
  `http://`. Blank lines are skipped.
* **Point-of-use preflight:** an exit is used only after it has just carried a real egress check;
  private/CGNAT answers are rejected outright. Target traffic only ever leaves through a pool exit.
* **Exit-rotating phase:** the post phase retries across the whole pool (the confirm route gets 12
  tries), and `verify` rotates exits on `403` while failing a key only on `401`.
* **No account-per-exit rule:** one exit may carry many accounts — in the shipped batch, 5 exits
  carried 15 keys and one of them carried 9.

## 🐞 Issues

Cohere changed the RPC, the confirm route or the sign-up policy? The tool stops at the failing step and
says so. **[Open an issue](https://github.com/F0Rextasy/cohere-bulk-apikey/issues)** with the command
you ran and the exact output — the per-attempt dumps under `out/` (screenshots, DOM and network
records) make failures reproducible without leaking a key. PRs are welcome.

## 📄 License

MIT © 2026 — see [LICENSE](LICENSE). Use it on accounts you are allowed to create.

---

<div align="center">

**Built by F0REXTASY** · [github.com/F0Rextasy](https://github.com/F0Rextasy) · [x.com/bigbullapp](https://x.com/bigbullapp)

</div>
