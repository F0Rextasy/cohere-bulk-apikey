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

**APIキーを自動生成してCohereアカウントを一括作成 — OpenAI互換の推論 + 9Routerコネクタ。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 クイックスタート](#-quick-start) · [🎁 無料枠](#-free-tier--how-much-you-get) · [🤖 モデル](#-models--all-35-of-them) · [🧪 APIの使い方](#-how-to-use-the-api) · [✅ 検証済み](#-verified-working--every-key-is-tested) · [🧭 仕組み](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ オプション](#️-cli-options) · [🛰️ プロキシ](#️-behind-a-proxy) · [🐞 問題報告](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ なぜこれが存在するのか

Cohereの無料枠は**アカウント**に紐づきます。コンソールはアカウントごとに1つの`TRIAL` APIキーを発行し（トライアルキャンペーン実施中は**アカウントあたり月1,000コール**として記録）、本番キーは別途、契約審査を経るプロセスです。したがって有用な単位は*キーごとに1アカウント*であり、1つのアカウントから多数のキーを取得することは決してありません。

サインアップは小規模で、メール欄1つとパスワード1つだけですが、このページが実際に機能するアカウントを生成するのは、本物のブラウザで実行されたときだけであり、確認メール以降はすべて平文のHTTPです：

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

## 🎁 無料枠 — どれだけ得られるか

Cohereの無料枠は**アカウント上のトライアルキー**です — **アカウントあたり月1,000 APIコール**（キャンペーン時に記録されたクォータ。[dashboard.cohere.com](https://dashboard.cohere.com)のコンソールには常に現在のプランと制限が表示され、Cohereはこれを変更する可能性があります）。本番キーは契約審査を経る必要があります。

| 項目 | 値 |
| --- | --- |
| ウェルカム枠 | アカウントあたり1つの`TRIAL`キー — 月1,000コール（キャンペーン） |
| カード登録 | **不要** |
| サインアップ | 本物のブラウザでメール + パスワード、リンクによるメール確認、オンボーディング同意 |
| スケールする単位 | **1アカウント = 1キー** → `--count N` はN個のトライアル予算 |
| 制限の確認方法 | [dashboard.cohere.com](https://dashboard.cohere.com) — プラン制限のライブソース |

> 💡 無料枠はCohereが設定するもので、変更される可能性があります。最新の数値は[cohere.com](https://cohere.com)で確認してください — そしてツール自身のゲートに判断を委ねてください：

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 モデル — 全35種

検証済みのキーは**アカウントのカタログ全体 — 35モデル**を`GET /v1/models`で参照でき、検証を通過した最初のキーによって[`src/models.json`](src/models.json)に書き込まれます：

| ファミリー | 例 |
| --- | --- |
| Command (chat/generation) | `command-a-03-2025`, `command-a-plus-05-2026`, `command-a-reasoning-08-2025`, `command-a-translate-08-2025`, `command-a-vision-07-2025` |
| Command R | `command-r-08-2024`, `command-r-plus-08-2024`, `command-r7b-12-2024`, `command-r7b-arabic-02-2025` |
| Tiny Aya (small models) | `tiny-aya-earth`, `tiny-aya-fire`, `tiny-aya-global`, `tiny-aya-water` |
| Embed | `embed-v4.0`, `embed-v5.0-pro`, `embed-v5.0-fast`, `embed-english-v3.0`, `embed-multilingual-v3.0` |
| Rerank | `rerank-v4.0-pro`, `rerank-v4.0-fast`, `rerank-v3.5`, `rerank-english-v3.0`, `rerank-multilingual-v3.0` |
| Aya / speech / code | `c4ai-aya-expanse-32b`, `c4ai-aya-vision-32b`, `cohere-transcribe-03-2026`, `north-mini-code-1-0` |

1つのキーのライブプローブ：

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 APIの使い方

Cohere APIキー（`Bearer <key>`）は互換エンドポイント`https://api.cohere.com/compatibility/v1`（OpenAI互換）と、ネイティブのチャットエンドポイント`https://api.cohere.com/v1/chat`にアクセスできます。同じキーが両方に応答し、9Routerは互換URLを指します。

**任意のSDK / curl（互換）：**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**ネイティブチャット（検証ツールが使用するもの）：**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 クイックスタート

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

実行中にディスクに書き込まれるもの：

| パス | 内容 |
| --- | --- |
| `src/` | ツール本体 — リポジトリのルートから`node src/<file>.js`として実行（`src/launcher.js`、`src/cli.js`） |
| `keys.txt` | キー、**1行に1つ**、キーがライブチェックを通過した瞬間に追記 |
| `accounts.json` | アカウントごとに1レコード：メールボックス、パスワード、キー、それを発行した出口 |
| `out/` | 試行ごとの実行ディレクトリ（スクリーンショット + DOM/ネットワークダンプ）、バッチログ、出口の記録 |
| `src/models.json` | `verify`によって書き込まれる — 検証を通過した最初のキーのライブ`GET /v1/models`応答 |

### 🖱️ ランチャー

ランチャーは`src/launcher.js`です：mint / finish / verify / settings（+ 9Router）のメニューです。`count`/`conc`を`launcher.config.json`に記憶し、ヘッダーに`proxies.txt`が保持する出口の数とディスク上のキーの数を表示します。`node src/launcher.js --connect-9router`はローカルの9Routerにキーを登録します。

## ✅ 動作検証済み — すべてのキーがテストされる

キーが`keys.txt`に書き込まれるのは、ライブAPIがそのキーで応答した後のみです：

| チェック | 呼び出し | 期待値 |
| --- | --- | --- |
| 認証 + モデル一覧 | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| 実際の生成 | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | テキスト付きの`200` |

このリポジトリが出荷したバッチ、実行ログから測定：

| 測定項目 | 結果 |
| --- | --- |
| チェーン全体 | **各アカウントが自身のキーを発行** 2026-10-14、19:16–20:07 — 登録 → メール → 確認 → オンボーディング → キー |
| 検証 | **動作検証済み**（`models 200` + `chat 200`、`command-a-03-2025`） |
| 証明ポリシー | ライブチェックがクリーンに応答しないキーは**書き込まれない** — ツールは証明されていないキーよりも欠落したキーを選ぶ |
| 確認ルート | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — 最初のタッチでトークンが消費される |
| オンボーディングゲート | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`、`accessType=FULL`、キー呼び出し`200`；これがないと`401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

> **品質ゲート。** ここにあるすべてのキーは、`keys.txt`に書き込まれる前にライブの`chat-200`を通過しています
> （死んだキーは決して出荷されません）。ルーターのコンボもモデルレベルで同じルールに従います：エントリが
> 追加されるのは**モデルが`chat-200`に応答し、ツールを呼び出せる場合のみ**です — ツールサポートのないモデル、
> 死んだキー、死んだプロバイダは追加されずに除外されます。検証ステップはいつでも再実行できます；
> 失敗は報告され、決して隠されません。

## 🧭 仕組み

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

アカウントごとに、2つのフェーズ、1つの新しいメールボックス、1つの新しい出口：

1. **ブラウザフェーズ** — 1つの分離されたChromeコンテキストを1つの出口に固定します。登録ページが読み込まれ、ページ自身のreCAPTCHA Enterpriseチャレンジが解決され、ページ内の`RegisterWithEmail` POSTが続きます。キャプチャアセットは一度ディスクにキャッシュされ、そこからすべてのコンテキストに提供されるため、短命な出口は小さなフォームページとPOSTだけを運べばよいのです。ページのトランスポートが途中で死んだ場合、登録POSTはNodeからローテーションされた出口を経由して再試行されます。
2. **ポストフェーズ** — 平文HTTP、出口ローテーション、ブラウザなし。受信箱を読む → `Location`ヘッダーからSendGridラッパーを解決する（フォローなしGETで） → 確認リンクルートを消費する → `AuthV2`ベアラー → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → ライブ検証 → `keys.txt`と`accounts.json`に追記。

## ⚙️ CLIオプション

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| タスク | フラグ |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (すべて`=`形式、`--cross` = ボックスのクロスチェック) |
| `verify` | `--keys=<file>` (デフォルト`keys.txt`) · `--limit=N` (0 = すべて) |

ディスパッチャの`help`タスクはタスクを一覧表示します；フラグは`--name=value`として読み取られます。`node src/launcher.js`はmint · finish · verify · settingsを提供します — ヘッダーには`proxies.txt`が保持する出口の数とディスク上のキーの数が表示され、設定は`launcher.config.json`に永続化されます。

| 環境変数 | デフォルト | 意味 |
| --- | --- | --- |
| `COHERE_MAILBOX` | ループバックブローカー | 受信箱バックエンド（設定時は`emailnator`） |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap受信箱 | キャプチャ用のMailtrapフォルダ |

## 🛰️ プロキシの背後で

* `proxies.txt` — 1行に1つの出口、`scheme://host:port`で`http` / `socks4` / `socks5`；`user:pass@`認証情報をサポート、`#`はコメントを開始、素の`host:port`はデフォルトで`http://`になります。空行はスキップされます。
* **オプション — 大規模時に推奨（IPごとの制限、BAN）。** HTTPレール（`rpc`、`verify`、`recon`、`click-confirm`）はプロキシなしでも動作します：プールファイルがなければリクエストは直接送信され、実行は出口を`direct`として記録します。
* **使用時プリフライト（プールが指定された場合）：** 出口は、実際のegressチェックを直前に通過した後にのみ使用されます；プライベート/CGNATの応答は即座に拒否されます。ブラウザサインアップには依然としてプールが必要です — ダッシュボードはIPで制限されており、mintパスは*ソーク済み*の出口上に構築されています（先に`probe.js`/`soak.js`を実行してください）。
* **出口ローテーションフェーズ：** ポストフェーズはプール全体で再試行し（確認ルートは12回試行）、`verify`は`403`で出口をローテーションし、`401`でのみキーを失敗とします。
* **出口ごとのアカウントルールなし：** 1つの出口が多数のアカウントを運ぶことができます — 出荷されたバッチでは、5つの出口が15のキーを運び、そのうちの1つが9つを運びました。

## 📄 ファイル

| パス | 内容 |
| --- | --- |
| `keys.txt` | キー、**1行に1つ**、キーがライブチェックを通過した瞬間に追記 |
| `accounts.json` | アカウントごとに1レコード：メールボックス、パスワード、キー、それを発行した出口 |
| `out/` | 試行ごとの実行ディレクトリ（スクリーンショット + DOM/ネットワークダンプ）、バッチログ、出口の記録 |
| `src/models.json` | `verify`によって書き込まれる — 検証を通過した最初のキーのライブ`GET /v1/models`応答 |

## 🔌 9Routerへの接続

[9Router](https://9router.com)はセルフホスト型のOpenAI互換ルーターです。CohereはOpenAI互換（互換エンドポイント`https://api.cohere.ai/compatibility/v1`）なので、一度登録すればすべてのキーを使用できます：

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt`のすべてのキーが`cohere`プロバイダノードの1つの接続になります（`--api-key <key>`は代わりに単一のキーを登録し、`--model <id>`はデフォルトを上書きします）。その後、9Router内でモデルを選択します：

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

コネクタを更新された`keys.txt`に向けてさらにアカウントを追加します；ノードとそのモデル一覧は同じままです。`node src/launcher.js --connect-9router`はまさにこれを実行し、最初にベースURLとパスワードを尋ねます。

デフォルト：`--base http://localhost:20128`、`--password 123456`、`--name Cohere`、`--prefix cohere`、`--base-url https://api.cohere.ai/compatibility/v1`、`--model command-a-03-2025`。

## 🔌 OmniRouteへの接続

[OmniRoute](https://omniroute.online)はセルフホスト型のOpenAI互換ルーターです。CohereはOpenAI互換（互換エンドポイント`https://api.cohere.ai/compatibility/v1`）なので、一度登録すればすべてのキーを使用できます：

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt`のすべてのキーが`cohere`プロバイダノードの1つの接続になります（`--api-key <key>`は代わりに単一のキーを登録し、`--model <id>`はデフォルトを上書きします）。その後、OmniRoute内でモデルを選択します：

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

コネクタを更新された`keys.txt`に向けてさらにアカウントを追加します；ノードとそのモデル一覧は同じままです。`node src/launcher.js --connect-omniroute`はまさにこれを実行し、最初にベースURLとパスワードを尋ねます。

デフォルト：`--base http://localhost:20128`、`--password 123456`、`--name Cohere`、`--prefix cohere`、`--base-url https://api.cohere.ai/compatibility/v1`、`--model command-a-03-2025`。

## 🔑 1つのキーで得られるもの

| | |
| --- | --- |
| 🏢 プロバイダ | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 プロバイダが提供するもの | アカウントあたり1つのトライアルキー（キャンペーン実施時は月1,000コール） — 本物のChrome + SendGrid確認ゲート |
| 🔑 1つのキーで得られるもの | 自身のアカウントにスコープされた1つのAPIキー：以下のエンドポイントにある35のモデルIDを、プランの制限内で。クォータは**アカウント**に紐づくため、このツールがキーごとに1アカウントを作成するのはまさにそのためです |
| 🌐 APIの形式 | OpenAI互換：`POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 あなたのデータ | 接触するのはcohere.comと設定した受信箱バックエンドのみ；キーはあなたのマシンに留まります |

## 🐞 問題報告

CohereがRPC、確認ルート、またはサインアップポリシーを変更しましたか？ツールは失敗したステップで停止し、その旨を報告します。実行したコマンドと正確な出力を添えて**[issueを開いてください](../../issues)** — `out/`以下の試行ごとのダンプ（スクリーンショット、DOM、ネットワーク記録）により、キーを漏らすことなく失敗を再現できます。PRも歓迎します。

## 📄 ライセンス

MIT © 2026 — [LICENSE](LICENSE)を参照。

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>