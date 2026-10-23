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

**자동 생성된 API 키로 Cohere 계정을 대량 생성 — OpenAI 호환 추론 + 9Router 커넥터.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 빠른 시작](#-quick-start) · [🎁 무료 티어](#-free-tier--how-much-you-get) · [🤖 모델](#-models--all-35-of-them) · [🧪 API 사용하기](#-how-to-use-the-api) · [✅ 검증됨](#-verified-working--every-key-is-tested) · [🧭 작동 방식](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ 옵션](#️-cli-options) · [🛰️ 프록시](#️-behind-a-proxy) · [🐞 이슈](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ 이 도구가 존재하는 이유

Cohere의 무료 티어는 **계정**에 달려 있습니다. 콘솔은 계정당 하나의 `TRIAL` API 키를 발급하며(트라이얼 캠페인이 진행되는 동안 **계정당 월 1,000회 호출**로 기록됨), 프로덕션 키는 별도의 계약 기반 절차입니다. 따라서 유용한 단위는 *키당 하나의 계정*이며, 하나의 계정에서 여러 키를 뽑는 방식은 결코 아닙니다.

가입 절차는 작습니다 — 이메일 필드 하나, 비밀번호 하나 — 하지만 이 페이지는 실제 브라우저에서 실행될 때만 작동하는 계정을 만들어내며, 확인 메일 이후의 모든 과정은 평범한 HTTP입니다:

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

## 🎁 무료 티어 — 얼마나 받을 수 있나

Cohere의 무료 티어는 **계정에 딸린 트라이얼 키**입니다 — **계정당 월 1,000회 API 호출**(캠페인 당시 기록된 할당량이며, [dashboard.cohere.com](https://dashboard.cohere.com)의 콘솔은 항상 현재 플랜과 한도를 보여주며, Cohere가 이를 변경할 수 있습니다). 프로덕션 키는 계약 기반입니다.

| 항목 | 값 |
| --- | --- |
| 웰컴 허용량 | 계정당 하나의 `TRIAL` 키 — 월 1,000회 호출(캠페인) |
| 카드 필요 여부 | **아니오** |
| 가입 | 실제 브라우저에서 이메일 + 비밀번호; 링크로 이메일 확인; 온보딩 동의 |
| 확장되는 단위 | **하나의 계정 = 하나의 키** → `--count N`은 N개의 트라이얼 예산 |
| 한도 확인 방법 | [dashboard.cohere.com](https://dashboard.cohere.com) — 플랜 한도의 실시간 소스 |

> 💡 무료 티어는 Cohere가 정하며 변경될 수 있습니다. 실시간 수치는 [cohere.com](https://cohere.com)에서 확인하세요 — 그리고 도구 자체의 게이트가 판단하게 하세요:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 모델 — 35개 전부

검증된 키는 **계정 카탈로그 전체 — 35개 모델**을 `GET /v1/models`에서 볼 수 있으며, 검증을 통과한 첫 번째 키에 의해 [`src/models.json`](src/models.json)에 기록됩니다:

| 패밀리 | 예시 |
| --- | --- |
| Command (chat/generation) | `command-a-03-2025`, `command-a-plus-05-2026`, `command-a-reasoning-08-2025`, `command-a-translate-08-2025`, `command-a-vision-07-2025` |
| Command R | `command-r-08-2024`, `command-r-plus-08-2024`, `command-r7b-12-2024`, `command-r7b-arabic-02-2025` |
| Tiny Aya (소형 모델) | `tiny-aya-earth`, `tiny-aya-fire`, `tiny-aya-global`, `tiny-aya-water` |
| Embed | `embed-v4.0`, `embed-v5.0-pro`, `embed-v5.0-fast`, `embed-english-v3.0`, `embed-multilingual-v3.0` |
| Rerank | `rerank-v4.0-pro`, `rerank-v4.0-fast`, `rerank-v3.5`, `rerank-english-v3.0`, `rerank-multilingual-v3.0` |
| Aya / speech / code | `c4ai-aya-expanse-32b`, `c4ai-aya-vision-32b`, `cohere-transcribe-03-2026`, `north-mini-code-1-0` |

하나의 키에 대한 실시간 프로브:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 API 사용 방법

Cohere API 키(`Bearer <key>`)는 호환 엔드포인트 `https://api.cohere.com/compatibility/v1` — OpenAI 호환 — 과 네이티브 채팅 엔드포인트 `https://api.cohere.com/v1/chat`에 접근합니다. 동일한 키가 둘 다 응답하며, 9Router는 호환 URL을 가리킵니다.

**모든 SDK / curl (호환):**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**네이티브 채팅 (검증기가 사용하는 것):**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 빠른 시작

```bash
git clone https://github.com/F0Rextasy/cohere-bulk-apikey.git
cd cohere-bulk-apikey

# 1) your proxy list, one exit per line (http://, socks5://, socks4:// or bare host:port) — optional
printf 'http://127.0.0.1:8080\n' > proxies.txt   # optional — without a pool the HTTP rails run direct

# 2) mailboxes — a local broker that hands out disposable inboxes over plain HTTP

#    (a Mailtrap-backed broker on :9700 served the shipped batch; an inboxes.com
#     broker on :9701 is the built-in fallback)

# 3) go
node src/launcher.js                    # interactive menu: mint / finish / verify / settings
node src/cli.js mint --count=30         # create fresh accounts and mint one key each
node src/cli.js verify --keys=keys.txt  # re-check the keys already on disk

# the sign-up phase drives a real Chrome over CDP — Google Chrome must be installed
```

실행 중 디스크에 남는 것:

| 경로 | 내용 |
| --- | --- |
| `src/` | 도구 — 저장소 루트에서 `node src/<file>.js`로 실행 (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | 키, **한 줄에 하나씩**, 키가 실시간 검사를 통과하는 즉시 추가됨 |
| `accounts.json` | 계정당 하나의 레코드: 메일박스, 비밀번호, 키, 이를 발급한 exit |
| `out/` | 시도별 실행 디렉터리(스크린샷 + DOM/네트워크 덤프), 배치 로그, exit 부기 |
| `src/models.json` | `verify`가 기록 — 검증을 통과한 첫 번째 키의 실시간 `GET /v1/models` 응답 |

### 🖱️ 런처

런처는 `src/launcher.js`입니다: mint / finish / verify / settings (+ 9Router)에 대한 메뉴입니다. `launcher.config.json`에 `count`/`conc`를 기억하며, 헤더에 `proxies.txt`가 보유한 exit 수와 디스크에 있는 키 수를 표시합니다. `node src/launcher.js --connect-9router`는 로컬 9Router에 키를 등록합니다.

## ✅ 검증됨 — 모든 키가 테스트됩니다

키는 실시간 API가 해당 키로 응답한 후에만 `keys.txt`에 기록됩니다:

| 검사 | 호출 | 기대값 |
| --- | --- | --- |
| 인증 + 모델 목록 | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| 실제 생성 | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | 텍스트와 함께 `200` |

이 저장소가 출시한 배치로, 실행 로그에서 측정한 결과:

| 측정 | 결과 |
| --- | --- |
| 전체 체인 | **각 계정이 자체 키를 발급** 2026-10-14, 19:16–20:07 — register → mail → confirm → onboarding → key |
| 검증 | **검증됨** (`models 200` + `chat 200`, `command-a-03-2025`) |
| 증명 정책 | 실시간 검사가 깔끔하게 응답하지 않는 키는 **기록되지 않음** — 도구는 증명되지 않은 키보다 누락된 키를 선호함 |
| 확인 경로 | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — 첫 번째 접촉이 토큰을 소비함 |
| 온보딩 게이트 | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, 키 호출 `200`; 없으면 `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

> **품질 게이트.** 여기의 모든 키는 `keys.txt`에 기록되기 전에 실시간 `chat-200`을 통과했습니다
> (죽은 키는 절대 출시되지 않습니다). 라우터 콤보도 모델 수준에서 동일한 규칙을 따릅니다: 항목은
> **모델이 `chat-200`으로 응답하고 도구를 호출할 수 있는 경우에만** 추가됩니다 — 도구 지원이 없는 모델,
> 죽은 키 또는 죽은 제공자는 추가되지 않고 제거됩니다. 언제든지 검증 단계를 다시 실행하세요;
> 실패는 보고되며, 결코 숨겨지지 않습니다.

## 🧭 작동 방식

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

계정당 두 단계, 하나의 새 메일박스와 하나의 새 exit:

1. **브라우저 단계** — 하나의 격리된 Chrome 컨텍스트가 하나의 exit에 고정됩니다. 등록 페이지가 로드되고, 페이지 자체의 reCAPTCHA Enterprise 챌린지가 해결되며, 페이지 내 `RegisterWithEmail` POST가 이어집니다. 캡차 자산은 디스크에 한 번 캐시되어 거기서 모든 컨텍스트에 제공되므로, 수명이 짧은 exit은 작은 폼 페이지와 POST만 전달하면 됩니다. 페이지 전송이 도중에 죽으면, 등록 POST는 Node에서 회전된 exit을 통해 재시도됩니다.
2. **포스트 단계** — 평범한 HTTP, exit 회전, 브라우저 없음. 받은편지함 읽기 → `Location` 헤더에서 SendGrid 래퍼 해석(no-follow GET 사용) → 확인 링크 경로 소비 → `AuthV2` bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → 실시간 검증 → `keys.txt`와 `accounts.json`에 추가.

## ⚙️ CLI 옵션

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| 작업 | 플래그 |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (모두 `=` 형식, `--cross` = 상자 교차 확인) |
| `verify` | `--keys=<file>` (기본 `keys.txt`) · `--limit=N` (0 = 전체) |

디스패처의 `help` 작업은 작업 목록을 표시하며, 플래그는 `--name=value`로 읽습니다. `node src/launcher.js`는 mint · finish · verify · settings를 제공합니다 — 헤더는 `proxies.txt`가 보유한 exit 수와 디스크에 있는 키 수를 표시하며, 설정은 `launcher.config.json`에 유지됩니다.

| 환경 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `COHERE_MAILBOX` | loopback broker | 받은편지함 백엔드(설정 시 `emailnator`) |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap inbox | 캡처용 Mailtrap 폴더 |

## 🛰️ 프록시 뒤에서

* `proxies.txt` — 한 줄에 하나의 exit, `scheme://host:port`에 `http` / `socks4` / `socks5`; `user:pass@` 자격 증명이 지원되며, `#`은 주석을 시작하고, 맨 `host:port`는 기본적으로 `http://`입니다. 빈 줄은 건너뜁니다.
* **선택 사항 — 대규모에서 권장(IP별 제한, 차단).** HTTP 레일(`rpc`, `verify`, `recon`, `click-confirm`)은 프록시 없이도 작동합니다: 풀 파일이 없으면 요청이 직접 나가고 실행은 exit을 `direct`로 기록합니다.
* **사용 시점 프리플라이트(풀이 주어진 경우):** exit은 방금 실제 이그레스 검사를 통과한 후에만 사용됩니다; 사설/CGNAT 응답은 즉시 거부됩니다. 브라우저 가입은 여전히 풀을 원합니다 — 대시보드는 IP로 제한되며 발급 경로는 *soaked* exit 위에 구축됩니다(먼저 `probe.js`/`soak.js` 실행).
* **Exit 회전 단계:** 포스트 단계는 전체 풀에 걸쳐 재시도하며(확인 경로는 12회 시도), `verify`는 `403`에서 exit을 회전시키고 `401`에서만 키를 실패 처리합니다.
* **exit당 계정 규칙 없음:** 하나의 exit이 많은 계정을 전달할 수 있습니다 — 출시된 배치에서 5개의 exit이 15개의 키를 전달했고 그중 하나는 9개를 전달했습니다.

## 📄 파일

| 경로 | 내용 |
| --- | --- |
| `keys.txt` | 키, **한 줄에 하나씩**, 키가 실시간 검사를 통과하는 즉시 추가됨 |
| `accounts.json` | 계정당 하나의 레코드: 메일박스, 비밀번호, 키, 이를 발급한 exit |
| `out/` | 시도별 실행 디렉터리(스크린샷 + DOM/네트워크 덤프), 배치 로그, exit 부기 |
| `src/models.json` | `verify`가 기록 — 검증을 통과한 첫 번째 키의 실시간 `GET /v1/models` 응답 |

## 🔌 9Router에 연결

[9Router](https://9router.com)는 자체 호스팅되는 OpenAI 호환 라우터입니다. Cohere는 OpenAI 호환(호환 엔드포인트 `https://api.cohere.ai/compatibility/v1`)이므로, 한 번 등록하고 모든 키를 사용하세요:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt`의 모든 키는 `cohere` 제공자 노드의 하나의 연결이 됩니다(`--api-key <key>`는 대신 단일 키를 등록하고, `--model <id>`는 기본값을 재정의합니다). 그런 다음 9Router 내에서 모델을 선택하세요:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

커넥터를 갱신된 `keys.txt`로 가리켜 더 많은 계정을 추가하세요; 노드와 그 모델 목록은 동일하게 유지됩니다. `node src/launcher.js --connect-9router`는 정확히 이것을 실행하며 먼저 기본 URL과 비밀번호를 묻습니다.

기본값: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔌 OmniRoute에 연결

[OmniRoute](https://omniroute.online)는 자체 호스팅되는 OpenAI 호환 라우터입니다. Cohere는 OpenAI 호환(호환 엔드포인트 `https://api.cohere.ai/compatibility/v1`)이므로, 한 번 등록하고 모든 키를 사용하세요:

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt`의 모든 키는 `cohere` 제공자 노드의 하나의 연결이 됩니다(`--api-key <key>`는 대신 단일 키를 등록하고, `--model <id>`는 기본값을 재정의합니다). 그런 다음 OmniRoute 내에서 모델을 선택하세요:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

커넥터를 갱신된 `keys.txt`로 가리켜 더 많은 계정을 추가하세요; 노드와 그 모델 목록은 동일하게 유지됩니다. `node src/launcher.js --connect-omniroute`는 정확히 이것을 실행하며 먼저 기본 URL과 비밀번호를 묻습니다.

기본값: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 하나의 키로 얻는 것

| | |
| --- | --- |
| 🏢 제공자 | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 제공자가 주는 것 | 계정당 1개의 트라이얼 키(캠페인 진행 시 월 1,000회 호출) — 실제 Chrome + SendGrid 확인 게이트 |
| 🔑 하나의 키로 얻는 것 | 자체 계정에 범위가 지정된 하나의 API 키: 아래 엔드포인트의 35개 모델 ID를, 플랜의 한도 내에서. 할당량은 **계정**에 있으므로, 이 도구가 키당 하나의 계정을 만드는 것입니다 |
| 🌐 API 형태 | OpenAI 호환: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 데이터 | cohere.com과 구성한 받은편지함 백엔드만 접촉됩니다; 키는 사용자의 컴퓨터에 남습니다 |

## 🐞 이슈

Cohere가 RPC, 확인 경로 또는 가입 정책을 변경했나요? 도구는 실패한 단계에서 멈추고 그렇게 알립니다. 실행한 명령과 정확한 출력을 포함하여 **[이슈를 열어주세요](../../issues)** — `out/` 아래의 시도별 덤프(스크린샷, DOM 및 네트워크 기록)는 키를 노출하지 않고 실패를 재현 가능하게 만듭니다. PR을 환영합니다.

## 📄 라이선스

MIT © 2026 — [LICENSE](LICENSE) 참조.

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>