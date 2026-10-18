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

**Creación masiva de cuentas de Cohere con claves API generadas automáticamente — inferencia compatible con OpenAI + conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Inicio rápido](#-quick-start) · [🎁 Capa gratuita](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-35-of-them) · [🧪 Usar la API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Cómo funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Opciones](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>



---

## ✨ Por qué existe esto

La capa gratuita de Cohere depende de la **cuenta**: la consola genera una clave API `TRIAL` por cuenta (registrada como **1.000 llamadas/mes por cuenta** mientras duró la campaña de prueba), y una clave de producción requiere un proceso separado con contrato. Por tanto, la unidad útil es *una cuenta por clave*, nunca múltiples claves desde una sola cuenta.

El registro es sencillo — solo un campo de correo y una contraseña — pero la página solo crea una cuenta funcional cuando se ejecuta en un navegador real, y todo lo posterior al correo de confirmación es HTTP plano:

```
proxies.txt ─▶ salida preflight (comprobación de egreso; CGNAT/IP propia rechazada)
                    │
                    ▼
  buzón nuevo ──▶ contexto Chrome vinculado a una salida
                    ├─ página de registro (el pequeño formulario SSR)
                    └─ RegisterWithEmail  → 200
                                  │
   correo (rastreo de clics de SendGrid) ─▶ Location ─▶ /confirm-email?token=…
                                  │                └─ 307 ─▶ /api/auth/confirm_email  (el primer acceso consume el token)
                                  ▼
            portador AuthV2 ─▶ AgreeToOnboarding(PROFILE_SETUP) ─▶ GetOrCreateDefaultAPIKey
                                  │
        GET /v1/models 200 + POST /v1/chat 200  ◀── verificación en vivo ──┘
                                  ▼
                               keys.txt
```

## 🎁 Capa gratuita — lo que obtienes

La capa gratuita de Cohere es la **clave de prueba en la cuenta** — **1.000 llamadas API por mes por cuenta** (la cuota registrada durante la campaña; la consola en [dashboard.cohere.com](https://dashboard.cohere.com) siempre muestra tu plan y límites actuales, que Cohere puede modificar). Una clave de producción requiere contrato.

| Qué | Valor |
| --- | --- |
| Crédito inicial | una clave `TRIAL` por cuenta — 1.000 llamadas/mes (durante la campaña) |
| Tarjeta requerida | **No** |
| Registro | correo + contraseña en navegador real; confirmación por enlace; aceptación del proceso de incorporación |
| Unidad escalable | **una cuenta = una clave** → `--count N` equivale a N presupuestos de prueba |
| Cómo ver tus límites | [dashboard.cohere.com](https://dashboard.cohere.com) — fuente oficial en tiempo real de los límites del plan |

> 💡 La capa gratuita es definida por Cohere y puede cambiar. Consulta los valores actuales en [cohere.com](https://cohere.com) — y deja que el propio sistema del herramienta decida:

```bash
node src/cli.js verify --keys=keys.txt     # cada clave en keys.txt se vuelve a probar con una llamada real de chat
```

## 🤖 Modelos — los 35 disponibles

Una clave verificada ve todo el catálogo de la cuenta — **35 modelos** en `GET /v1/models`, escritos en [`src/models.json`](src/models.json) por la primera clave que pase la verificación:

|Modelo|✓|
|---|---|
|`command-a-03-2025`|✓|

Prueba en vivo con una clave:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <una de tus claves>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Responde con la palabra única: ok","max_tokens":8}'
```

## 🧪 Cómo usar la API

La clave API de Cohere (`Bearer <clave>`) accede al punto de conexión de compatibilidad `https://api.cohere.com/compatibility/v1` — compatible con OpenAI — y al punto de conexión de chat nativo `https://api.cohere.com/v1/chat`. La misma clave responde ambos; 9Router apunta al URL de compatibilidad.

**Cualquier SDK / curl (compatibilidad):**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <una de tus claves>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hola"}]}'
```

**Chat nativo (lo que usa el verificador):**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <una de tus claves>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hola","max_tokens":8}'
```

## 🛠 Inicio rápido

```bash
git clone https://github.com/F0Rextasy/cohere-bulk-apikey.git
cd cohere-bulk-apikey

# 1) tu lista de proxies, una salida por línea (http://, socks5://, socks4:// o host:puerto simple)
printf 'http://127.0.0.1:8080\n' > proxies.txt

# 2) buzones — un intermediario local que entrega buzones descartables mediante HTTP simple
#    (un intermediario basado en Mailtrap en :9700 sirvió el lote enviado; un intermediario en inboxes.com
#     en :9701 es la opción predeterminada)

# 3) adelante
node src/launcher.js                    # menú interactivo: crear / finalizar / verificar / ajustes
node src/cli.js mint --count=30         # crear cuentas nuevas y generar una clave por cuenta
node src/cli.js verify --keys=keys.txt  # volver a comprobar las claves ya en disco

# la fase de registro controla un Chrome real mediante CDP — debe tener Google Chrome instalado
```

Lo que se guarda en disco durante la ejecución:

| Ruta | Contenido |
| --- | --- |
| `src/` | la herramienta — ejecútala como `node src/<archivo>.js` desde la raíz del repositorio (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | las claves, **una por línea**, añadidas inmediatamente tras pasar la comprobación en vivo |
| `accounts.json` | un registro por cuenta: buzón, contraseña, clave, salida que la generó |
| `out/` | directorios por intento (capturas de pantalla + volcados DOM/red), registro del lote, seguimiento de salidas |
| `src/models.json` | generado por `verify` — respuesta real de `GET /v1/models` de la primera clave verificada |

### 🖱️ El lanzador

El lanzador es `src/launcher.js`: un menú para crear / finalizar / verificar / ajustes (+ 9Router). Recuerda `count`/`conc` en `launcher.config.json` y muestra cuántas salidas tiene `proxies.txt` y cuántas claves hay en disco en el encabezado. `node src/launcher.js --connect-9router` registra las claves con un 9Router local.

## ✅ Verificado y funcional — cada clave es probada

Una clave se escribe en `keys.txt` solo tras obtener respuesta de la API en vivo:

| comprobación | llamada | esperado |
| --- | --- | --- |
| autenticación + lista de modelos | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| generación real | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` con texto |

El lote con el que se distribuyó este repositorio, medido a partir de los registros de ejecución:

| Medición | Resultado |
| --- | --- |
| Cadena completa | **15 cuentas → 15 claves** el 2026-10-14, 19:16–20:07 — registro → correo → confirmación → incorporación → clave |
| Verificación | **15/15 activas** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Política de prueba | una clave cuya verificación no responde correctamente **no** se escribe — la herramienta prefiere una clave faltante a una no verificada |
| Ruta de confirmación | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — el primer acceso consume el token |
| Puerta de incorporación | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, llamada de clave `200`; sin esto `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduce ambas comprobaciones para tu propio archivo
```

## 🧭 Cómo funciona

```
buzón (una dirección por cuenta)                                  una dirección nueva por cuenta
   │
   ├─▶ registro: página de Cohere → dirección de correo → código / enlace desde el buzón
   ├─▶ sesión: cookies de la cuenta o token de acceso disponibles
   ├─▶ generación de clave: punto de acceso de clave de la cuenta → clave en texto plano devuelta una vez (escrita inmediatamente en disco)
   └─▶ prueba en vivo: POST https://api.cohere.ai/compatibility/v1/chat/completions → contenido real = clave activa
```

Por cuenta, dos fases, un buzón nuevo y una salida nueva:

1. **Fase del navegador** — un contexto Chrome aislado, vinculado a una salida. Se carga la página de registro, se resuelve el desafío reCAPTCHA Enterprise de la página, y sigue el POST `RegisterWithEmail` interno. Los recursos del captcha se almacenan en caché en disco una vez y se sirven a cada contexto desde allí, por lo que una salida de corta duración solo debe transportar la pequeña página del formulario y el POST. Si el transporte de la página falla a mitad de camino, el POST de registro se reintenta desde Node mediante una salida rotada.
2. **Fase posterior** — HTTP plano, rotación de salidas, sin navegador. Leer el buzón → resolver el contenedor SendGrid del encabezado `Location` (con un GET sin seguimiento) → consumir la ruta del enlace de confirmación → portador `AuthV2` → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → verificación en vivo → añadir a `keys.txt` y `accounts.json`.

## ⚙️ Opciones CLI

```bash
node src/cli.js mint   --count=30        # crear cuentas nuevas y generar una clave por cuenta
node src/cli.js finish                   # iniciar sesión en cuentas ya creadas y finalizar su clave
node src/cli.js verify --keys=keys.txt   # volver a comprobar claves ya en disco
node src/cli.js help                     # tareas y banderas
```

| Tarea | Banderas |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <puerto>` (9700) · `--port N` (CDP de Chrome, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<dir>` · `--password=<pw>` · `--registered=<en>` (todos en forma `=`, `--cross` = comprobación cruzada del buzón) |
| `verify` | `--keys=<archivo>` (por defecto `keys.txt`) · `--limit=N` (0 = todas) |

Se recomienda Turbo (5); más puede aumentar el riesgo de carga o bloqueo en equipos débiles.

La tarea `help` del distribuidor lista las tareas; las banderas se leen como `--name=value`. `node src/launcher.js` ofrece crear · finalizar · verificar · ajustes — el encabezado muestra cuántas salidas tiene `proxies.txt` y cuántas claves hay en disco, y los ajustes se guardan en `launcher.config.json`.

| Variable de entorno | Predeterminado | Significado |
| --- | --- | --- |
| `COHERE_MAILBOX` | intermediario loopback | backend de buzón (`emailnator` si se establece) |
| `COHERE_MAILTRAP_FOLDER` | buzón Mailtrap | carpeta Mailtrap para capturas |

## 🛰️ Detrás de un proxy

* `proxies.txt` — una salida por línea, `esquema://host:puerto` con `http` / `socks4` / `socks5`; se admiten credenciales `user:pass@`, `#` inicia un comentario, y un `host:puerto` simple predetermina a `http://`. Las líneas vacías se omiten.
* **Preflight en el punto de uso:** una salida solo se usa tras pasar una comprobación real de egreso; se rechazan respuestas privadas/CGNAT de inmediato. El tráfico solo sale a través de una salida del grupo.
* **Fase con rotación de salidas:** la fase posterior reintenta en todo el grupo (la ruta de confirmación tiene 12 intentos), y `verify` rota salidas ante `403`, fallando una clave solo ante `401`.
* **Sin regla de una cuenta por salida:** una salida puede transportar muchas cuentas — en el lote enviado, 5 salidas transportaron 15 claves y una de ellas transportó 9.

## 📄 Archivos

| Ruta | Contenido |
| --- | --- |
| `keys.txt` | las claves, **una por línea**, añadidas inmediatamente tras pasar la comprobación en vivo |
| `accounts.json` | un registro por cuenta: buzón, contraseña, clave, salida que la generó |
| `out/` | directorios por intento (capturas de pantalla + volcados DOM/red), registro del lote, seguimiento de salidas |
| `src/models.json` | generado por `verify` — respuesta real de `GET /v1/models` de la primera clave verificada |

## 🔌 Conectar a 9Router

[9Router](https://9router.com) es un enrutador autohospedado compatible con OpenAI. Cohere es compatible con OpenAI (punto de conexión de compatibilidad `https://api.cohere.ai/compatibility/v1`), así que regístralo una vez y usa todas las claves:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Cada clave en `keys.txt` se convierte en una conexión del nodo proveedor `cohere` (`--api-key <clave>` registra una sola clave, `--model <id>` sobrescribe el predeterminado). Luego elige un modelo dentro de 9Router:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Apunta el conector a un `keys.txt` actualizado para añadir más cuentas; el nodo y su lista de modelos permanecen iguales. `node src/launcher.js --connect-9router` ejecuta exactamente esto y primero solicita la URL base y la contraseña.

Valores predeterminados: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 Lo que obtienes con una clave

| | |
| --- | --- |
| 🏢 Proveedor | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 Lo que ofrece el proveedor | 1 clave de prueba por cuenta (1.000 llamadas/mes durante la campaña) — navegador Chrome real + puerta de confirmación SendGrid |
| 🔑 Lo que obtienes con una clave | una clave API vinculada a su propia cuenta: los 35 IDs de modelo en el punto de conexión inferior, según los límites de tu plan. La cuota reside en la **cuenta**, razón exacta por la que esta herramienta crea una cuenta por clave |
| 🌐 Formato de API | Compatible con OpenAI: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Tus datos | solo cohere.com y el backend de buzón que configures son contactados; las claves permanecen en tu máquina |

## 🐞 Problemas

¿Cohere cambió el RPC, la ruta de confirmación o la política de registro? La herramienta se detiene en el paso fallido y lo indica. **[Abre un problema](../../issues)** con el comando ejecutado y la salida exacta — los volcados por intento bajo `out/` (capturas, registros DOM y red) hacen reproducible el fallo sin filtrar claves. Se aceptan PRs.

## 📄 Licencia

MIT © 2026 — ver [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 colaboradores de cohere-bulk-apikey

</div>