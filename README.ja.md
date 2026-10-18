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

**Cohere アカウントを自動生成された API キーとともに一括作成 — OpenAI 互換の推論 + 9Router コネクタ。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 クイックスタート](#-quick-start) · [🎁 無料枠](#-free-tier--how-much-you-get) · [🤖 モデル](#-models--all-35-of-them) · [🧪 API の使い方](#-how-to-use-the-api) · [✅ 検証済み](#-verified-working--every-key-is-tested) · [🧭 仕組み](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ オプション](#️-cli-options) · [🛰️ プロキシ](#️-behind-a-proxy) · [🐞 イシュー](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>


---

## ✨ なぜこれが存在するのか

Cohere の無料枠は**アカウント**に紐づきます。コンソールはアカウントごとに 1 つの `TRIAL` API キーを発行し（トライアルキャンペーン実施中は**アカウントあたり月 1,000 コール**として記録）、プロダクションキーは別途、契約が必要なプロセスです。したがって有用な単位は*キーごとに 1 アカウント*であり、1 つのアカウントから多数のキーを取得することは決してありません。

サインアップは小規模です — メール欄が 1 つ、パスワードが 1 つ — しかしこのページが実際に機能するアカウントを生成するのは、本物のブラウザで実行されたときだけであり、確認メール以降はすべてプレーン HTTP です:

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

Cohere の無料枠は**アカウント上のトライアルキー**です — **アカウントあたり月 1,000 API コール**（キャンペーン時に記録されたクォータ。[dashboard.cohere.com](https://dashboard.cohere.com) のコンソールには常に現在のプランと制限が表示され、Cohere が変更する可能性があります）。プロダクションキーは契約が必要です。

| 項目 | 値 |
| --- | --- |
| ウェルカム許容量 | アカウントあたり 1 つの `TRIAL` キー — 月 1,000 コール（キャンペーン） |
| カード必須 | **いいえ** |
| サインアップ | 本物のブラウザでメール + パスワード。リンクによるメール確認。オンボーディング同意 |
| スケールする単位 | **1 アカウント = 1 キー** → `--count N` は N 個のトライアル予算 |
| 制限の確認方法 | [dashboard.cohere.com](https://dashboard.cohere.com) — プラン制限のライブソース |

> 💡 無料枠は Cohere が設定し、変更される可能性があります。最新の数値は [cohere.com](https://cohere.com) で確認してください — そしてツール自身のゲートに判断させてください:

```bash
node src/cli.js verify --keys=keys.txt     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 モデル — 全 35 個

検証済みのキーは `GET /v1/models` で**アカウントカタログ全体 — 35 モデル**を見ることができ、検証を通過した最初のキーによって [`src/models.json`](src/models.json) に書き込まれます:

|Model|✓|
|---|---|
|`command-a-03-2025`|✓|

1 つのキーのライブプローブ:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 API の使い方

Cohere API キー（`Bearer <key>`）は互換エンドポイント `https://api.cohere.com/compatibility/v1` — OpenAI 互換 — と、ネイティブチャットエンドポイント `https://api.cohere.com/v1/chat` に到達します。同じキーが両方に応答し、9Router は互換 URL を指します。

**任意の SDK / curl（互換）:**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**ネイティブチャット（検証ツールが使用するもの）:**

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

実行中にディスクに書き込まれるもの:

| パス | 内容 |
| --- | --- |
| `src/` | ツール本体 — リポジトリルートから `node src/<file>.js` として実行します（`src/launcher.js`、`src/cli.js`） |
| `keys.txt` | キー。**1 行に 1 つ**、キーがライブチェックを通過した瞬間に追記されます |
| `accounts.json` | アカウントごとに 1 レコード: メールボックス、パスワード、キー、それを発行した exit |
| `out/` | 試行ごとの実行ディレクトリ（スクリーンショット + DOM/ネットワークダンプ）、バッチログ、exit の記帳 |
| `src/models.json` | `verify` によって書き込まれます — 検証した最初のキーのライブ `GET /v1/models` 応答 |

### 🖱️ ランチャー

ランチャーは `src/launcher.js` です: mint / finish / verify / settings（+ 9Router）のメニューです。`launcher.config.json` に `count`/`conc` を記憶し、ヘッダーに `proxies.txt` が保持する exit の数とディスク上のキーの数を表示します。`node src/launcher.js --connect-9router` はローカルの 9Router にキーを登録します。

## ✅ 動作検証済み — すべてのキーがテストされます

キーが `keys.txt` に書き込まれるのは、ライブ API がそのキーで応答した後のみです:

| チェック | 呼び出し | 期待値 |
| --- | --- | --- |
| 認証 + モデル一覧 | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| 実際の生成 | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | テキスト付き `200` |

このリポジトリが出荷したバッチ、実行ログから測定:

| 測定項目 | 結果 |
| --- | --- |
| チェーン全体 | **15 アカウント → 15 キー**、2026-10-14、19:16–20:07 — 登録 → メール → 確認 → オンボーディング → キー |
| 検証 | **15/15 ライブ**（`models 200` + `chat 200`、`command-a-03-2025`） |
| 証明ポリシー | ライブチェックがクリーンに応答しないキーは**書き込まれません** — ツールは証明されていないキーよりも欠落したキーを好みます |
| 確認ルート | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — 最初のタッチでトークンが消費されます |
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

アカウントごとに、2 つのフェーズ、1 つの新しいメールボックスと 1 つの新しい exit:

1. **ブラウザフェーズ** — 1 つの分離された Chrome コンテキストを、1 つの exit に固定します。登録ページが読み込まれ、ページ自身の reCAPTCHA Enterprise チャレンジが解決され、ページ内の `RegisterWithEmail` POST が続きます。captcha アセットは一度ディスクにキャッシュされ、そこからすべてのコンテキストに提供されるため、短命な exit は小さなフォームページと POST だけを運べばよいのです。ページトランスポートが途中で死んだ場合、登録 POST は Node からローテーションされた exit を通じて再試行されます。
2. **ポストフェーズ** — プレーン HTTP、exit ローテーション、ブラウザなし。受信トレイを読む → `Location` ヘッダーから SendGrid ラッパーを解決する（no-follow GET を使用）→ 確認リンクルートを消費する → `AuthV2` bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → ライブ検証 → `keys.txt` と `accounts.json` に追記。

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

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

ディスパッチャの `help` タスクはタスクを一覧表示します。フラグは `--name=value` として読み取られます。`node src/launcher.js` は mint · finish · verify · settings を提供します — ヘッダーには `proxies.txt` が保持する exit の数とディスク上のキーの数が表示され、設定は `launcher.config.json` に永続化されます。

| 環境変数 | デフォルト | 意味 |
| --- | --- | --- |
| `COHERE_MAILBOX` | ループバックブローカー | 受信トレイバックエンド（設定時は `emailnator`） |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap 受信トレイ | キャプチャ用の Mailtrap フォルダ |

## 🛰️ プロキシの背後で

* `proxies.txt` — 1 行に 1 つの exit、`scheme://host:port` で `http` / `socks4` / `socks5`。`user:pass@` 認証情報がサポートされ、`#` はコメントを開始し、ベアの `host:port` はデフォルトで `http://` になります。空行はスキップされます。
* **使用時点のプリフライト:** exit は、実際の egress チェックをちょうど通過した後にのみ使用されます。プライベート/CGNAT の応答は即座に拒否されます。ターゲットトラフィックはプールの exit を通じてのみ流出します。
* **exit ローテーションフェーズ:** ポストフェーズはプール全体で再試行し（確認ルートは 12 回試行）、`verify` は `403` で exit をローテーションしつつ、`401` でのみキーを失敗とします。
* **exit ごとに 1 アカウントのルールはなし:** 1 つの exit が多数のアカウントを運ぶことがあります — 出荷されたバッチでは、5 つの exit が 15 のキーを運び、そのうちの 1 つが 9 つを運びました。

## 📄 ファイル

| パス | 内容 |
| --- | --- |
| `keys.txt` | キー。**1 行に 1 つ**、キーがライブチェックを通過した瞬間に追記されます |
| `accounts.json` | アカウントごとに 1 レコード: メールボックス、パスワード、キー、それを発行した exit |
| `out/` | 試行ごとの実行ディレクトリ（スクリーンショット + DOM/ネットワークダンプ）、バッチログ、exit の記帳 |
| `src/models.json` | `verify` によって書き込まれます — 検証した最初のキーのライブ `GET /v1/models` 応答 |

## 🔌 9Router に接続

[9Router](https://9router.com) はセルフホスト型の OpenAI 互換ルーターです。Cohere は OpenAI 互換（互換エンドポイント `https://api.cohere.ai/compatibility/v1`）なので、一度登録すればすべてのキーを使用できます:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt` のすべてのキーが `cohere` プロバイダノードの 1 つの接続になります（`--api-key <key>` は代わりに単一のキーを登録し、`--model <id>` はデフォルトを上書きします）。次に 9Router 内でモデルを選択します:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

コネクタを更新された `keys.txt` に向けてさらにアカウントを追加します。ノードとそのモデル一覧は同じままです。`node src/launcher.js --connect-9router` はまさにこれを実行し、最初にベース URL とパスワードを尋ねます。

デフォルト: `--base http://localhost:20128`、`--password 123456`、`--name Cohere`、`--prefix cohere`、`--base-url https://api.cohere.ai/compatibility/v1`、`--model command-a-03-2025`。

## 🔑 1 つのキーで得られるもの

| | |
| --- | --- |
| 🏢 プロバイダ | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 プロバイダが提供するもの | アカウントあたり 1 つのトライアルキー（キャンペーン実施時は月 1,000 コール） — 本物の Chrome + SendGrid 確認ゲート |
| 🔑 1 つのキーで得られるもの | 自身のアカウントにスコープされた 1 つの API キー: 下記エンドポイントの 35 のモデル ID を、プランの制限で。クォータは**アカウント**に紐づくため、このツールがキーごとに 1 アカウントを作成するのです |
| 🌐 API 形状 | OpenAI 互換: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 あなたのデータ | 接触するのは cohere.com と、あなたが設定した受信トレイバックエンドのみ。キーはあなたのマシンに留まります |

## 🐞 イシュー

Cohere が RPC、確認ルート、またはサインアップポリシーを変更しましたか？ ツールは失敗したステップで停止し、その旨を伝えます。実行したコマンドと正確な出力を添えて **[イシューを開いてください](../../issues)** — `out/` 配下の試行ごとのダンプ（スクリーンショット、DOM およびネットワーク記録）により、キーを漏らすことなく失敗を再現できます。PR を歓迎します。

## 📄 ライセンス

MIT © 2026 — [LICENSE](LICENSE) を参照。

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>