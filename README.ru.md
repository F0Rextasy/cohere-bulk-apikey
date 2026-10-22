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

**Массовое создание аккаунтов Cohere с автоматически сгенерированными API-ключами — вывод, совместимый с OpenAI, + коннектор 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Быстрый старт](#-quick-start) · [🎁 Бесплатный тариф](#-free-tier--how-much-you-get) · [🤖 Модели](#-models--all-35-of-them) · [🧪 Использование API](#-how-to-use-the-api) · [✅ Проверено](#-verified-working--every-key-is-tested) · [🧭 Как это работает](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Параметры](#️-cli-options) · [🛰️ Прокси](#️-behind-a-proxy) · [🐞 Проблемы](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Зачем это нужно

Бесплатный тариф Cohere привязан к **аккаунту**: консоль создаёт один `TRIAL` API-ключ на аккаунт (в период пробной кампании фиксировалось **1 000 вызовов в месяц на аккаунт**), а production-ключ — отдельный процесс, доступный по договору. Поэтому полезная единица — *один аккаунт на ключ*, а не много ключей из одного аккаунта.

Регистрация простая — одно поле e-mail, один пароль — но страница создаёт рабочий аккаунт только при запуске в настоящем браузере, причём всё после письма с подтверждением идёт по обычному HTTP:

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

## 🎁 Бесплатный тариф — сколько вы получаете

Бесплатный тариф Cohere — это **пробный ключ на аккаунте** — **1 000 вызовов API в месяц на аккаунт** (квота, зафиксированная для кампании; консоль на [dashboard.cohere.com](https://dashboard.cohere.com) всегда показывает ваш текущий план и лимиты, которые Cohere может изменить). Production-ключ доступен по договору.

| Что | Значение |
| --- | --- |
| Приветственная квота | один `TRIAL`-ключ на аккаунт — 1 000 вызовов/месяц (кампания) |
| Требуется карта | **Нет** |
| Регистрация | e-mail + пароль в настоящем браузере; подтверждение e-mail по ссылке; согласие на онбординг |
| Единица масштабирования | **один аккаунт = один ключ** → `--count N` — это N пробных бюджетов |
| Как посмотреть лимиты | [dashboard.cohere.com](https://dashboard.cohere.com) — актуальный источник лимитов плана |

> 💡 Бесплатный тариф устанавливает Cohere, и он может измениться. Проверяйте актуальные цифры на [cohere.com](https://cohere.com) — и пусть решает собственная проверка инструмента:

```bash
node src/cli.js verify --keys=keys.txt     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Модели — все 35

Проверенный ключ видит **весь каталог аккаунта — 35 моделей** на `GET /v1/models`, который записывается в [`src/models.json`](src/models.json) первым ключом, прошедшим проверку:

Живой чат-запрос (2026-10-19, 2 ключа) вернул `200` для этих 17 идентификаторов; остальные записи каталога — это id для embedding / rerank / transcribe, которые endpoint совместимости не обслуживает:

|Модель|✓|
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

Живой запрос одного ключа:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 Как использовать API

API-ключ Cohere (`Bearer <key>`) даёт доступ к endpoint совместимости `https://api.cohere.com/compatibility/v1` — совместимому с OpenAI — и к нативному чат-endpoint `https://api.cohere.com/v1/chat`. Один и тот же ключ работает с обоими; 9Router направляется на URL совместимости.

**Любой SDK / curl (совместимость):**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**Нативный чат (используется верификатором):**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 Быстрый старт

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

Что появляется на диске во время работы:

| Путь | Содержимое |
| --- | --- |
| `src/` | инструмент — запускайте как `node src/<file>.js` из корня репозитория (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | ключи, **по одному на строку**, добавляются в момент, когда ключ проходит живую проверку |
| `accounts.json` | одна запись на аккаунт: почтовый ящик, пароль, ключ, exit-узел, который его создал |
| `out/` | каталоги запусков для каждой попытки (скриншоты + дампы DOM/сети), журнал пакета, учёт exit-узлов |
| `src/models.json` | записывается командой `verify` — живой ответ `GET /v1/models` первого ключа, прошедшего проверку |

### 🖱️ Лаунчер

Лаунчер — это `src/launcher.js`: меню для mint / finish / verify / settings (+ 9Router). Он запоминает `count`/`conc` в `launcher.config.json` и показывает в заголовке, сколько exit-узлов содержит `proxies.txt` и сколько ключей есть на диске. `node src/launcher.js --connect-9router` регистрирует ключи в локальном 9Router.

## ✅ Проверено в работе — каждый ключ тестируется

Ключ записывается в `keys.txt` только после того, как живой API отвечает с ним:

| проверка | вызов | ожидается |
| --- | --- | --- |
| авторизация + список моделей | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| реальная генерация | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` с текстом |

Пакет, с которым поставлялся этот репозиторий, по данным журналов запусков:

| Измерение | Результат |
| --- | --- |
| Весь конвейер | **15 аккаунтов → 15 ключей** 2026-10-14, 19:16–20:07 — регистрация → письмо → подтверждение → онбординг → ключ |
| Проверка | **15/15 вживую** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Политика доказательства | ключ, чья живая проверка не отвечает чисто, **не** записывается — инструмент предпочитает отсутствующий ключ неподтверждённому |
| Маршрут подтверждения | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — первое обращение расходует токен |
| Онбординг-гейт | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, вызов ключа `200`; без него `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

## 🧭 Как это работает

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

На аккаунт — две фазы, один свежий почтовый ящик и один свежий exit-узел:

1. **Браузерная фаза** — один изолированный контекст Chrome, привязанный к одному exit-узлу. Загружается страница регистрации, решается собственная reCAPTCHA Enterprise на странице, затем выполняется POST `RegisterWithEmail` со страницы. Ресурсы капчи один раз кешируются на диске и отдаются из него каждому контексту, поэтому недолговечному exit-узлу нужно пронести только небольшую страницу формы и POST. Если транспорт страницы умирает на полпути, POST регистрации повторяется из Node через другой exit-узел.
2. **Пост-фаза** — обычный HTTP, со сменой exit-узлов, без браузера. Прочитать почтовый ящик → разобрать обёртку SendGrid из заголовка `Location` (с GET без перехода по редиректу) → пройти маршрут ссылки подтверждения → `AuthV2` bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → живая проверка → добавить в `keys.txt` и `accounts.json`.

## ⚙️ Параметры CLI

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| Задача | Флаги |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (все в форме `=`, `--cross` = перепроверить ящик) |
| `verify` | `--keys=<file>` (по умолчанию `keys.txt`) · `--limit=N` (0 = все) |

Рекомендуется Turbo (5); больше — риск нагрузки/бана на слабом компьютере.

Задача `help` диспетчера перечисляет задачи; флаги читаются как `--name=value`. `node src/launcher.js` предлагает mint · finish · verify · settings — в заголовке показано, сколько exit-узлов содержит `proxies.txt` и сколько ключей есть на диске, а настройки сохраняются в `launcher.config.json`.

| Переменная окружения | По умолчанию | Значение |
| --- | --- | --- |
| `COHERE_MAILBOX` | loopback-брокер | бэкенд почтового ящика (`emailnator`, если задано) |
| `COHERE_MAILTRAP_FOLDER` | почтовый ящик Mailtrap | папка Mailtrap для перехватов |

## 🛰️ За прокси

* `proxies.txt` — один exit-узел на строку, `scheme://host:port` с `http` / `socks4` / `socks5`; поддерживаются учётные данные `user:pass@`, `#` начинает комментарий, а голый `host:port` по умолчанию использует `http://`. Пустые строки пропускаются.
* **Проверка перед использованием:** exit-узел используется только после того, как он только что прошёл реальную проверку egress; частные/CGNAT-ответы отвергаются сразу. Целевой трафик всегда выходит только через exit-узел из пула.
* **Фаза со сменой exit-узлов:** пост-фаза повторяет попытки по всему пулу (маршрут подтверждения получает 12 попыток), а `verify` меняет exit-узлы при `403`, считая ключ неудачным только при `401`.
* **Правила «один аккаунт на exit-узел» нет:** один exit-узел может нести много аккаунтов — в поставленном пакете 5 exit-узлов несли 15 ключей, а один из них — 9.

## 📄 Файлы

| Путь | Содержимое |
| --- | --- |
| `keys.txt` | ключи, **по одному на строку**, добавляются в момент, когда ключ проходит живую проверку |
| `accounts.json` | одна запись на аккаунт: почтовый ящик, пароль, ключ, exit-узел, который его создал |
| `out/` | каталоги запусков для каждой попытки (скриншоты + дампы DOM/сети), журнал пакета, учёт exit-узлов |
| `src/models.json` | записывается командой `verify` — живой ответ `GET /v1/models` первого ключа, прошедшего проверку |

## 🔌 Подключение к 9Router

[9Router](https://9router.com) — self-hosted роутер, совместимый с OpenAI. Cohere совместим с OpenAI (endpoint совместимости `https://api.cohere.ai/compatibility/v1`), поэтому зарегистрируйте его один раз и используйте каждый ключ:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Каждый ключ в `keys.txt` становится одним подключением узла провайдера `cohere` (`--api-key <key>` вместо этого регистрирует один ключ, `--model <id>` переопределяет значение по умолчанию). Затем выберите модель внутри 9Router:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Направьте коннектор на обновлённый `keys.txt`, чтобы добавить больше аккаунтов; узел и его список моделей останутся прежними. `node src/launcher.js --connect-9router` выполняет именно это и сначала запрашивает базовый URL и пароль.

По умолчанию: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 Что даёт один ключ

| | |
| --- | --- |
| 🏢 Провайдер | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 Что даёт провайдер | 1 пробный ключ на аккаунт (1 000 вызовов/месяц, когда шла кампания) — гейт с настоящим Chrome + подтверждением через SendGrid |
| 🔑 Что даёт один ключ | один API-ключ, привязанный к своему аккаунту: 35 id моделей на endpoint ниже, в пределах лимитов вашего плана. Квота живёт на **аккаунте**, поэтому инструмент и создаёт один аккаунт на ключ |
| 🌐 Форма API | Совместим с OpenAI: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Ваши данные | Связь только с cohere.com и настроенным вами бэкендом почтового ящика; ключи остаются на вашей машине |

## 🐞 Проблемы

Cohere изменил RPC, маршрут подтверждения или политику регистрации? Инструмент останавливается на неудачном шаге и сообщает об этом. **[Откройте issue](../../issues)** с командой, которую вы запускали, и точным выводом — дампы каждой попытки в `out/` (скриншоты, записи DOM и сети) делают сбои воспроизводимыми без утечки ключа. PR приветствуются.

## 📄 Лицензия

MIT © 2026 — см. [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 участники cohere-bulk-apikey

</div>