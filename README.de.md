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

**Cohere-Konten in großen Mengen erstellen mit automatisch generierten API-Schlüsseln — OpenAI-kompatible Inferenz + 9Router-Connector.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Schnellstart](#-quick-start) · [🎁 Kostenlose Stufe](#-free-tier--how-much-you-get) · [🤖 Modelle](#-models--all-35-of-them) · [🧪 Die API verwenden](#-how-to-use-the-api) · [✅ Verifiziert](#-verified-working--every-key-is-tested) · [🧭 So funktioniert es](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Optionen](#️-cli-options) · [🛰️ Proxys](#️-behind-a-proxy) · [🐞 Probleme](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>


---

## ✨ Warum es das gibt

Die kostenlose Stufe von Cohere hängt am **Konto**: Die Konsole erzeugt einen `TRIAL`-API-Schlüssel pro Konto (dokumentiert als **1.000 Aufrufe/Monat pro Konto**, solange die Trial-Kampagne lief), und ein Produktionsschlüssel ist ein separater, vertraglich geregelter Prozess. Die nützliche Einheit ist also *ein Konto pro Schlüssel*, niemals viele Schlüssel aus einem Konto.

Die Anmeldung ist klein — ein E-Mail-Feld, ein Passwort —, aber die Seite erzeugt nur dann ein funktionierendes Konto, wenn sie in einem echten Browser läuft, wobei alles nach der Bestätigungsmail reines HTTP ist:

```
proxies.txt ─▶ Exit-Preflight (Egress-Prüfung; CGNAT/eigene IP abgelehnt)
                    │
                    ▼
  frisches Postfach ──▶ Chrome-Kontext an einen Exit gebunden
                    ├─ Registrierungsseite (das kleine SSR-Formular)
                    └─ RegisterWithEmail  → 200
                                  │
   Mail (SendGrid-Klick-Tracking) ─▶ Location ─▶ /confirm-email?token=…
                                  │                └─ 307 ─▶ /api/auth/confirm_email  (erster Zugriff verbraucht ihn)
                                  ▼
            AuthV2 Bearer ─▶ AgreeToOnboarding(PROFILE_SETUP) ─▶ GetOrCreateDefaultAPIKey
                                  │
        GET /v1/models 200 + POST /v1/chat 200  ◀── Live-Verifizierung ──┘
                                  ▼
                               keys.txt
```

## 🎁 Kostenlose Stufe — wie viel du bekommst

Die kostenlose Stufe von Cohere ist der **Trial-Schlüssel am Konto** — **1.000 API-Aufrufe pro Monat pro Konto** (das für die Kampagne dokumentierte Kontingent; die Konsole unter [dashboard.cohere.com](https://dashboard.cohere.com) zeigt stets deinen aktuellen Tarif und deine Limits, die Cohere ändern kann). Ein Produktionsschlüssel ist vertraglich geregelt.

| Was | Wert |
| --- | --- |
| Willkommens-Kontingent | ein `TRIAL`-Schlüssel pro Konto — 1.000 Aufrufe/Monat (Kampagne) |
| Karte erforderlich | **Nein** |
| Anmeldung | E-Mail + Passwort in einem echten Browser; E-Mail-Bestätigung per Link; Onboarding-Vereinbarung |
| Die skalierende Einheit | **ein Konto = ein Schlüssel** → `--count N` sind N Trial-Budgets |
| So siehst du deine Limits | [dashboard.cohere.com](https://dashboard.cohere.com) — die Live-Quelle für Tariflimits |

> 💡 Die kostenlose Stufe wird von Cohere festgelegt und kann sich ändern. Prüfe die aktuellen Zahlen unter [cohere.com](https://cohere.com) — und lass das Gate des Tools selbst entscheiden:

```bash
node src/cli.js verify --keys=keys.txt     # jeder Schlüssel in keys.txt wird mit einem echten Chat-Aufruf erneut getestet
```

## 🤖 Modelle — alle 35 davon

Ein verifizierter Schlüssel sieht den **gesamten Kontokatalog — 35 Modelle** auf `GET /v1/models`, geschrieben nach [`src/models.json`](src/models.json) durch den ersten Schlüssel, der die Verifizierung besteht:

|Model|✓|
|---|---|
|`command-a-03-2025`|✓|

Live-Abfrage eines Schlüssels:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 Die API verwenden

Der Cohere-API-Schlüssel (`Bearer <key>`) erreicht den Kompatibilitäts-Endpunkt `https://api.cohere.com/compatibility/v1` — OpenAI-kompatibel — und den nativen Chat-Endpunkt `https://api.cohere.com/v1/chat`. Derselbe Schlüssel bedient beide; 9Router wird auf die Kompatibilitäts-URL gerichtet.

**Beliebiges SDK / curl (Kompatibilität):**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**Nativer Chat (was der Verifizierer verwendet):**

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

Was während der Ausführung auf der Festplatte landet:

| Pfad | Inhalt |
| --- | --- |
| `src/` | das Tool — führe es als `node src/<file>.js` aus dem Repository-Stammverzeichnis aus (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | die Schlüssel, **einer pro Zeile**, angehängt in dem Moment, in dem ein Schlüssel die Live-Prüfung besteht |
| `accounts.json` | ein Datensatz pro Konto: Postfach, Passwort, Schlüssel, der Exit, der ihn erzeugt hat |
| `out/` | Laufverzeichnisse pro Versuch (Screenshots + DOM-/Netzwerk-Dumps), das Batch-Log, Exit-Buchhaltung |
| `src/models.json` | von `verify` geschrieben — die Live-`GET /v1/models`-Antwort des ersten Schlüssels, der verifiziert |

### 🖱️ Der Launcher

Der Launcher ist `src/launcher.js`: ein Menü über mint / finish / verify / settings (+ 9Router). Er merkt sich `count`/`conc` in `launcher.config.json` und zeigt im Header an, wie viele Exits `proxies.txt` enthält und wie viele Schlüssel auf der Festplatte liegen. `node src/launcher.js --connect-9router` registriert die Schlüssel bei einem lokalen 9Router.

## ✅ Verifiziert funktionierend — jeder Schlüssel wird getestet

Ein Schlüssel wird nur dann nach `keys.txt` geschrieben, wenn die Live-API damit antwortet:

| Prüfung | Aufruf | erwartet |
| --- | --- | --- |
| Auth + Modellliste | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| echte Generierung | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` mit Text |

Der Batch, aus dem dieses Repository hervorging, gemessen an den Lauf-Logs:

| Messung | Ergebnis |
| --- | --- |
| Gesamte Kette | **15 Konten → 15 Schlüssel** am 2026-10-14, 19:16–20:07 — Registrierung → Mail → Bestätigung → Onboarding → Schlüssel |
| Verifizierung | **15/15 live** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Proof-Richtlinie | ein Schlüssel, dessen Live-Prüfung nicht sauber antwortet, wird **nicht** geschrieben — das Tool bevorzugt einen fehlenden Schlüssel gegenüber einem unbewiesenen |
| Bestätigungsroute | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — der erste Zugriff verbraucht den Token |
| Onboarding-Gate | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, Schlüsselaufruf `200`; ohne es `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduziert beide Prüfungen für deine eigene Datei
```

## 🧭 So funktioniert es

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

Pro Konto zwei Phasen, ein frisches Postfach und ein frischer Exit:

1. **Browser-Phase** — ein isolierter Chrome-Kontext, an einen Exit gebunden. Die Registrierungsseite lädt, die eigene reCAPTCHA-Enterprise-Herausforderung der Seite wird gelöst, und der In-Page-`RegisterWithEmail`-POST folgt. Die Captcha-Assets werden einmal auf der Festplatte zwischengespeichert und von dort an jeden Kontext ausgeliefert, sodass ein kurzlebiger Exit nur die kleine Formularseite und den POST tragen muss. Wenn der Seitentransport mitten im Vorgang abbricht, wird der Registrierungs-POST von Node aus über einen rotierten Exit erneut versucht.
2. **Post-Phase** — reines HTTP, Exit-Rotation, kein Browser. Postfach lesen → den SendGrid-Wrapper aus dem `Location`-Header auflösen (mit einem No-Follow-GET) → die Bestätigungslink-Route verbrauchen → `AuthV2`-Bearer → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → Live-Verifizierung → an `keys.txt` und `accounts.json` anhängen.

## ⚙️ CLI-Optionen

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| Task | Flags |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (alle in `=`-Form, `--cross` = das Postfach gegengeprüfen) |
| `verify` | `--keys=<file>` (Standard `keys.txt`) · `--limit=N` (0 = alle) |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

Die `help`-Task des Dispatchers listet die Tasks auf; Flags werden als `--name=value` gelesen. `node src/launcher.js` bietet mint · finish · verify · settings — der Header zeigt an, wie viele Exits `proxies.txt` enthält und wie viele Schlüssel auf der Festplatte liegen, und Einstellungen werden in `launcher.config.json` gespeichert.

| Umgebungsvariable | Standard | Bedeutung |
| --- | --- | --- |
| `COHERE_MAILBOX` | Loopback-Broker | Inbox-Backend (`emailnator`, wenn gesetzt) |
| `COHERE_MAILTRAP_FOLDER` | Mailtrap-Inbox | Mailtrap-Ordner für Captures |

## 🛰️ Hinter einem Proxy

* `proxies.txt` — ein Exit pro Zeile, `scheme://host:port` mit `http` / `socks4` / `socks5`; `user:pass@`-Anmeldedaten werden unterstützt, `#` beginnt einen Kommentar, und ein bloßes `host:port` verwendet standardmäßig `http://`. Leerzeilen werden übersprungen.
* **Preflight am Einsatzort:** Ein Exit wird erst verwendet, nachdem er gerade eine echte Egress-Prüfung getragen hat; private/CGNAT-Antworten werden rundheraus abgelehnt. Zielverkehr verlässt das System ausschließlich über einen Pool-Exit.
* **Exit-rotierende Phase:** Die Post-Phase versucht es über den gesamten Pool hinweg erneut (die Bestätigungsroute erhält 12 Versuche), und `verify` rotiert Exits bei `403`, während ein Schlüssel nur bei `401` fehlschlägt.
* **Keine Regel „ein Konto pro Exit“:** Ein Exit darf viele Konten tragen — im ausgelieferten Batch trugen 5 Exits 15 Schlüssel, und einer von ihnen trug 9.

## 📄 Dateien

| Pfad | Inhalt |
| --- | --- |
| `keys.txt` | die Schlüssel, **einer pro Zeile**, angehängt in dem Moment, in dem ein Schlüssel die Live-Prüfung besteht |
| `accounts.json` | ein Datensatz pro Konto: Postfach, Passwort, Schlüssel, der Exit, der ihn erzeugt hat |
| `out/` | Laufverzeichnisse pro Versuch (Screenshots + DOM-/Netzwerk-Dumps), das Batch-Log, Exit-Buchhaltung |
| `src/models.json` | von `verify` geschrieben — die Live-`GET /v1/models`-Antwort des ersten Schlüssels, der verifiziert |

## 🔌 Mit 9Router verbinden

[9Router](https://9router.com) ist ein selbst gehosteter, OpenAI-kompatibler Router. Cohere ist OpenAI-kompatibel (Kompatibilitäts-Endpunkt `https://api.cohere.ai/compatibility/v1`), also registriere es einmal und nutze jeden Schlüssel:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Jeder Schlüssel in `keys.txt` wird zu einer Verbindung des `cohere`-Provider-Knotens (`--api-key <key>` registriert stattdessen einen einzelnen Schlüssel, `--model <id>` überschreibt den Standard). Wähle dann ein Modell innerhalb von 9Router:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Richte den Connector auf eine aktualisierte `keys.txt`, um weitere Konten hinzuzufügen; der Knoten und seine Modellliste bleiben gleich. `node src/launcher.js --connect-9router` führt genau dies aus und fragt zuerst nach Basis-URL und Passwort.

Standardwerte: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 Was ein Schlüssel dir bringt

| | |
| --- | --- |
| 🏢 Anbieter | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 Was der Anbieter gibt | 1 Trial-Schlüssel pro Konto (1.000 Aufrufe/Monat, als die Kampagne lief) — echtes Chrome + SendGrid-Bestätigungs-Gate |
| 🔑 Was ein Schlüssel dir bringt | einen API-Schlüssel, der auf sein eigenes Konto beschränkt ist: die 35 Modell-IDs am unten stehenden Endpunkt, zu den Limits deines Tarifs. Das Kontingent liegt am **Konto**, weshalb dieses Tool genau ein Konto pro Schlüssel erstellt |
| 🌐 API-Form | OpenAI-kompatibel: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Deine Daten | nur cohere.com und das von dir konfigurierte Inbox-Backend werden kontaktiert; Schlüssel bleiben auf deinem Rechner |

## 🐞 Probleme

Cohere hat das RPC, die Bestätigungsroute oder die Anmeldungsrichtlinie geändert? Das Tool stoppt beim fehlschlagenden Schritt und sagt es dir. **[Öffne ein Issue](../../issues)** mit dem ausgeführten Befehl und der exakten Ausgabe — die Dumps pro Versuch unter `out/` (Screenshots, DOM- und Netzwerkaufzeichnungen) machen Fehler reproduzierbar, ohne einen Schlüssel preiszugeben. PRs sind willkommen.

## 📄 Lizenz

MIT © 2026 — siehe [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>