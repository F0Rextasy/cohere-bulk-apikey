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

**Créez en masse des comptes Cohere avec des clés API générées automatiquement — inférence compatible OpenAI + connecteur 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Démarrage rapide](#-quick-start) · [🎁 Offre gratuite](#-free-tier--how-much-you-get) · [🤖 Modèles](#-models--all-35-of-them) · [🧪 Utiliser l'API](#-how-to-use-the-api) · [✅ Vérifié](#-verified-working--every-key-is-tested) · [🧭 Comment ça marche](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problèmes](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>


---

## ✨ Pourquoi ce projet existe

L'offre gratuite de Cohere repose sur le **compte** : la console génère une clé API `TRIAL` par compte (enregistrée comme **1 000 appels/mois par compte** pendant la campagne d'essai), et une clé de production est un processus distinct, soumis à contrat. L'unité utile est donc *un compte par clé*, jamais plusieurs clés issues d'un seul compte.

L'inscription est simple — un champ e-mail, un mot de passe — mais la page ne produit un compte fonctionnel que lorsqu'elle s'exécute dans un vrai navigateur, tout ce qui suit l'e-mail de confirmation étant du HTTP simple :

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

## 🎁 Offre gratuite — ce que vous obtenez

L'offre gratuite de Cohere correspond à la **clé d'essai sur le compte** — **1 000 appels API par mois et par compte** (le quota enregistré pour la campagne ; la console sur [dashboard.cohere.com](https://dashboard.cohere.com) affiche toujours votre forfait et vos limites actuels, que Cohere peut modifier). Une clé de production est soumise à contrat.

| Élément | Valeur |
| --- | --- |
| Allocation de bienvenue | une clé `TRIAL` par compte — 1 000 appels/mois (campagne) |
| Carte requise | **Non** |
| Inscription | e-mail + mot de passe dans un vrai navigateur ; confirmation par e-mail via un lien ; acceptation de l'onboarding |
| L'unité qui évolue | **un compte = une clé** → `--count N` correspond à N budgets d'essai |
| Comment voir vos limites | [dashboard.cohere.com](https://dashboard.cohere.com) — la source en direct des limites de forfait |

> 💡 L'offre gratuite est définie par Cohere et peut changer. Consultez les chiffres en direct sur [cohere.com](https://cohere.com) — et laissez le contrôle de l'outil décider :

```bash
node src/cli.js verify --keys=keys.txt     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modèles — les 35 au complet

Une clé vérifiée voit **tout le catalogue du compte — 35 modèles** sur `GET /v1/models`, écrit dans [`src/models.json`](src/models.json) par la première clé qui passe la vérification :

|Modèle|✓|
|---|---|
|`command-a-03-2025`|✓|

Test en direct d'une clé :

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 Comment utiliser l'API

La clé API Cohere (`Bearer <key>`) atteint le point de terminaison de compatibilité `https://api.cohere.com/compatibility/v1` — compatible OpenAI — ainsi que le point de terminaison de chat natif `https://api.cohere.com/v1/chat`. La même clé répond aux deux ; 9Router est pointé vers l'URL de compatibilité.

**N'importe quel SDK / curl (compatibilité) :**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**Chat natif (ce que le vérificateur utilise) :**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 Démarrage rapide

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

Ce qui est écrit sur le disque pendant l'exécution :

| Chemin | Contenu |
| --- | --- |
| `src/` | l'outil — exécutez-le avec `node src/<file>.js` depuis la racine du dépôt (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | les clés, **une par ligne**, ajoutées dès qu'une clé passe la vérification en direct |
| `accounts.json` | un enregistrement par compte : boîte mail, mot de passe, clé, la sortie qui l'a généré |
| `out/` | répertoires d'exécution par tentative (captures d'écran + dumps DOM/réseau), le journal du lot, la comptabilité des sorties |
| `src/models.json` | écrit par `verify` — la réponse en direct de `GET /v1/models` de la première clé qui se vérifie |

### 🖱️ Le lanceur

Le lanceur est `src/launcher.js` : un menu pour mint / finish / verify / settings (+ 9Router). Il mémorise `count`/`conc` dans `launcher.config.json` et affiche dans l'en-tête combien de sorties contient `proxies.txt` et combien de clés sont sur le disque. `node src/launcher.js --connect-9router` enregistre les clés auprès d'un 9Router local.

## ✅ Vérifié fonctionnel — chaque clé est testée

Une clé n'est écrite dans `keys.txt` qu'après que l'API en direct a répondu avec elle :

| vérification | appel | attendu |
| --- | --- | --- |
| auth + liste des modèles | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| génération réelle | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` avec du texte |

Le lot dont ce dépôt est issu, mesuré à partir des journaux d'exécution :

| Mesure | Résultat |
| --- | --- |
| Chaîne complète | **15 comptes → 15 clés** le 2026-10-14, 19:16–20:07 — inscription → mail → confirmation → onboarding → clé |
| Vérification | **15/15 en direct** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Politique de preuve | une clé dont la vérification en direct ne répond pas proprement n'est **pas** écrite — l'outil préfère une clé manquante à une clé non prouvée |
| Route de confirmation | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — le premier accès consomme le jeton |
| Barrière d'onboarding | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, appel de clé `200` ; sans cela `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

## 🧭 Comment ça marche

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

Par compte, deux phases, une boîte mail neuve et une sortie neuve :

1. **Phase navigateur** — un contexte Chrome isolé, épinglé à une sortie. La page d'inscription se charge, le défi reCAPTCHA Enterprise de la page se résout, et le POST `RegisterWithEmail` intégré à la page suit. Les ressources du captcha sont mises en cache sur le disque une fois et servies à chaque contexte depuis là, de sorte qu'une sortie éphémère n'a qu'à transporter la petite page de formulaire et le POST. Si le transport de la page meurt en cours de route, le POST d'inscription est réessayé depuis Node via une sortie permutée.
2. **Phase post** — HTTP simple, avec rotation des sorties, sans navigateur. Lire la boîte mail → résoudre l'enveloppe SendGrid depuis l'en-tête `Location` (avec un GET sans suivi) → consommer la route du lien de confirmation → jeton `AuthV2` → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → vérification en direct → ajout à `keys.txt` et `accounts.json`.

## ⚙️ Options CLI

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| Tâche | Options |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (tous sous la forme `=`, `--cross` = vérification croisée de la boîte) |
| `verify` | `--keys=<file>` (par défaut `keys.txt`) · `--limit=N` (0 = tout) |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

La tâche `help` du répartiteur liste les tâches ; les options sont lues sous la forme `--name=value`. `node src/launcher.js` propose mint · finish · verify · settings — l'en-tête affiche combien de sorties contient `proxies.txt` et combien de clés sont sur le disque, et les paramètres sont conservés dans `launcher.config.json`.

| Variable d'environnement | Valeur par défaut | Signification |
| --- | --- | --- |
| `COHERE_MAILBOX` | broker loopback | backend de boîte mail (`emailnator` lorsqu'elle est définie) |
| `COHERE_MAILTRAP_FOLDER` | boîte Mailtrap | dossier Mailtrap pour les captures |

## 🛰️ Derrière un proxy

* `proxies.txt` — une sortie par ligne, `scheme://host:port` avec `http` / `socks4` / `socks5` ; les identifiants `user:pass@` sont pris en charge, `#` démarre un commentaire, et un simple `host:port` est par défaut en `http://`. Les lignes vides sont ignorées.
* **Préflight au point d'utilisation :** une sortie n'est utilisée qu'après avoir porté un vrai contrôle d'egress ; les réponses privées/CGNAT sont rejetées d'emblée. Le trafic cible ne sort jamais autrement que par une sortie du pool.
* **Phase à rotation de sorties :** la phase post réessaie sur tout le pool (la route de confirmation a droit à 12 tentatives), et `verify` fait tourner les sorties sur `403` tout en ne faisant échouer une clé que sur `401`.
* **Aucune règle de compte par sortie :** une sortie peut porter de nombreux comptes — dans le lot livré, 5 sorties portaient 15 clés et l'une d'elles en portait 9.

## 📄 Fichiers

| Chemin | Contenu |
| --- | --- |
| `keys.txt` | les clés, **une par ligne**, ajoutées dès qu'une clé passe la vérification en direct |
| `accounts.json` | un enregistrement par compte : boîte mail, mot de passe, clé, la sortie qui l'a généré |
| `out/` | répertoires d'exécution par tentative (captures d'écran + dumps DOM/réseau), le journal du lot, la comptabilité des sorties |
| `src/models.json` | écrit par `verify` — la réponse en direct de `GET /v1/models` de la première clé qui se vérifie |

## 🔌 Connexion à 9Router

[9Router](https://9router.com) est un routeur auto-hébergé, compatible OpenAI. Cohere est compatible OpenAI (point de terminaison de compatibilité `https://api.cohere.ai/compatibility/v1`), alors enregistrez-le une fois et utilisez chaque clé :

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Chaque clé de `keys.txt` devient une connexion du nœud fournisseur `cohere` (`--api-key <key>` enregistre une seule clé à la place, `--model <id>` remplace la valeur par défaut). Choisissez ensuite un modèle dans 9Router :

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Pointez le connecteur vers un `keys.txt` actualisé pour ajouter d'autres comptes ; le nœud et sa liste de modèles restent identiques. `node src/launcher.js --connect-9router` exécute exactement cela et demande d'abord l'URL de base et le mot de passe.

Valeurs par défaut : `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 Ce qu'une clé vous apporte

| | |
| --- | --- |
| 🏢 Fournisseur | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 Ce que le fournisseur offre | 1 clé d'essai par compte (1 000 appels/mois lorsque la campagne était active) — vrai Chrome + barrière de confirmation SendGrid |
| 🔑 Ce qu'une clé vous apporte | une clé API limitée à son propre compte : les 35 identifiants de modèles sur le point de terminaison ci-dessous, aux limites de votre forfait. Le quota vit sur le **compte**, ce qui explique précisément pourquoi cet outil crée un compte par clé |
| 🌐 Forme de l'API | Compatible OpenAI : `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Vos données | seuls cohere.com et le backend de boîte mail que vous configurez sont contactés ; les clés restent sur votre machine |

## 🐞 Problèmes

Cohere a changé le RPC, la route de confirmation ou la politique d'inscription ? L'outil s'arrête à l'étape défaillante et le signale. **[Ouvrez un ticket](../../issues)** avec la commande que vous avez exécutée et la sortie exacte — les dumps par tentative sous `out/` (captures d'écran, enregistrements DOM et réseau) rendent les échecs reproductibles sans divulguer de clé. Les PR sont bienvenues.

## 📄 Licence

MIT © 2026 — voir [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>