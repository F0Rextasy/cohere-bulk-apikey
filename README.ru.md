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

**Массовое создание аккаунтов Cohere с автоматически сгенерированными API-ключами — OpenAI-совместимый инференс + коннектор 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Быстрый старт](#-quick-start) · [🎁 Бесплатный тариф](#-free-tier--how-much-you-get) · [🤖 Модели](#-models--all-35-of-them) · [🧪 Использование API](#-how-to-use-the-api) · [✅ Проверено](#-verified-working--every-key-is-tested) · [🧭 Как это работает](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ Опции](#️-cli-options) · [🛰️ Прокси](#️-behind-a-proxy) · [🐞 Проблемы](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Зачем это нужно

Бесплатный тариф Cohere привязан к **аккаунту**: консоль выдаёт один `TRIAL` API-ключ на аккаунт (записан как **1 000 вызовов в месяц на аккаунт**, пока действовала пробная кампания), а production-ключ — это отдельный процесс, требующий договора. Поэтому полезная единица — *один аккаунт на ключ*, а не множество ключей с одного аккаунта.

Регистрация небольшая — одно поле для e-mail, один пароль — но страница создаёт рабочий аккаунт только при запуске в настоящем браузере, а всё после письма с подтверждением — обычный HTTP:

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

Бесплатный тариф Cohere — это **пробный ключ на аккаунте** — **1 000 вызовов API в месяц на аккаунт** (квота, зафиксированная для кампании; консоль на [dashboard.cohere.com](https://dashboard.cohere.com) всегда показывает ваш текущий план и лимиты, которые Cohere может изменить). Production-ключ требует договора.

| Что | Значение |
| --- | --- |
| Приветственная квота | один `TRIAL`-ключ на аккаунт — 1 000 вызовов/месяц (кампания) |
| Требуется карта | **Нет** |
| Регистрация | e-mail + пароль в настоящем браузере; подтверждение e-mail по ссылке; согласие с онбордингом |
| Единица масштабирования | **один аккаунт = один ключ** → `--count N` — это N пробных бюджетов |
| Как посмотреть свои лимиты | [dashboard.cohere.com](https://dashboard.cohere.com) — живой источник лимитов плана |

> 💡 Бесплатный тариф устанавливается Cohere и может измениться. Проверяйте актуальные цифры на [cohere.com](https://cohere.com) — и пусть собственный гейт инструмента решает:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Модели — все 35

Проверенный ключ видит **весь каталог аккаунта — 35 моделей** на `GET /v1/models`, записанный в [`src/models.json`](src/models.json) первым ключом, прошедшим проверку:

| Семейство | Примеры |
| --- | --- |
| Command (чат/генерация) | `command-a-03-2025`, `command-a-plus-05-2026`, `command-a-reasoning-08-2025`, `command-a-translate-08-2025`, `command-a-vision-07-2025` |
| Command R | `command-r-08-2024`, `command-r-plus-08-2024`, `command-r7b-12-2024`, `command-r7b-arabic-02-2025` |
| Tiny Aya (малые модели) | `tiny-aya-earth`, `tiny-aya-fire`, `tiny-aya-global`, `tiny-aya-water` |
| Embed | `embed-v4.0`, `embed-v5.0-pro`, `embed-v5.0-fast`, `embed-english-v3.0`, `embed-multilingual-v3.0` |
| Rerank | `rerank-v4.0-pro`, `rerank-v4.0-fast`, `rerank-v3.5`, `rerank-english-v3.0`, `rerank-multilingual-v3.0` |
| Aya / речь / код | `c4ai-aya-expanse-32b`, `c4ai-aya-vision-32b`, `cohere-transcribe-03-2026`, `north-mini-code-1-0` |

Живая проверка одного ключа:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 Как использовать API

API-ключ Cohere (`Bearer <key>`) даёт доступ к эндпоинту совместимости `https://api.cohere.com/compatibility/v1` — OpenAI-совместимому — и к нативному эндпоинту чата `https://api.cohere.com/v1/chat`. Один и тот же ключ отвечает на оба; 9Router настроен на URL совместимости.

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

Что появляется на диске во время работы:

| Путь | Содержимое |
| --- | --- |
| `src/` | инструмент — запускайте как `node src/<file>.js` из корня репозитория (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | ключи, **по одному на строку**, добавляются в момент прохождения ключом живой проверки |
| `accounts.json` | одна запись на аккаунт: почтовый ящик, пароль, ключ, выход, через который он был создан |
| `out/` | каталоги запусков по попыткам (скриншоты + дампы DOM/сети), журнал пакета, учёт выходов |
| `src/models.json` | записывается `verify` — живой ответ `GET /v1/models` первого ключа, прошедшего проверку |

### 🖱️ Лаунчер

Лаунчер — это `src/launcher.js`: меню над mint / finish / verify / settings (+ 9Router). Он запоминает `count`/`conc` в `launcher.config.json` и показывает в заголовке, сколько выходов содержит `proxies.txt` и сколько ключей на диске. `node src/launcher.js --connect-9router` регистрирует ключи в локальном 9Router.

## ✅ Проверено в работе — каждый ключ протестирован

Ключ записывается в `keys.txt` только после того, как живой API ответит с ним:

| проверка | вызов | ожидается |
| --- | --- | --- |
| аутентификация + список моделей | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| реальная генерация | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` с текстом |

Пакет, из которого был выпущен этот репозиторий, по журналам запусков:

| Измерение | Результат |
| --- | --- |
| Вся цепочка | **каждый аккаунт создал собственный ключ** 2026-10-14, 19:16–20:07 — регистрация → письмо → подтверждение → онбординг → ключ |
| Проверка | **проверено в работе** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Политика доказательств | ключ, чья живая проверка не отвечает чисто, **не** записывается — инструмент предпочитает отсутствующий ключ недоказанному |
| Маршрут подтверждения | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — первое обращение расходует токен |
| Гейт онбординга | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, вызов ключа `200`; без него `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

> **Контроль качества.** Каждый ключ здесь прошёл живой `chat-200` до того, как был записан в `keys.txt`
> (мёртвые ключи никогда не поставляются). Комбинации роутера следуют тому же правилу на уровне модели: запись
> добавляется **только если модель отвечает `chat-200` и умеет вызывать инструменты** — модель без поддержки инструментов,
> мёртвый ключ или мёртвый провайдер отбрасывается, а не добавляется. Перезапускайте шаг проверки в любое время;
> сбои сообщаются, а не скрываются.

## 🧭 Как это работает

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

На аккаунт — две фазы, один свежий почтовый ящик и один свежий выход:

1. **Фаза браузера** — один изолированный контекст Chrome, привязанный к одному выходу. Загружается страница регистрации, разрешается собственная reCAPTCHA Enterprise на странице, и следует внутристраничный POST `RegisterWithEmail`. Ресурсы капчи кэшируются на диске один раз и раздаются каждому контексту оттуда, так что недолговечному выходу нужно пронести только небольшую страницу формы и POST. Если транспорт страницы умирает на полпути, POST регистрации повторяется из Node через ротированный выход.
2. **Пост-фаза** — обычный HTTP, с ротацией выходов, без браузера. Прочитать ящик → разрешить обёртку SendGrid из заголовка `Location` (GET без следования) → пройти маршрут ссылки подтверждения → bearer `AuthV2` → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → живая проверка → добавить в `keys.txt` и `accounts.json`.

## ⚙️ Опции CLI

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| Задача | Флаги |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (все в форме `=`, `--cross` = перекрёстная проверка ящика) |
| `verify` | `--keys=<file>` (по умолчанию `keys.txt`) · `--limit=N` (0 = все) |

Задача `help` диспетчера перечисляет задачи; флаги читаются как `--name=value`. `node src/launcher.js` предлагает mint · finish · verify · settings — заголовок показывает, сколько выходов содержит `proxies.txt` и сколько ключей на диске, а настройки сохраняются в `launcher.config.json`.

| Переменная окружения | По умолчанию | Значение |
| --- | --- | --- |
| `COHERE_MAILBOX` | loopback broker | бэкенд ящика (`emailnator`, если задано) |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap inbox | папка Mailtrap для захватов |

## 🛰️ За прокси

* `proxies.txt` — один выход на строку, `scheme://host:port` с `http` / `socks4` / `socks5`; поддерживаются учётные данные `user:pass@`, `#` начинает комментарий, а голый `host:port` по умолчанию использует `http://`. Пустые строки пропускаются.
* **Необязательно — рекомендуется при масштабе (лимиты на IP, баны).** HTTP-рельсы (`rpc`, `verify`, `recon`, `click-confirm`) работают и без прокси: при отсутствии файла пула запрос уходит напрямую, и запуск регистрирует выход как `direct`.
* **Предварительная проверка в точке использования (когда задан пул):** выход используется только после того, как он только что прошёл реальную проверку исходящего трафика; приватные/CGNAT-ответы отклоняются сразу. Браузерной регистрации всё ещё нужен пул — дашборд привязан к IP, а путь создания ключа построен на *прогретых* выходах (сначала запустите `probe.js`/`soak.js`).
* **Фаза с ротацией выходов:** пост-фаза повторяет попытки по всему пулу (маршрут подтверждения получает 12 попыток), а `verify` ротирует выходы при `403`, считая ключ нерабочим только при `401`.
* **Нет правила «аккаунт на выход»:** один выход может пронести много аккаунтов — в выпущенном пакете 5 выходов пронесли 15 ключей, а один из них пронёс 9.

## 📄 Файлы

| Путь | Содержимое |
| --- | --- |
| `keys.txt` | ключи, **по одному на строку**, добавляются в момент прохождения ключом живой проверки |
| `accounts.json` | одна запись на аккаунт: почтовый ящик, пароль, ключ, выход, через который он был создан |
| `out/` | каталоги запусков по попыткам (скриншоты + дампы DOM/сети), журнал пакета, учёт выходов |
| `src/models.json` | записывается `verify` — живой ответ `GET /v1/models` первого ключа, прошедшего проверку |

## 🔌 Подключение к 9Router

[9Router](https://9router.com) — это самостоятельно размещаемый OpenAI-совместимый роутер. Cohere OpenAI-совместим (эндпоинт совместимости `https://api.cohere.ai/compatibility/v1`), поэтому зарегистрируйте его один раз и используйте каждый ключ:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Каждый ключ в `keys.txt` становится одним подключением узла провайдера `cohere` (`--api-key <key>` регистрирует один ключ вместо этого, `--model <id>` переопределяет значение по умолчанию). Затем выберите модель внутри 9Router:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Направьте коннектор на обновлённый `keys.txt`, чтобы добавить больше аккаунтов; узел и его список моделей остаются теми же. `node src/launcher.js --connect-9router` выполняет ровно это и сначала запрашивает базовый URL и пароль.

Значения по умолчанию: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔌 Подключение к OmniRoute

[OmniRoute](https://omniroute.online) — это самостоятельно размещаемый OpenAI-совместимый роутер. Cohere OpenAI-совместим (эндпоинт совместимости `https://api.cohere.ai/compatibility/v1`), поэтому зарегистрируйте его один раз и используйте каждый ключ:

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Каждый ключ в `keys.txt` становится одним подключением узла провайдера `cohere` (`--api-key <key>` регистрирует один ключ вместо этого, `--model <id>` переопределяет значение по умолчанию). Затем выберите модель внутри OmniRoute:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Направьте коннектор на обновлённый `keys.txt`, чтобы добавить больше аккаунтов; узел и его список моделей остаются теми же. `node src/launcher.js --connect-omniroute` выполняет ровно это и сначала запрашивает базовый URL и пароль.

Значения по умолчанию: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 Что даёт один ключ

| | |
| --- | --- |
| 🏢 Провайдер | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 Что даёт провайдер | 1 пробный ключ на аккаунт (1 000 вызовов/месяц, когда действовала кампания) — гейт подтверждения через настоящий Chrome + SendGrid |
| 🔑 Что даёт один ключ | один API-ключ, привязанный к собственному аккаунту: 35 идентификаторов моделей на эндпоинте ниже, в пределах лимитов вашего плана. Квота живёт на **аккаунте**, именно поэтому этот инструмент создаёт один аккаунт на ключ |
| 🌐 Форма API | OpenAI-совместимая: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Ваши данные | связь только с cohere.com и настроенным вами бэкендом ящика; ключи остаются на вашей машине |

## 🐞 Проблемы

Cohere изменил RPC, маршрут подтверждения или политику регистрации? Инструмент останавливается на сбойном шаге и сообщает об этом. **[Откройте issue](../../issues)** с командой, которую вы запускали, и точным выводом — дампы по попыткам в `out/` (скриншоты, записи DOM и сети) делают сбои воспроизводимыми без утечки ключа. PR приветствуются.

## 📄 Лицензия

MIT © 2026 — см. [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>