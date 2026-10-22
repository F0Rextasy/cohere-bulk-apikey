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

**Cohere アカウントを一括作成し、API キーを自動生成 — OpenAI 互換の推論 + 9Router コネクタ。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 クイックスタート](#-quick-start) · [🎁 無料枠](#-free-tier--how-much-you-get) · [🤖 モデル](#-models--all-35-of-them) · [🧪 API の使い方](#-how-to-use-the-api) · [✅ 検証済み](#-verified-working--every-key-is-tested) · [🧭 仕組み](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ オプション](#️-cli-options) · [🛰️ プロキシ](#️-behind-a-proxy) · [🐞 問題報告](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ なぜこれが存在するのか

Cohere の無料枠は **アカウント**に紐づきます。コンソールはアカウントごとに `TRIAL` API キーを1つ発行し（トライアルキャンペーン実施中は **アカウントあたり月1,000コール** として記録されていました）、プロダクションキーは別途、契約審査を経るプロセスです。したがって有用な単位は *1アカウントにつき1キー* であり、1つのアカウントから多数のキーを取ることは決してありません。

サインアップ自体は小さなものです — メールアドレス1欄、パスワード1欄 — しかし、そのページが実際に機能するアカウントを生み出すのは、本物のブラウザ上で動いたときだけであり、確認メール以降はすべて素の HTTP です:

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

## 🎁 無料枠 — どれだけ使えるか

Cohere の無料枠とは、**アカウント上のトライアルキー**のことです — **アカウントあたり月1,000 API コール**（キャンペーン時に記録されたクォータ。[dashboard.cohere.com](https://dashboard.cohere.com) のコンソールには常に現在のプランと制限が表示され、Cohere はこれを変更する可能性があります）。プロダクションキーは契約審査が必要です。

| 項目 | 値 |
| --- | --- |
| ウェルカム枠 | アカウントあたり `TRIAL` キー1つ — 月1,000コール（キャンペーン時） |
| カード登録 | **不要** |
| サインアップ | 実ブラウザでメールアドレス＋パスワード。メール確認はリンク方式。オンボーディング同意が必要 |
| スケールする単位 | **1アカウント = 1キー** → `--count N` は N 個分のトライアル枠 |
| 制限の確認方法 | [dashboard.cohere.com](https://dashboard.cohere.com) — プラン制限の最新の情報源 |

> 💡 無料枠は Cohere が定めるもので、変更される可能性があります。最新の数値は [cohere.com](https://cohere.com) で確認してください — そして最終判断はツール自身のゲートに任せましょう:

```bash
node src/cli.js verify --keys=keys.txt     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 モデル — その35すべて

検証済みのキーは `GET /v1/models` で**アカウントのカタログ全体 — 35モデル**を見ることができ、検証を通過した最初のキーによって [`src/models.json`](src/models.json) に書き出されます:

ライブチャットプローブ（2026-10-19、2キー）では、次の17個の ID が `200` を返しました。カタログの残りのエントリは embedding / rerank / transcribe の ID で、互換エンドポイントでは提供されません:

|モデル|✓|
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

1つのキーでのライブプローブ:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 API の使い方

Cohere の API キー（`Bearer <key>`）は、OpenAI 互換のエンドポイント `https://api.cohere.com/compatibility/v1` と、ネイティブのチャットエンドポイント `https://api.cohere.com/v1/chat` の両方に使えます。同じキーがどちらにも応答し、9Router は互換 URL を指すように設定します。

**任意の SDK / curl（互換）:**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**ネイティブチャット（検証ツールが使うもの）:**

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

実行中にディスクへ書き出されるもの:

| パス | 内容 |
| --- | --- |
| `src/` | ツール本体 — リポジトリのルートから `node src/<file>.js` として実行します（`src/launcher.js`、`src/cli.js`） |
| `keys.txt` | キー。**1行に1つ**、キーがライブチェックを通過した瞬間に追記されます |
| `accounts.json` | アカウントごとに1レコード: メールボックス、パスワード、キー、それを発行した出口 |
| `out/` | 試行ごとの実行ディレクトリ（スクリーンショット + DOM/ネットワークダンプ）、バッチログ、出口の記録 |
| `src/models.json` | `verify` が書き出します — 検証に成功した最初のキーによる `GET /v1/models` のライブ応答 |

### 🖱️ ランチャー

ランチャーは `src/launcher.js` です: mint / finish / verify / settings（+ 9Router）のメニューです。`count`/`conc` を `launcher.config.json` に記憶し、ヘッダーに `proxies.txt` が保持する出口の数とディスク上のキーの数を表示します。`node src/launcher.js --connect-9router` はキーをローカルの 9Router に登録します。

## ✅ 動作検証済み — すべてのキーがテストされる

キーが `keys.txt` に書き込まれるのは、そのキーでライブ API が応答した後だけです:

| チェック | 呼び出し | 期待値 |
| --- | --- | --- |
| 認証 + モデル一覧 | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| 実際の生成 | `POST https://api.cohere.com/v1/chat`（`command-a-03-2025`） | テキスト付きの `200` |

このリポジトリが出荷したバッチを、実行ログから集計したもの:

| 計測項目 | 結果 |
| --- | --- |
| チェーン全体 | **15アカウント → 15キー**（2026-10-14、19:16–20:07）— 登録 → メール → 確認 → オンボーディング → キー |
| 検証 | **15/15 ライブ**（`models 200` + `chat 200`、`command-a-03-2025`） |
| 証明ポリシー | ライブチェックがクリーンに応答しないキーは**書き込まれません** — ツールは証明されていないキーよりも、欠けているキーを選びます |
| 確認ルート | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — 最初のアクセスでトークンは消費されます |
| オンボーディングゲート | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`、`accessType=FULL`、キー呼び出し `200`。これがないと `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

## 🧭 仕組み

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

アカウントごとに2つのフェーズ、1つの新しいメールボックスと1つの新しい出口:

1. **ブラウザフェーズ** — 1つの隔離された Chrome コンテキストを1つの出口に固定します。登録ページが読み込まれ、ページ自身の reCAPTCHA Enterprise チャレンジが解決され、続いてページ内の `RegisterWithEmail` POST が実行されます。captcha のアセットは一度ディスクにキャッシュされ、そこからすべてのコンテキストに配信されるため、短命な出口は小さなフォームページと POST だけを運べば済みます。ページのトランスポートが途中で死んだ場合、登録 POST は Node からローテーションされた出口を経由して再試行されます。
2. **ポストフェーズ** — 素の HTTP、出口ローテーション、ブラウザなし。受信箱を読み → `Location` ヘッダーから SendGrid のラッパーを解決し（no-follow の GET を使用）→ 確認リンクのルートを消費 → `AuthV2` ベアラー → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → ライブ検証 → `keys.txt` と `accounts.json` に追記。

## ⚙️ CLI オプション

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| タスク | フラグ |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>`（すべて `=` 形式、`--cross` = ボックスのクロスチェック） |
| `verify` | `--keys=<file>`（デフォルト `keys.txt`） · `--limit=N`（0 = すべて） |

Turbo を推奨します（5）。それ以上は非力な PC では負荷・BAN のリスクがあります。

ディスパッチャの `help` タスクはタスク一覧を表示します。フラグは `--name=value` として読み取られます。`node src/launcher.js` は mint · finish · verify · settings を提供します — ヘッダーには `proxies.txt` が保持する出口の数とディスク上のキーの数が表示され、設定は `launcher.config.json` に保存されます。

| 環境変数 | デフォルト | 意味 |
| --- | --- | --- |
| `COHERE_MAILBOX` | ループバックブローカー | 受信箱バックエンド（設定時は `emailnator`） |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap 受信箱 | キャプチャ用の Mailtrap フォルダ |

## 🛰️ プロキシ経由で

* `proxies.txt` — 1行に1つの出口、`scheme://host:port` 形式で `http` / `socks4` / `socks5`。`user:pass@` の認証情報に対応し、`#` はコメントの開始、`host:port` のみの場合は `http://` が既定です。空行はスキップされます。
* **使用時プリフライト:** 出口が使われるのは、直前に実際の egress チェックを通過した場合のみです。プライベート/CGNAT の応答は即座に拒否されます。ターゲットへの通信はプールの出口からしか出ません。
* **出口ローテーションフェーズ:** ポストフェーズはプール全体にわたって再試行し（確認ルートは12回試行）、`verify` は `403` で出口をローテーションしつつ、キーを失敗と判定するのは `401` のときだけです。
* **出口ごとに1アカウントというルールはありません:** 1つの出口が多数のアカウントを運ぶことができます — 出荷されたバッチでは、5つの出口が15個のキーを運び、そのうち1つが9個を運びました。

## 📄 ファイル

| パス | 内容 |
| --- | --- |
| `keys.txt` | キー。**1行に1つ**、キーがライブチェックを通過した瞬間に追記されます |
| `accounts.json` | アカウントごとに1レコード: メールボックス、パスワード、キー、それを発行した出口 |
| `out/` | 試行ごとの実行ディレクトリ（スクリーンショット + DOM/ネットワークダンプ）、バッチログ、出口の記録 |
| `src/models.json` | `verify` が書き出します — 検証に成功した最初のキーによる `GET /v1/models` のライブ応答 |

## 🔌 9Router に接続する

[9Router](https://9router.com) はセルフホスト型の OpenAI 互換ルーターです。Cohere は OpenAI 互換（互換エンドポイント `https://api.cohere.ai/compatibility/v1`）なので、一度登録すればすべてのキーを使えます:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt` 内のすべてのキーが `cohere` プロバイダーノードの1つの接続になります（`--api-key <key>` を使えば単一キーのみを登録し、`--model <id>` でデフォルトを上書きできます）。その後、9Router 内でモデルを選択してください:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

コネクタを更新された `keys.txt` に向ければアカウントを追加できます。ノードとそのモデル一覧は変わりません。`node src/launcher.js --connect-9router` はまさにこれを実行し、最初にベース URL とパスワードを尋ねます。

デフォルト: `--base http://localhost:20128`、`--password 123456`、`--name Cohere`、`--prefix cohere`、`--base-url https://api.cohere.ai/compatibility/v1`、`--model command-a-03-2025`。

## 🔑 1つのキーで得られるもの

| | |
| --- | --- |
| 🏢 プロバイダー | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 プロバイダーが提供するもの | アカウントあたり1つのトライアルキー（キャンペーン時は月1,000コール）— 実 Chrome + SendGrid 確認ゲート |
| 🔑 1つのキーで得られるもの | 自身のアカウントにスコープされた1つの API キー: 下記エンドポイントの35個のモデル ID を、プランの制限内で利用できます。クォータは**アカウント**に紐づくため、このツールがキーごとに1アカウントを作成するのはまさにそのためです |
| 🌐 API の形式 | OpenAI 互換: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 あなたのデータ | 通信先は cohere.com と、あなたが設定した受信箱バックエンドのみです。キーはあなたのマシンに留まります |

## 🐞 問題報告

Cohere が RPC、確認ルート、またはサインアップポリシーを変更しましたか？ ツールは失敗したステップで停止し、その旨を報告します。実行したコマンドと正確な出力を添えて **[issue を作成してください](../../issues)** — `out/` 以下の試行ごとのダンプ（スクリーンショット、DOM、ネットワーク記録）があれば、キーを漏らすことなく失敗を再現できます。PR も歓迎します。

## 📄 ライセンス

MIT © 2026 — [LICENSE](LICENSE) を参照してください。

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>