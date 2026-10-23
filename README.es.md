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
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Inicio rápido](#-quick-start) · [🎁 Nivel gratuito](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-35-of-them) · [🧪 Usa la API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Cómo funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ Opciones](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Por qué existe esto

El nivel gratuito de Cohere vive en la **cuenta**: la consola acuña una clave API `TRIAL` por cuenta (registrada como **1.000 llamadas/mes por cuenta** mientras duró la campaña de prueba), y una clave de producción es un proceso aparte, condicionado por contrato. Así que la unidad útil es *una cuenta por clave*, nunca muchas claves de una sola cuenta.

El registro es pequeño — un campo de correo, una contraseña — pero la página solo produce una cuenta funcional cuando se ejecuta en un navegador real, con todo lo posterior al correo de confirmación en HTTP simple:

```
proxies.txt ─▶ verificación previa de salida (comprobación de egreso; CGNAT/IP propia rechazada)
                    │
                    ▼
  buzón nuevo ──▶ contexto de Chrome fijado a una salida
                    ├─ página de registro (el pequeño formulario SSR)
                    └─ RegisterWithEmail  → 200
                                  │
   correo (seguimiento de clics de SendGrid) ─▶ Location ─▶ /confirm-email?token=…
                                  │                └─ 307 ─▶ /api/auth/confirm_email  (el primer toque lo consume)
                                  ▼
            bearer AuthV2 ─▶ AgreeToOnboarding(PROFILE_SETUP) ─▶ GetOrCreateDefaultAPIKey
                                  │
        GET /v1/models 200 + POST /v1/chat 200  ◀── verificación en vivo ──┘
                                  ▼
                               keys.txt
```

## 🎁 Nivel gratuito — cuánto obtienes

El nivel gratuito de Cohere es la **clave de prueba en la cuenta** — **1.000 llamadas API por mes por cuenta** (la cuota registrada para la campaña; la consola en [dashboard.cohere.com](https://dashboard.cohere.com) siempre muestra tu plan y límites actuales, que Cohere puede cambiar). Una clave de producción está condicionada por contrato.

| Qué | Valor |
| --- | --- |
| Asignación de bienvenida | una clave `TRIAL` por cuenta — 1.000 llamadas/mes (campaña) |
| Tarjeta requerida | **No** |
| Registro | correo electrónico + contraseña en un navegador real; confirmación por enlace; acuerdo de incorporación |
| La unidad que escala | **una cuenta = una clave** → `--count N` son N presupuestos de prueba |
| Cómo ver tus límites | [dashboard.cohere.com](https://dashboard.cohere.com) — la fuente en vivo de los límites del plan |

> 💡 El nivel gratuito lo define Cohere y puede cambiar. Consulta los números en vivo en [cohere.com](https://cohere.com) — y deja que la propia puerta de la herramienta decida:

```bash
node src/cli.js --verify-only     # cada clave en keys.txt se vuelve a probar con una llamada de chat real
```

## 🤖 Modelos — los 35

Una clave verificada ve **todo el catálogo de la cuenta — 35 modelos** en `GET /v1/models`, escrito en [`src/models.json`](src/models.json) por la primera clave que pasa la verificación:

| Familia | Ejemplos |
| --- | --- |
| Command (chat/generación) | `command-a-03-2025`, `command-a-plus-05-2026`, `command-a-reasoning-08-2025`, `command-a-translate-08-2025`, `command-a-vision-07-2025` |
| Command R | `command-r-08-2024`, `command-r-plus-08-2024`, `command-r7b-12-2024`, `command-r7b-arabic-02-2025` |
| Tiny Aya (modelos pequeños) | `tiny-aya-earth`, `tiny-aya-fire`, `tiny-aya-global`, `tiny-aya-water` |
| Embed | `embed-v4.0`, `embed-v5.0-pro`, `embed-v5.0-fast`, `embed-english-v3.0`, `embed-multilingual-v3.0` |
| Rerank | `rerank-v4.0-pro`, `rerank-v4.0-fast`, `rerank-v3.5`, `rerank-english-v3.0`, `rerank-multilingual-v3.0` |
| Aya / voz / código | `c4ai-aya-expanse-32b`, `c4ai-aya-vision-32b`, `cohere-transcribe-03-2026`, `north-mini-code-1-0` |

Prueba en vivo de una clave:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 Cómo usar la API

La clave API de Cohere (`Bearer <key>`) llega al endpoint de compatibilidad `https://api.cohere.com/compatibility/v1` — compatible con OpenAI — y al endpoint de chat nativo `https://api.cohere.com/v1/chat`. La misma clave responde a ambos; 9Router apunta a la URL de compatibilidad.

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

# 1) tu lista de proxies, una salida por línea (http://, socks5://, socks4:// o host:port simple) — opcional
printf 'http://127.0.0.1:8080\n' > proxies.txt   # opcional — sin un pool, los raíles HTTP van directos

# 2) buzones — un broker local que reparte bandejas desechables por HTTP simple

#    (un broker respaldado por Mailtrap en :9700 sirvió el lote incluido; un broker
#     de inboxes.com en :9701 es el respaldo integrado)

# 3) adelante
node src/launcher.js                    # menú interactivo: acuñar / terminar / verificar / ajustes
node src/cli.js mint --count=30         # crea cuentas nuevas y acuña una clave para cada una
node src/cli.js verify --keys=keys.txt  # vuelve a comprobar las claves que ya están en disco

# la fase de registro maneja un Chrome real por CDP — Google Chrome debe estar instalado
```

Lo que queda en disco mientras se ejecuta:

| Ruta | Contenido |
| --- | --- |
| `src/` | la herramienta — ejecútala como `node src/<file>.js` desde la raíz del repositorio (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | las claves, **una por línea**, añadidas en el momento en que una clave pasa la comprobación en vivo |
| `accounts.json` | un registro por cuenta: buzón, contraseña, clave, la salida que la acuñó |
| `out/` | directorios de ejecución por intento (capturas de pantalla + volcados de DOM/red), el registro del lote, contabilidad de salidas |
| `src/models.json` | escrito por `verify` — la respuesta en vivo de `GET /v1/models` de la primera clave que verifica |

### 🖱️ El lanzador

El lanzador es `src/launcher.js`: un menú sobre acuñar / terminar / verificar / ajustes (+ 9Router). Recuerda `count`/`conc` en `launcher.config.json` y muestra cuántas salidas contiene `proxies.txt` y cuántas claves hay en disco en el encabezado. `node src/launcher.js --connect-9router` registra las claves con un 9Router local.

## ✅ Verificado y funcionando — cada clave se prueba

Una clave se escribe en `keys.txt` solo después de que la API en vivo responda con ella:

| comprobación | llamada | esperado |
| --- | --- | --- |
| autenticación + lista de modelos | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| generación real | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` con texto |

El lote desde el que se publicó este repositorio, medido a partir de los registros de ejecución:

| Medición | Resultado |
| --- | --- |
| Cadena completa | **cada cuenta acuñó su propia clave** el 2026-10-14, 19:16–20:07 — registro → correo → confirmación → incorporación → clave |
| Verificación | **verificado y funcionando** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Política de prueba | una clave cuya comprobación en vivo no responde limpia **no** se escribe — la herramienta prefiere una clave ausente antes que una no probada |
| Ruta de confirmación | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — el primer toque consume el token |
| Puerta de incorporación | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, llamada de clave `200`; sin ella `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduce ambas comprobaciones para tu propio archivo
```

> **Puertas de calidad.** Cada clave aquí pasó un `chat-200` en vivo antes de escribirse en `keys.txt`
> (las claves muertas nunca se publican). Las combinaciones del router siguen la misma regla a nivel de modelo: una entrada se
> añade **solo si el modelo responde `chat-200` y puede llamar a herramientas** — un modelo sin soporte de herramientas,
> una clave muerta o un proveedor muerto se descarta en lugar de añadirse. Vuelve a ejecutar el paso de verificación cuando quieras;
> los fallos se reportan, nunca se ocultan.

## 🧭 Cómo funciona

```
bandeja (una dirección por cuenta)                                  una dirección nueva por cuenta
   │
   ├─▶ registro: página de Cohere → dirección de correo → código / enlace desde la bandeja
   ├─▶ sesión: las cookies de la cuenta o el token de acceso en mano
   ├─▶ acuñación de clave: el endpoint de clave de la cuenta → clave en texto plano devuelta una vez (escrita a disco de inmediato)
   └─▶ prueba en vivo: POST https://api.cohere.ai/compatibility/v1/chat/completions → contenido real = la clave está viva
```

Por cuenta, dos fases, un buzón nuevo y una salida nueva:

1. **Fase de navegador** — un contexto de Chrome aislado, fijado a una salida. La página de registro carga, el desafío reCAPTCHA Enterprise de la propia página se resuelve, y el POST `RegisterWithEmail` dentro de la página sigue. Los recursos del captcha se almacenan en caché en disco una vez y se sirven a cada contexto desde ahí, así que una salida de corta vida solo tiene que transportar la pequeña página del formulario y el POST. Si el transporte de la página muere a mitad de vuelo, el POST de registro se reintenta desde Node a través de una salida rotada.
2. **Fase posterior** — HTTP simple, con rotación de salidas, sin navegador. Leer la bandeja → resolver el envoltorio de SendGrid desde el encabezado `Location` (con un GET sin seguimiento) → consumir la ruta del enlace de confirmación → bearer `AuthV2` → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → verificación en vivo → añadir a `keys.txt` y `accounts.json`.

## ⚙️ Opciones de CLI

```bash
node src/cli.js mint   --count=30        # crea cuentas nuevas y acuña una clave para cada una
node src/cli.js finish                   # inicia sesión en cuentas ya creadas y termina su clave
node src/cli.js verify --keys=keys.txt   # vuelve a comprobar claves que ya están en disco
node src/cli.js help                     # tareas y flags
```

| Tarea | Flags |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (todos en forma `=`, `--cross` = comprobación cruzada de la bandeja) |
| `verify` | `--keys=<file>` (por defecto `keys.txt`) · `--limit=N` (0 = todas) |

La tarea `help` del despachador lista las tareas; los flags se leen como `--name=value`. `node src/launcher.js` ofrece acuñar · terminar · verificar · ajustes — el encabezado muestra cuántas salidas contiene `proxies.txt` y cuántas claves hay en disco, y los ajustes persisten en `launcher.config.json`.

| Variable de entorno | Por defecto | Significado |
| --- | --- | --- |
| `COHERE_MAILBOX` | broker de loopback | backend de bandeja (`emailnator` cuando se establece) |
| `COHERE_MAILTRAP_FOLDER` | bandeja de Mailtrap | carpeta de Mailtrap para capturas |

## 🛰️ Detrás de un proxy

* `proxies.txt` — una salida por línea, `scheme://host:port` con `http` / `socks4` / `socks5`; se admiten credenciales `user:pass@`, `#` inicia un comentario, y un `host:port` simple usa `http://` por defecto. Las líneas en blanco se omiten.
* **Opcional — recomendado a escala (límites por IP, bloqueos).** Los raíles HTTP (`rpc`, `verify`, `recon`, `click-confirm`) funcionan también sin proxy: sin archivo de pool, la petición sale directamente y la ejecución registra la salida como `direct`.
* **Verificación previa en el punto de uso (cuando se da un pool):** una salida se usa solo después de haber llevado justo una comprobación de egreso real; las respuestas privadas/CGNAT se rechazan de plano. El registro en navegador sigue queriendo un pool — el panel está restringido por IP y la ruta de acuñación se construye sobre salidas *soak* (ejecuta `probe.js`/`soak.js` primero).
* **Fase con rotación de salidas:** la fase posterior reintenta a través de todo el pool (la ruta de confirmación recibe 12 intentos), y `verify` rota salidas en `403` mientras que solo falla una clave en `401`.
* **Sin regla de una cuenta por salida:** una salida puede llevar muchas cuentas — en el lote publicado, 5 salidas llevaron 15 claves y una de ellas llevó 9.

## 📄 Archivos

| Ruta | Contenido |
| --- | --- |
| `keys.txt` | las claves, **una por línea**, añadidas en el momento en que una clave pasa la comprobación en vivo |
| `accounts.json` | un registro por cuenta: buzón, contraseña, clave, la salida que la acuñó |
| `out/` | directorios de ejecución por intento (capturas de pantalla + volcados de DOM/red), el registro del lote, contabilidad de salidas |
| `src/models.json` | escrito por `verify` — la respuesta en vivo de `GET /v1/models` de la primera clave que verifica |

## 🔌 Conectar con 9Router

[9Router](https://9router.com) es un router autoalojado compatible con OpenAI. Cohere es compatible con OpenAI (endpoint de compatibilidad `https://api.cohere.ai/compatibility/v1`), así que regístralo una vez y usa todas las claves:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Cada clave en `keys.txt` se convierte en una conexión del nodo proveedor `cohere` (`--api-key <key>` registra una sola clave en su lugar, `--model <id>` sobrescribe el valor por defecto). Luego elige un modelo dentro de 9Router:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Apunta el conector a un `keys.txt` actualizado para añadir más cuentas; el nodo y su lista de modelos siguen igual. `node src/launcher.js --connect-9router` ejecuta exactamente esto y pregunta primero por la URL base y la contraseña.

Valores por defecto: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔌 Conectar con OmniRoute

[OmniRoute](https://omniroute.online) es un router autoalojado compatible con OpenAI. Cohere es compatible con OpenAI (endpoint de compatibilidad `https://api.cohere.ai/compatibility/v1`), así que regístralo una vez y usa todas las claves:

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Cada clave en `keys.txt` se convierte en una conexión del nodo proveedor `cohere` (`--api-key <key>` registra una sola clave en su lugar, `--model <id>` sobrescribe el valor por defecto). Luego elige un modelo dentro de OmniRoute:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Apunta el conector a un `keys.txt` actualizado para añadir más cuentas; el nodo y su lista de modelos siguen igual. `node src/launcher.js --connect-omniroute` ejecuta exactamente esto y pregunta primero por la URL base y la contraseña.

Valores por defecto: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 Qué te da una clave

| | |
| --- | --- |
| 🏢 Proveedor | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 Qué da el proveedor | 1 clave de prueba por cuenta (1.000 llamadas/mes cuando se ejecutó la campaña) — Chrome real + puerta de confirmación de SendGrid |
| 🔑 Qué te da una clave | una clave API limitada a su propia cuenta: los 35 ids de modelo en el endpoint de abajo, a los límites de tu plan. La cuota vive en la **cuenta**, que es exactamente por lo que esta herramienta crea una cuenta por clave |
| 🌐 Forma de la API | Compatible con OpenAI: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Tus datos | solo se contacta con cohere.com y el backend de bandeja que configures; las claves se quedan en tu máquina |

## 🐞 Problemas

¿Cohere cambió el RPC, la ruta de confirmación o la política de registro? La herramienta se detiene en el paso que falla y lo dice. **[Abre un issue](../../issues)** con el comando que ejecutaste y la salida exacta — los volcados por intento bajo `out/` (capturas de pantalla, registros de DOM y red) hacen que los fallos sean reproducibles sin filtrar una clave. Los PR son bienvenidos.

## 📄 Licencia

MIT © 2026 — consulta [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>