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

**Otomatik oluşturulan API anahtarlarıyla toplu Cohere hesabı oluşturun — OpenAI uyumlu çıkarım + 9Router bağlayıcısı.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Hızlı başlangıç](#-quick-start) · [🎁 Ücretsiz katman](#-free-tier--how-much-you-get) · [🤖 Modeller](#-models--all-35-of-them) · [🧪 API'yi kullanma](#-how-to-use-the-api) · [✅ Doğrulandı](#-verified-working--every-key-is-tested) · [🧭 Nasıl çalışır](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ Seçenekler](#️-cli-options) · [🛰️ Proxy'ler](#️-behind-a-proxy) · [🐞 Sorunlar](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Bu neden var

Cohere'in ücretsiz katmanı **hesapta** yaşar: konsol her hesap için bir `TRIAL` API anahtarı üretir (deneme kampanyası sürerken **hesap başına ayda 1.000 çağrı** olarak kaydedilir) ve üretim anahtarı ayrı, sözleşmeye bağlı bir süreçtir. Yani faydalı birim *anahtar başına bir hesap*tır, asla bir hesaptan birçok anahtar değil.

Kayıt küçüktür — bir e-posta alanı, bir parola — ancak sayfa yalnızca gerçek bir tarayıcıda çalıştığında çalışan bir hesap üretir; onay e-postasından sonraki her şey düz HTTP'dir:

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

## 🎁 Ücretsiz katman — ne kadar alırsınız

Cohere'in ücretsiz katmanı **hesaptaki deneme anahtarıdır** — **hesap başına ayda 1.000 API çağrısı** (kampanya için kaydedilen kota; [dashboard.cohere.com](https://dashboard.cohere.com) adresindeki konsol her zaman mevcut planınızı ve limitlerinizi gösterir, bunları Cohere değiştirebilir). Üretim anahtarı sözleşmeye bağlıdır.

| Ne | Değer |
| --- | --- |
| Hoş geldin ödeneği | hesap başına bir `TRIAL` anahtarı — ayda 1.000 çağrı (kampanya) |
| Kart gerekli mi | **Hayır** |
| Kayıt | gerçek bir tarayıcıda e-posta + parola; bağlantıyla e-posta onayı; onboarding sözleşmesi |
| Ölçeklenen birim | **bir hesap = bir anahtar** → `--count N`, N deneme bütçesidir |
| Limitlerinizi nasıl görürsünüz | [dashboard.cohere.com](https://dashboard.cohere.com) — plan limitlerinin canlı kaynağı |

> 💡 Ücretsiz katman Cohere tarafından belirlenir ve değişebilir. Canlı sayıları [cohere.com](https://cohere.com) adresinden kontrol edin — ve kararı aracın kendi kapısına bırakın:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modeller — 35'inin tamamı

Doğrulanmış bir anahtar, `GET /v1/models` üzerinde **tüm hesap kataloğunu — 35 modeli** görür; doğrulamayı geçen ilk anahtar tarafından [`src/models.json`](src/models.json) dosyasına yazılır:

| Aile | Örnekler |
| --- | --- |
| Command (sohbet/üretim) | `command-a-03-2025`, `command-a-plus-05-2026`, `command-a-reasoning-08-2025`, `command-a-translate-08-2025`, `command-a-vision-07-2025` |
| Command R | `command-r-08-2024`, `command-r-plus-08-2024`, `command-r7b-12-2024`, `command-r7b-arabic-02-2025` |
| Tiny Aya (küçük modeller) | `tiny-aya-earth`, `tiny-aya-fire`, `tiny-aya-global`, `tiny-aya-water` |
| Embed | `embed-v4.0`, `embed-v5.0-pro`, `embed-v5.0-fast`, `embed-english-v3.0`, `embed-multilingual-v3.0` |
| Rerank | `rerank-v4.0-pro`, `rerank-v4.0-fast`, `rerank-v3.5`, `rerank-english-v3.0`, `rerank-multilingual-v3.0` |
| Aya / konuşma / kod | `c4ai-aya-expanse-32b`, `c4ai-aya-vision-32b`, `cohere-transcribe-03-2026`, `north-mini-code-1-0` |

Bir anahtarın canlı testi:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 API nasıl kullanılır

Cohere API anahtarı (`Bearer <key>`), uyumluluk uç noktası `https://api.cohere.com/compatibility/v1` — OpenAI uyumlu — ve yerel sohbet uç noktası `https://api.cohere.com/v1/chat` adreslerine erişir. Aynı anahtar her ikisine de yanıt verir; 9Router uyumluluk URL'sine yönlendirilir.

**Herhangi bir SDK / curl (uyumluluk):**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**Yerel sohbet (doğrulayıcının kullandığı):**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 Hızlı başlangıç

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

Çalışırken diske ne yazılır:

| Yol | İçerik |
| --- | --- |
| `src/` | araç — depo kökünden `node src/<file>.js` olarak çalıştırın (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | anahtarlar, **her satırda bir tane**, bir anahtar canlı kontrolü geçtiği anda eklenir |
| `accounts.json` | hesap başına bir kayıt: posta kutusu, parola, anahtar, onu üreten çıkış |
| `out/` | deneme başına çalıştırma dizinleri (ekran görüntüleri + DOM/ağ dökümleri), toplu iş günlüğü, çıkış kayıtları |
| `src/models.json` | `verify` tarafından yazılır — doğrulayan ilk anahtarın canlı `GET /v1/models` yanıtı |

### 🖱️ Başlatıcı

Başlatıcı `src/launcher.js`'dir: mint / finish / verify / settings (+ 9Router) üzerine bir menü. `count`/`conc` değerlerini `launcher.config.json` içinde hatırlar ve başlıkta `proxies.txt` dosyasının kaç çıkış tuttuğunu ve diskte kaç anahtar olduğunu gösterir. `node src/launcher.js --connect-9router`, anahtarları yerel bir 9Router'a kaydeder.

## ✅ Çalıştığı doğrulandı — her anahtar test edilir

Bir anahtar `keys.txt` dosyasına ancak canlı API onunla yanıt verdikten sonra yazılır:

| kontrol | çağrı | beklenen |
| --- | --- | --- |
| kimlik doğrulama + model listesi | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| gerçek üretim | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | metinle birlikte `200` |

Bu deponun gönderildiği toplu iş, çalıştırma günlüklerinden ölçülmüştür:

| Ölçüm | Sonuç |
| --- | --- |
| Tüm zincir | **her hesap kendi anahtarını üretti** 2026-10-14, 19:16–20:07 — kayıt → posta → onay → onboarding → anahtar |
| Doğrulama | **çalıştığı doğrulandı** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Kanıt politikası | canlı kontrolü temiz yanıt vermeyen bir anahtar **yazılmaz** — araç, kanıtlanmamış bir anahtar yerine eksik anahtarı tercih eder |
| Onay rotası | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — ilk dokunuş token'ı tüketir |
| Onboarding kapısı | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, anahtar çağrısı `200`; o olmadan `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

> **Kalite kapıları.** Buradaki her anahtar, `keys.txt` dosyasına yazılmadan önce canlı bir `chat-200` geçti
> (ölü anahtarlar asla gönderilmez). Router kombinasyonları model düzeyinde aynı kuralı izler: bir giriş
> **yalnızca model `chat-200` yanıtlıyorsa ve araçları çağırabiliyorsa** eklenir — araç desteği olmayan bir model,
> ölü bir anahtar veya ölü bir sağlayıcı eklenmek yerine çıkarılır. Doğrulama adımını istediğiniz zaman yeniden çalıştırın;
> hatalar bildirilir, asla gizlenmez.

## 🧭 Nasıl çalışır

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

Hesap başına, iki aşama, bir taze posta kutusu ve bir taze çıkış:

1. **Tarayıcı aşaması** — bir çıkışa sabitlenmiş, izole bir Chrome bağlamı. Kayıt sayfası yüklenir, sayfanın kendi reCAPTCHA Enterprise meydan okuması çözülür ve sayfa içi `RegisterWithEmail` POST'u izler. Captcha varlıkları bir kez diske önbelleğe alınır ve oradan her bağlama sunulur, böylece kısa ömürlü bir çıkışın yalnızca küçük form sayfasını ve POST'u taşıması gerekir. Sayfa aktarımı uçuş ortasında ölürse, kayıt POST'u Node'dan döndürülmüş bir çıkış üzerinden yeniden denenir.
2. **Sonraki aşama** — düz HTTP, çıkış döndüren, tarayıcı yok. Gelen kutusunu oku → `Location` başlığından SendGrid sarmalayıcısını çöz (takip etmeyen bir GET ile) → onay bağlantısı rotasını tüket → `AuthV2` bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → canlı doğrula → `keys.txt` ve `accounts.json` dosyalarına ekle.

## ⚙️ CLI seçenekleri

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| Görev | Bayraklar |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (hepsi `=` biçiminde, `--cross` = kutuyu çapraz kontrol et) |
| `verify` | `--keys=<file>` (varsayılan `keys.txt`) · `--limit=N` (0 = tümü) |

Göndericinin `help` görevi görevleri listeler; bayraklar `--name=value` olarak okunur. `node src/launcher.js` mint · finish · verify · settings sunar — başlık `proxies.txt` dosyasının kaç çıkış tuttuğunu ve diskte kaç anahtar olduğunu gösterir ve ayarlar `launcher.config.json` içinde kalıcıdır.

| Ortam değişkeni | Varsayılan | Anlamı |
| --- | --- | --- |
| `COHERE_MAILBOX` | loopback broker | gelen kutusu arka ucu (ayarlandığında `emailnator`) |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap inbox | yakalamalar için Mailtrap klasörü |

## 🛰️ Proxy arkasında

* `proxies.txt` — satır başına bir çıkış, `scheme://host:port` ile `http` / `socks4` / `socks5`; `user:pass@` kimlik bilgileri desteklenir, `#` bir yorum başlatır ve çıplak `host:port` varsayılan olarak `http://` olur. Boş satırlar atlanır.
* **İsteğe bağlı — ölçekte önerilir (IP başına limitler, yasaklar).** HTTP rayları (`rpc`, `verify`, `recon`, `click-confirm`) proxy olmadan da çalışır: havuz dosyası yoksa istek doğrudan çıkar ve çalıştırma çıkışı `direct` olarak günlüğe kaydeder.
* **Kullanım noktasında ön kontrol (havuz verildiğinde):** bir çıkış, ancak gerçek bir çıkış kontrolünü yeni taşıdıktan sonra kullanılır; özel/CGNAT yanıtları doğrudan reddedilir. Tarayıcı kaydı yine de bir havuz ister — kontrol paneli IP kapılıdır ve üretim yolu *ıslatılmış* çıkışlar üzerine kuruludur (önce `probe.js`/`soak.js` çalıştırın).
* **Çıkış döndüren aşama:** sonraki aşama tüm havuz boyunca yeniden dener (onay rotası 12 deneme alır) ve `verify`, `403` durumunda çıkışları döndürürken bir anahtarı yalnızca `401` durumunda başarısız sayar.
* **Çıkış başına hesap kuralı yok:** bir çıkış birçok hesap taşıyabilir — gönderilen toplu işte 5 çıkış 15 anahtar taşıdı ve bunlardan biri 9 taşıdı.

## 📄 Dosyalar

| Yol | İçerik |
| --- | --- |
| `keys.txt` | anahtarlar, **her satırda bir tane**, bir anahtar canlı kontrolü geçtiği anda eklenir |
| `accounts.json` | hesap başına bir kayıt: posta kutusu, parola, anahtar, onu üreten çıkış |
| `out/` | deneme başına çalıştırma dizinleri (ekran görüntüleri + DOM/ağ dökümleri), toplu iş günlüğü, çıkış kayıtları |
| `src/models.json` | `verify` tarafından yazılır — doğrulayan ilk anahtarın canlı `GET /v1/models` yanıtı |

## 🔌 9Router'a bağlanma

[9Router](https://9router.com) kendi kendine barındırılan, OpenAI uyumlu bir yönlendiricidir. Cohere OpenAI uyumludur (uyumluluk uç noktası `https://api.cohere.ai/compatibility/v1`), bu yüzden bir kez kaydedin ve her anahtarı kullanın:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt` içindeki her anahtar, `cohere` sağlayıcı düğümünün bir bağlantısı olur (`--api-key <key>` bunun yerine tek bir anahtar kaydeder, `--model <id>` varsayılanı geçersiz kılar). Ardından 9Router içinde bir model seçin:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Daha fazla hesap eklemek için bağlayıcıyı yenilenmiş bir `keys.txt` dosyasına yönlendirin; düğüm ve model listesi aynı kalır. `node src/launcher.js --connect-9router` tam olarak bunu çalıştırır ve önce temel URL ile parolayı sorar.

Varsayılanlar: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔌 OmniRoute'a bağlanma

[OmniRoute](https://omniroute.online) kendi kendine barındırılan, OpenAI uyumlu bir yönlendiricidir. Cohere OpenAI uyumludur (uyumluluk uç noktası `https://api.cohere.ai/compatibility/v1`), bu yüzden bir kez kaydedin ve her anahtarı kullanın:

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

`keys.txt` içindeki her anahtar, `cohere` sağlayıcı düğümünün bir bağlantısı olur (`--api-key <key>` bunun yerine tek bir anahtar kaydeder, `--model <id>` varsayılanı geçersiz kılar). Ardından OmniRoute içinde bir model seçin:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Daha fazla hesap eklemek için bağlayıcıyı yenilenmiş bir `keys.txt` dosyasına yönlendirin; düğüm ve model listesi aynı kalır. `node src/launcher.js --connect-omniroute` tam olarak bunu çalıştırır ve önce temel URL ile parolayı sorar.

Varsayılanlar: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 Bir anahtar size ne kazandırır

| | |
| --- | --- |
| 🏢 Sağlayıcı | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 Sağlayıcının verdikleri | hesap başına 1 deneme anahtarı (kampanya sürerken ayda 1.000 çağrı) — gerçek Chrome + SendGrid onay kapısı |
| 🔑 Bir anahtar size ne kazandırır | kendi hesabına kapsanmış bir API anahtarı: aşağıdaki uç noktadaki 35 model kimliği, planınızın limitlerinde. Kota **hesapta** yaşar, bu aracın anahtar başına bir hesap oluşturmasının nedeni tam da budur |
| 🌐 API biçimi | OpenAI uyumlu: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Verileriniz | yalnızca cohere.com ve yapılandırdığınız gelen kutusu arka ucuyla iletişim kurulur; anahtarlar makinenizde kalır |

## 🐞 Sorunlar

Cohere RPC'yi, onay rotasını veya kayıt politikasını mı değiştirdi? Araç başarısız olan adımda durur ve bunu söyler. Çalıştırdığınız komut ve tam çıktıyla birlikte **[bir sorun açın](../../issues)** — `out/` altındaki deneme başına dökümler (ekran görüntüleri, DOM ve ağ kayıtları) hataları anahtar sızdırmadan yeniden üretilebilir kılar. PR'lar memnuniyetle karşılanır.

## 📄 Lisans

MIT © 2026 — bkz. [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>