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

**Crea cuentas de Cohere en masa con claves API autogeneradas — inferencia compatible con OpenAI + conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Inicio rápido](#-quick-start) · [🎁 Nivel gratuito](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-35-of-them) · [🧪 Usar la API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Cómo funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Opciones](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>





---

## ✨ Por qué existe esto

El nivel gratuito de Cohere reside en la **cuenta**: la consola emite una clave API `TRIAL` por cuenta (registrada como **1.000 llamadas/mes por cuenta** mientras duró la campaña de prueba), y una clave de producción es un proceso aparte, condicionado a un contrato. Así que la unidad útil es *una cuenta por clave*, nunca muchas claves de una sola cuenta.

El registro es pequeño — un campo de correo, una contraseña — pero la página solo produce una cuenta funcional cuando se ejecuta en un navegador real, con todo lo posterior al correo de confirmación en HTTP simple:

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

## 🎁 Nivel gratuito — cuánto obtienes

El nivel gratuito de Cohere es la **clave de prueba de la cuenta** — **1.000 llamadas API al mes por cuenta** (la cuota registrada para la campaña; la consola en [dashboard.cohere.com](https://dashboard.cohere.com) siempre muestra tu plan y límites actuales, que Cohere puede cambiar). Una clave de producción está condicionada a un contrato.

| Qué | Valor |
| --- | --- |
| Asignación de bienvenida | una clave `TRIAL` por cuenta — 1.000 llamadas/mes (campaña) |
| Tarjeta requerida | **No** |
| Registro | correo + contraseña en un navegador real; confirmación por enlace; acuerdo de incorporación |
| La unidad que escala | **una cuenta = una clave** → `--count N` son N presupuestos de prueba |
| Cómo ver tus límites | [dashboard.cohere.com](https://dashboard.cohere.com) — la fuente en vivo de los límites del plan |

> 💡 El nivel gratuito lo define Cohere y puede cambiar. Consulta las cifras en vivo en [cohere.com](https://cohere.com) — y deja que el propio filtro de la herramienta decida:

```bash
node src/cli.js verify --keys=keys.txt     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modelos — los 35

Una clave verificada ve **todo el catálogo de la cuenta — 35 modelos** en `GET /v1/models`, escrito en [`src/models.json`](src/models.json) por la primera clave que pasa la verificación:

La prueba de chat en vivo (2026-10-19, 2 claves) respondió `200` en estos 17 ids; las entradas restantes del catálogo son ids de embedding / rerank / transcribe que el endpoint de compatibilidad no sirve:

|Modelo|✓|
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

Prueba en vivo de una clave:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 Cómo usar la API

La clave API de Cohere (`Bearer <key>`) llega al endpoint de compatibilidad `https://api.cohere.com/compatibility/v1` — compatible con OpenAI — y al endpoint nativo de chat `https://api.cohere.com/v1/chat`. La misma clave responde a ambos; 9Router apunta a la URL de compatibilidad.

**Cualquier SDK / curl (compatibilidad):**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**Chat nativo (lo que usa el verificador):**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 Inicio rápido

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

Qué queda en disco mientras se ejecuta:

| Ruta | Contenido |
| --- | --- |
| `src/` | la herramienta — ejecútala como `node src/<file>.js` desde la raíz del repositorio (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | las claves, **una por línea**, añadidas en el momento en que una clave pasa la comprobación en vivo |
| `accounts.json` | un registro por cuenta: buzón, contraseña, clave, la salida que la emitió |
| `out/` | directorios de ejecución por intento (capturas de pantalla + volcados de DOM/red), el registro del lote, contabilidad de salidas |
| `src/models.json` | escrito por `verify` — la respuesta en vivo de `GET /v1/models` de la primera clave que se verifica |

### 🖱️ El lanzador

El lanzador es `src/launcher.js`: un menú sobre mint / finish / verify / settings (+ 9Router). Recuerda `count`/`conc` en `launcher.config.json` y muestra en la cabecera cuántas salidas contiene `proxies.txt` y cuántas claves hay en disco. `node src/launcher.js --connect-9router` registra las claves con un 9Router local.

## ✅ Verificado y funcionando — cada clave se prueba

Una clave se escribe en `keys.txt` solo después de que la API en vivo responda con ella:

| comprobación | llamada | esperado |
| --- | --- | --- |
| autenticación + lista de modelos | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| generación real | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` con texto |

El lote con el que se publicó este repositorio, medido a partir de los registros de ejecución:

| Medición | Resultado |
| --- | --- |
| Cadena completa | **15 cuentas → 15 claves** el 2026-10-14, 19:16–20:07 — registro → correo → confirmación → incorporación → clave |
| Verificación | **15/15 en vivo** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Política de prueba | una clave cuya comprobación en vivo no responde limpiamente **no** se escribe — la herramienta prefiere una clave ausente antes que una no probada |
| Ruta de confirmación | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — el primer acceso consume el token |
| Puerta de incorporación | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, llamada de clave `200`; sin ella `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

## 🧭 Cómo funciona

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

Por cuenta, dos fases, un buzón nuevo y una salida nueva:

1. **Fase de navegador** — un contexto de Chrome aislado, fijado a una salida. Se carga la página de registro, se resuelve el desafío reCAPTCHA Enterprise de la propia página y sigue el POST `RegisterWithEmail` dentro de la página. Los recursos del captcha se almacenan en caché en disco una vez y se sirven a todos los contextos desde ahí, así que una salida efímera solo tiene que transportar la pequeña página del formulario y el POST. Si el transporte de la página muere a mitad de vuelo, el POST de registro se reintenta desde Node a través de una salida rotada.
2. **Fase posterior** — HTTP simple, rotando salidas, sin navegador. Leer el buzón → resolver el envoltorio de SendGrid desde la cabecera `Location` (con un GET sin seguimiento) → consumir la ruta del enlace de confirmación → bearer `AuthV2` → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → verificación en vivo → añadir a `keys.txt` y `accounts.json`.

## ⚙️ Opciones de CLI

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| Tarea | Flags |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (todos en forma `=`; `--cross` = verificación cruzada del buzón) |
| `verify` | `--keys=<file>` (por defecto `keys.txt`) · `--limit=N` (0 = todas) |

Se recomienda turbo (5); más supone riesgo de carga/ban en equipos débiles.

La tarea `help` del despachador lista las tareas; los flags se leen como `--name=value`. `node src/launcher.js` ofrece mint · finish · verify · settings — la cabecera muestra cuántas salidas contiene `proxies.txt` y cuántas claves hay en disco, y la configuración persiste en `launcher.config.json`.

| Variable de entorno | Valor por defecto | Significado |
| --- | --- | --- |
| `COHERE_MAILBOX` | broker de loopback | backend de buzón (`emailnator` cuando se establece) |
| `COHERE_MAILTRAP_FOLDER` | buzón de Mailtrap | carpeta de Mailtrap para las capturas |

## 🛰️ Detrás de un proxy

* `proxies.txt` — una salida por línea, `scheme://host:port` con `http` / `socks4` / `socks5`; se admiten credenciales `user:pass@`, `#` inicia un comentario y un `host:port` sin esquema usa `http://` por defecto. Las líneas en blanco se omiten.
* **Comprobación previa en el punto de uso:** una salida se usa solo después de haber llevado justo antes una comprobación real de egreso; las respuestas privadas/CGNAT se rechazan de plano. El tráfico objetivo solo sale por una salida del pool.
* **Fase de rotación de salidas:** la fase posterior reintenta en todo el pool (la ruta de confirmación tiene 12 intentos), y `verify` rota salidas ante `403` mientras que solo marca una clave como fallida ante `401`.
* **Sin regla de una cuenta por salida:** una salida puede transportar muchas cuentas — en el lote publicado, 5 salidas transportaron 15 claves y una de ellas transportó 9.

## 📄 Archivos

| Ruta | Contenido |
| --- | --- |
| `keys.txt` | las claves, **una por línea**, añadidas en el momento en que una clave pasa la comprobación en vivo |
| `accounts.json` | un registro por cuenta: buzón, contraseña, clave, la salida que la emitió |
| `out/` | directorios de ejecución por intento (capturas de pantalla + volcados de DOM/red), el registro del lote, contabilidad de salidas |
| `src/models.json` | escrito por `verify` — la respuesta en vivo de `GET /v1/models` de la primera clave que se verifica |

## 🔌 Conectar con 9Router

[9Router](https://9router.com) es un router autoalojado y compatible con OpenAI. Cohere es compatible con OpenAI (endpoint de compatibilidad `https://api.cohere.ai/compatibility/v1`), así que regístralo una vez y usa todas las claves:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Cada clave en `keys.txt` se convierte en una conexión del nodo proveedor `cohere` (`--api-key <key>` registra una sola clave en su lugar, `--model <id>` sobrescribe el valor por defecto). Después elige un modelo dentro de 9Router:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Apunta el conector a un `keys.txt` actualizado para añadir más cuentas; el nodo y su lista de modelos permanecen iguales. `node src/launcher.js --connect-9router` ejecuta exactamente esto y pregunta primero por la URL base y la contraseña.

Valores por defecto: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 Qué te da una clave

| | |
| --- | --- |
| 🏢 Proveedor | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 Qué ofrece el proveedor | 1 clave de prueba por cuenta (1.000 llamadas/mes cuando se ejecutó la campaña) — Chrome real + puerta de confirmación de SendGrid |
| 🔑 Qué te da una clave | una clave API limitada a su propia cuenta: los 35 ids de modelo en el endpoint de abajo, con los límites de tu plan. La cuota reside en la **cuenta**, que es exactamente por lo que esta herramienta crea una cuenta por clave |
| 🌐 Forma de la API | Compatible con OpenAI: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Tus datos | solo se contacta con cohere.com y el backend de buzón que configures; las claves permanecen en tu máquina |

## 🐞 Problemas

¿Cohere cambió el RPC, la ruta de confirmación o la política de registro? La herramienta se detiene en el paso que falla y lo indica. **[Abre un issue](../../issues)** con el comando que ejecutaste y la salida exacta — los volcados por intento en `out/` (capturas de pantalla, registros de DOM y red) hacen que los fallos sean reproducibles sin filtrar una clave. Se aceptan PRs.

## 📄 Licencia

MIT © 2026 — consulta [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 colaboradores de cohere-bulk-apikey

</div>