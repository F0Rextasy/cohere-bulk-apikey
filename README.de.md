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

**Massenhaft Cohere‑Konten mit automatisch generierten API‑Schlüsseln erstellen — OpenAI‑kompatible Inferenz + 9Router‑Connector.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Schnellstart](#-quick-start) · [🎁 Gratis‑Stufe](#-free-tier--how-much-you-get) · [🤖 Modelle](#-models--all-35-of-them) · [🧪 API benutzen](#-how-to-use-the-api) · [✅ Verifiziert](#-verified-working--every-key-is-tested) · [🧭 Wie es funktioniert](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Optionen](#️-cli-options) · [🛰️ Hinter einem Proxy](#️-behind-a-proxy) · [🐞 Probleme](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Warum das existiert

Cohere‑s Gratis‑Stufe ist an das **Konto** gebunden: Die Konsole erzeugt einen `TRIAL`‑API‑Schlüssel pro Konto (aufgezeichnet als **1.000 Aufrufe/Monat pro Konto**, solange die Testkampagne lief), und ein Produktionsschlüssel ist ein separater, vertragsgebundener Prozess. Daher ist die nützliche Einheit *ein Konto pro Schlüssel*, niemals viele Schlüssel von einem Konto.

Sign‑up ist klein — ein E‑Mail‑Feld, ein Passwort — aber die Seite erzeugt nur ein funktionierendes Konto, wenn sie in einem echten Browser läuft, wobei alles nach der Bestätigungs‑Mail über einfaches HTTP erfolgt:

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

## 🎁 Gratis‑Stufe — was Sie erhalten

Cohere‑s Gratis‑Stufe ist der **Testschlüssel im Konto** — **1.000 API‑Aufrufe pro Monat pro Konto** (das für die Kampagne aufgezeichnete Kontingent; die Konsole unter [dashboard.cohere.com](https://dashboard.cohere.com) zeigt stets Ihren aktuellen Plan und die Limits, die Cohere ändern kann). Ein Produktionsschlüssel ist vertragsgebunden.

| Was | Wert |
| --- | --- |
| Willkommenszuteilung | ein `TRIAL`‑Schlüssel pro Konto — 1.000 Aufrufe/Monat (Kampagne) |
| Karte erforderlich | **Nein** |
| Registrierung | E‑Mail + Passwort in einem echten Browser; E‑Mail‑Bestätigung per Link; Onboarding‑Vereinbarung |
| Die skalierbare Einheit | **ein Konto = ein Schlüssel** → `--count N` ist N Testbudgets |
| Wie Sie Ihre Limits sehen | [dashboard.cohere.com](https://dashboard.cohere.com) — die aktuelle Quelle der Plan‑Limits |

> 💡 Die Gratis‑Stufe wird von Cohere festgelegt und kann sich ändern. Prüfen Sie die aktuellen Zahlen auf [cohere.com](https://cohere.com) — und lassen Sie das Tool selbst entscheiden:

```bash
node src/cli.js verify --keys=keys.txt     # jeder Schlüssel in keys.txt wird mit einem echten Chat‑Aufruf erneut getestet
```

## 🤖 Modelle — alle 35 davon

Ein verifizierter Schlüssel sieht den **gesamten Kontokatalog — 35 Modelle** über `GET /v1/models`, geschrieben nach `src/models.json` vom ersten Schlüssel, der die Verifizierung besteht:

Der Live‑Chat‑Probe (2026‑10‑19, 2 Schlüssel) beantwortete `200` für diese 17 IDs; die restlichen Katalogeinträge sind Embedding‑/Rerank‑/Transcribe‑IDs, die der Kompatibilitäts‑Endpoint nicht bereitstellt:

|Modell|✓|
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

Live‑Probe eines Schlüssels:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 Wie man die API benutzt

Der Cohere‑API‑Schlüssel (`Bearer <key>`) erreicht den Kompatibilitäts‑Endpoint `https://api.cohere.com/compatibility/v1` — OpenAI‑kompatibel — und den nativen Chat‑Endpoint `https://api.cohere.com/v1/chat`. Derselbe Schlüssel beantwortet beide; 9Router zeigt auf die Kompatibilitäts‑URL.

**Beliebiges SDK / curl (Kompatibilität):**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**Native Chat (wie der Verifizierer ihn nutzt):**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 Schnellstart

```bash
git clone https://github.com/F0Rextasy/cohere-bulk-apikey.git
cd cohere-bulk-apikey

# 1) Ihre Proxy‑Liste, ein Exit pro Zeile (http://, socks5://, socks4:// oder bloßer host:port)
printf 'http://127.0.0.1:8080\n' > proxies.txt

# 2) Mailboxes — ein lokaler Broker, der über einfaches HTTP Wegwerf‑Inboxen ausgibt
#    (ein Mailtrap‑gestützter Broker auf :9700 lieferte das mitgelieferte Batch; ein inboxes.com‑Broker
#     auf :9701 ist der eingebaute Fallback)

# 3) los
node src/launcher.js                    # interaktives Menü: mint / finish / verify / settings
node src/cli.js mint --count=30         # frische Konten erstellen und je einen Schlüssel prägen
node src/cli.js verify --keys=keys.txt  # die bereits auf der Festplatte vorhandenen Schlüssel erneut prüfen

# Die Registrierungsphase steuert ein echtes Chrome über CDP — Google Chrome muss installiert sein
```

Was während der Ausführung auf die Festplatte geschrieben wird:

| Pfad | Inhalt |
| --- | --- |
| `src/` | das Tool — ausführen als `node src/<file>.js` vom Repository‑Root (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | die Schlüssel, **ein Schlüssel pro Zeile**, angehängt, sobald ein Schlüssel den Live‑Check besteht |
| `accounts.json` | ein Datensatz pro Konto: Mailbox, Passwort, Schlüssel, der Exit, der ihn erstellt hat |
| `out/` | Verzeichnisse pro Versuch (Screenshots + DOM/Netzwerk‑Dumps), das Batch‑Log, Exit‑Buchführung |
| `src/models.json` | geschrieben von `verify` — die Live‑Antwort von `GET /v1/models` des ersten Schlüssels, der verifiziert |

### 🖱️ Der Launcher

Der Launcher ist `src/launcher.js`: ein Menü über mint / finish / verify / settings (+ 9Router). Er merkt sich `count`/`conc` in `launcher.config.json` und zeigt an, wie viele Exits `proxies.txt` enthält und wie viele Schlüssel bereits auf der Festplatte liegen, im Header. `node src/launcher.js --connect-9router` registriert die Schlüssel bei einem lokalen 9Router.

## ✅ Verifiziert funktionsfähig — jeder Schlüssel wird getestet

Ein Schlüssel wird erst in `keys.txt` geschrieben, nachdem die Live‑API ihn bestätigt hat:

| Prüfung | Aufruf | Erwartet |
| --- | --- | --- |
| auth + Modell‑Liste | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| echte Generierung | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` mit Text |

Messungen des mitgelieferten Batches (aus den Lauf‑Logs):

| Messung | Ergebnis |
| --- | --- |
| Gesamte Kette | **15 Konten → 15 Schlüssel** am 2026‑10‑14, 19:16–20:07 — register → mail → confirm → onboarding → key |
| Verifizierung | **verified working** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Nachweis‑Richtlinie | ein Schlüssel, dessen Live‑Check nicht sauber antwortet, wird **nicht** geschrieben — das Tool bevorzugt einen fehlenden Schlüssel gegenüber einem unbewiesenen |
| Bestätigungs‑Route | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — der erste Aufruf verbraucht das Token |
| Onboarding‑Gate | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, Schlüssel‑Aufruf `200`; ohne das `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduziert beide Prüfungen für Ihre eigene Datei
```

## 🧭 Wie es funktioniert

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

Pro Konto gibt es zwei Phasen, eine frische Mailbox und ein frischer Exit:

1. **Browser‑Phase** — ein isolierter Chrome‑Context, an einen Exit gebunden. Die Registrierungsseite lädt, die eigene reCAPTCHA‑Enterprise‑Challenge wird gelöst, und das `RegisterWithEmail`‑POST im Page‑Kontext folgt. Die Captcha‑Assets werden einmal auf die Festplatte gecacht und von dort an jeden Context ausgeliefert, sodass ein kurzlebiger Exit nur die kleine Formularseite und das POST transportieren muss. Stirbt der Seiten‑Transport mittendrin, wird das Registrierungs‑POST von Node über einen rotierten Exit erneut versucht.
2. **Post‑Phase** — reines HTTP, Exit‑Rotation, kein Browser. Inbox lesen → SendGrid‑Wrapper aus dem `Location`‑Header auflösen (mit einem GET ohne Follow) → Bestätigungs‑Link‑Route konsumieren → `AuthV2`‑Bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → Live‑Verifizierung → an `keys.txt` und `accounts.json` anhängen.

## ⚙️ CLI‑Optionen

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| Aufgabe | Optionen |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (all `=` form, `--cross` = cross‑check the box) |
| `verify` | `--keys=<file>` (default `keys.txt`) · `--limit=N` (0 = all) |

Turbo wird empfohlen (5); mehr auf einem schwachen Computer birgt Risiko von Belastung/Blockierung.

Der Dispatcher‑`help`‑Task listet die Aufgaben auf; Optionen werden als `--name=value` gelesen. `node src/launcher.js` bietet mint · finish · verify · settings — der Header zeigt, wie viele Exits `proxies.txt` enthält und wie viele Schlüssel bereits auf der Festplatte liegen, und Einstellungen werden in `launcher.config.json` gespeichert.

| Umgebungsvariable | Standard | Bedeutung |
| --- | --- | --- |
| `COHERE_MAILBOX` | loopback broker | Inbox‑Backend (`emailnator` wenn gesetzt) |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap inbox | Mailtrap‑Ordner für Aufzeichnungen |

## 🛰️ Hinter einem Proxy

* `proxies.txt` — ein Exit pro Zeile, `scheme://host:port` mit `http` / `socks4` / `socks5`; `user:pass@`‑Anmeldedaten werden unterstützt, `#` leitet einen Kommentar ein, und ein bloßer `host:port` wird zu `http://` ergänzt. Leere Zeilen werden übersprungen.
* **Point‑of‑use‑Preflight:** ein Exit wird nur verwendet, nachdem er gerade einen echten Egress‑Check durchgeführt hat; private/CGNAT‑Antworten werden sofort abgelehnt. Ziel‑Traffic verlässt das Netzwerk ausschließlich über einen Pool‑Exit.
* **Exit‑Rotations‑Phase:** Die Post‑Phase versucht es über den gesamten Pool erneut (die Bestätigungs‑Route erhält 12 Versuche), und `verify` rotiert Exits bei `403`, während ein Schlüssel nur bei `401` fehlschlägt.
* **Keine Regel „ein Konto‑pro‑Exit“:** Ein Exit kann viele Konten tragen — im ausgelieferten Batch trugen 5 Exits 15 Schlüssel, einer davon 9.

## 📄 Dateien

| Pfad | Inhalt |
| --- | --- |
| `keys.txt` | die Schlüssel, **ein Schlüssel pro Zeile**, angehängt, sobald ein Schlüssel den Live‑Check besteht |
| `accounts.json` | ein Datensatz pro Konto: Mailbox, Passwort, Schlüssel, der Exit, der ihn erstellt hat |
| `out/` | Verzeichnisse pro Versuch (Screenshots + DOM/Netzwerk‑Dumps), das Batch‑Log, Exit‑Buchführung |
| `src/models.json` | geschrieben von `verify` — die Live‑Antwort von `GET /v1/models` des ersten Schlüssels, der verifiziert |

## 🔌 Mit 9Router verbinden

[9Router](https://9router.com) ist ein selbstgehosteter, OpenAI‑kompatibler Router. Cohere ist OpenAI‑kompatibel (Kompatibilitäts‑Endpoint `https://api.cohere.ai/compatibility/v1`), also registrieren Sie ihn einmal und nutzen jeden Schlüssel:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Jeder Schlüssel in `keys.txt` wird zu einer Verbindung des `cohere`‑Provider‑Nodes (`--api-key <key>` registriert stattdessen einen einzelnen Schlüssel, `--model <id>` überschreibt den Standard). Dann wählen Sie ein Modell in 9Router aus:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Richten Sie den Connector auf ein aktualisiertes `keys.txt`, um weitere Konten hinzuzufügen; der Node und seine Modell‑Liste bleiben gleich. `node src/launcher.js --connect-9router` führt genau dies aus und fragt zuerst nach der Basis‑URL und dem Passwort.

Standardwerte: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 Was ein Schlüssel Ihnen gibt

|  |  |
| --- | --- |
| 🏢 Anbieter | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 Was der Anbieter liefert | 1 Testschlüssel pro Konto (1.000 Aufrufe/Monat, als die Kampagne lief) — echtes Chrome + SendGrid‑Bestätigungsgate |
| 🔑 Was ein Schlüssel Ihnen gibt | ein API‑Schlüssel, der nur zu seinem eigenen Konto gehört: die 35 Modell‑IDs am untenstehenden Endpoint, zu den Limits Ihres Plans. Das Kontingent liegt beim **Konto**, weshalb dieses Tool ein Konto pro Schlüssel erstellt |
| 🌐 API‑Form | OpenAI‑kompatibel: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Ihre Daten | Nur cohere.com und das von Ihnen konfigurierte Inbox‑Backend werden kontaktiert; Schlüssel bleiben auf Ihrer Maschine |

## 🐞 Probleme

Cohere hat das RPC, die Bestätigungs‑Route oder die Registrierungs‑Richtlinie geändert? Das Tool stoppt beim fehlschlagenden Schritt und meldet dies. **[Ein Issue öffnen](../../issues)** mit dem Befehl, den Sie ausgeführt haben, und der genauen Ausgabe — die Dumps pro Versuch unter `out/` (Screenshots, DOM‑ und Netzwerk‑Aufzeichnungen) machen Fehler reproduzierbar, ohne einen Schlüssel zu leaken. PRs sind willkommen.

## 📄 Lizenz

MIT © 2026 — siehe [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>