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

**Crie contas Cohere em massa com chaves de API geradas automaticamente — inferência compatível com OpenAI + conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-35%20served-412991?style=for-the-badge)](https://dashboard.cohere.com)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Início rápido](#-quick-start) · [🎁 Camada gratuita](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-35-of-them) · [🧪 Use a API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Como funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Opções](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Por que isto existe

A camada gratuita da Cohere vive na **conta**: o console emite uma chave de API `TRIAL` por conta (registrada como **1.000 chamadas/mês por conta** enquanto a campanha de teste estava em vigor), e uma chave de produção é um processo separado, condicionado a contrato. Portanto, a unidade útil é *uma conta por chave*, nunca muitas chaves de uma conta.

O cadastro é pequeno — um campo de e-mail, uma senha — mas a página só produz uma conta funcional quando roda em um navegador real, com tudo após o e-mail de confirmação em HTTP puro:

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

## 🎁 Camada gratuita — quanto você recebe

A camada gratuita da Cohere é a **chave de teste na conta** — **1.000 chamadas de API por mês por conta** (a cota registrada para a campanha; o console em [dashboard.cohere.com](https://dashboard.cohere.com) sempre mostra seu plano e limites atuais, que a Cohere pode alterar). Uma chave de produção é condicionada a contrato.

| O quê | Valor |
| --- | --- |
| Concessão de boas-vindas | uma chave `TRIAL` por conta — 1.000 chamadas/mês (campanha) |
| Cartão exigido | **Não** |
| Cadastro | e-mail + senha em um navegador real; confirmação de e-mail por link; aceite do onboarding |
| A unidade que escala | **uma conta = uma chave** → `--count N` são N orçamentos de teste |
| Como ver seus limites | [dashboard.cohere.com](https://dashboard.cohere.com) — a fonte ao vivo dos limites do plano |

> 💡 A camada gratuita é definida pela Cohere e pode mudar. Confira os números ao vivo em [cohere.com](https://cohere.com) — e deixe o próprio gate da ferramenta decidir:

```bash
node src/cli.js verify --keys=keys.txt     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modelos — todos os 35

Uma chave verificada enxerga o **catálogo completo da conta — 35 modelos** em `GET /v1/models`, gravado em [`src/models.json`](src/models.json) pela primeira chave que passa na verificação:

A sondagem de chat ao vivo (2026-10-19, 2 chaves) respondeu `200` nestes 17 ids; as entradas restantes do catálogo são ids de embedding / rerank / transcribe que o endpoint de compatibilidade não serve:

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

Sondagem ao vivo de uma chave:

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"Reply with the single word: ok","max_tokens":8}'
```

## 🧪 Como usar a API

A chave de API da Cohere (`Bearer <key>`) alcança o endpoint de compatibilidade `https://api.cohere.com/compatibility/v1` — compatível com OpenAI — e o endpoint de chat nativo `https://api.cohere.com/v1/chat`. A mesma chave responde a ambos; o 9Router é apontado para a URL de compatibilidade.

**Qualquer SDK / curl (compatibilidade):**

```bash
curl https://api.cohere.ai/compatibility/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","messages":[{"role":"user","content":"hi"}]}'
```

**Chat nativo (o que o verificador usa):**

```bash
curl https://api.cohere.com/v1/chat \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"command-a-03-2025","message":"hi","max_tokens":8}'
```

## 🛠 Início rápido

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

O que fica no disco enquanto ele roda:

| Caminho | Conteúdo |
| --- | --- |
| `src/` | a ferramenta — execute como `node src/<file>.js` a partir da raiz do repositório (`src/launcher.js`, `src/cli.js`) |
| `keys.txt` | as chaves, **uma por linha**, anexadas no momento em que uma chave passa na verificação ao vivo |
| `accounts.json` | um registro por conta: caixa de correio, senha, chave, a saída que a emitiu |
| `out/` | diretórios de execução por tentativa (capturas de tela + dumps de DOM/rede), o log do lote, contabilidade de saídas |
| `src/models.json` | gravado por `verify` — a resposta ao vivo de `GET /v1/models` da primeira chave que verifica |

### 🖱️ O launcher

O launcher é `src/launcher.js`: um menu sobre mint / finish / verify / settings (+ 9Router). Ele lembra `count`/`conc` em `launcher.config.json` e mostra no cabeçalho quantas saídas `proxies.txt` contém e quantas chaves estão no disco. `node src/launcher.js --connect-9router` registra as chaves em um 9Router local.

## ✅ Verificado e funcionando — toda chave é testada

Uma chave só é gravada em `keys.txt` depois que a API ao vivo responde com ela:

| verificação | chamada | esperado |
| --- | --- | --- |
| auth + lista de modelos | `GET https://api.cohere.com/v1/models?page_size=100` | `200` |
| geração real | `POST https://api.cohere.com/v1/chat` (`command-a-03-2025`) | `200` com texto |

O lote a partir do qual este repositório foi publicado, medido pelos logs de execução:

| Medição | Resultado |
| --- | --- |
| Cadeia completa | **15 contas → 15 chaves** em 2026-10-14, 19:16–20:07 — registro → e-mail → confirmação → onboarding → chave |
| Verificação | **15/15 ao vivo** (`models 200` + `chat 200`, `command-a-03-2025`) |
| Política de prova | uma chave cuja verificação ao vivo não responde de forma limpa **não** é gravada — a ferramenta prefere uma chave ausente a uma não comprovada |
| Rota de confirmação | `GET /confirm-email?token=…` → **307** → `GET /api/auth/confirm_email?token=…` — o primeiro toque consome o token |
| Gate de onboarding | `AgreeToOnboarding {agreementType:"PROFILE_SETUP"}` → `200` → `onboarded=true`, `accessType=FULL`, chamada de chave `200`; sem isso `401` |

```bash
node src/cli.js verify --keys=keys.txt    # reproduces both checks for your own file
```

## 🧭 Como funciona

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Cohere page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.cohere.ai/compatibility/v1/chat/completions → real content = the key is live
```

Por conta, duas fases, uma caixa de correio nova e uma saída nova:

1. **Fase de navegador** — um contexto Chrome isolado, fixado a uma saída. A página de registro carrega, o desafio reCAPTCHA Enterprise da própria página é resolvido, e o POST `RegisterWithEmail` na página se segue. Os ativos do captcha são armazenados em cache no disco uma vez e servidos a todos os contextos a partir dali, então uma saída de curta duração só precisa carregar a pequena página do formulário e o POST. Se o transporte da página morrer no meio do caminho, o POST de registro é repetido a partir do Node através de uma saída rotacionada.
2. **Fase pós** — HTTP puro, com rotação de saída, sem navegador. Ler a caixa de correio → resolver o wrapper do SendGrid a partir do cabeçalho `Location` (com um GET sem seguir redirecionamentos) → consumir a rota do link de confirmação → bearer `AuthV2` → `AgreeToOnboarding` → `GetOrCreateDefaultAPIKey` → verificação ao vivo → anexar a `keys.txt` e `accounts.json`.

## ⚙️ Opções da CLI

```bash
node src/cli.js mint   --count=30        # create fresh accounts and mint one key each
node src/cli.js finish                   # log in to accounts already created and finish their key
node src/cli.js verify --keys=keys.txt   # re-check keys that are already on disk
node src/cli.js help                     # tasks and flags
```

| Tarefa | Flags |
| --- | --- |
| `mint` | `--count N` (30) · `--mail <port>` (9700) · `--port N` (Chrome CDP, 9341) · `--min-kbs N` (60) · `--budget-min N` (600) · `--headless` · `--keep` |
| `finish` | `--box=<id>` · `--email=<addr>` · `--password=<pw>` · `--registered=<at>` (todos na forma `=`, `--cross` = verificação cruzada da caixa) |
| `verify` | `--keys=<file>` (padrão `keys.txt`) · `--limit=N` (0 = todos) |

Turbo önerilir (5); daha fazlası zayıf bilgisayarda yük/ban riski.

A tarefa `help` do dispatcher lista as tarefas; as flags são lidas como `--name=value`. `node src/launcher.js` oferece mint · finish · verify · settings — o cabeçalho mostra quantas saídas `proxies.txt` contém e quantas chaves estão no disco, e as configurações persistem em `launcher.config.json`.

| Variável de ambiente | Padrão | Significado |
| --- | --- | --- |
| `COHERE_MAILBOX` | broker de loopback | backend de caixa de correio (`emailnator` quando definido) |
| `COHERE_MAILTRAP_FOLDER` | Caixa de entrada Mailtrap | pasta Mailtrap para capturas |

## 🛰️ Atrás de um proxy

* `proxies.txt` — uma saída por linha, `scheme://host:port` com `http` / `socks4` / `socks5`; credenciais `user:pass@` são suportadas, `#` inicia um comentário, e um `host:port` puro assume `http://` por padrão. Linhas em branco são ignoradas.
* **Preflight no ponto de uso:** uma saída só é usada depois de ter acabado de carregar uma verificação de egress real; respostas privadas/CGNAT são rejeitadas de imediato. O tráfego de destino só sai através de uma saída do pool.
* **Fase com rotação de saída:** a fase pós tenta novamente por todo o pool (a rota de confirmação tem 12 tentativas), e `verify` rotaciona saídas em `403` enquanto só falha uma chave em `401`.
* **Sem regra de uma conta por saída:** uma saída pode carregar muitas contas — no lote publicado, 5 saídas carregaram 15 chaves e uma delas carregou 9.

## 📄 Arquivos

| Caminho | Conteúdo |
| --- | --- |
| `keys.txt` | as chaves, **uma por linha**, anexadas no momento em que uma chave passa na verificação ao vivo |
| `accounts.json` | um registro por conta: caixa de correio, senha, chave, a saída que a emitiu |
| `out/` | diretórios de execução por tentativa (capturas de tela + dumps de DOM/rede), o log do lote, contabilidade de saídas |
| `src/models.json` | gravado por `verify` — a resposta ao vivo de `GET /v1/models` da primeira chave que verifica |

## 🔌 Conectar ao 9Router

O [9Router](https://9router.com) é um roteador auto-hospedado e compatível com OpenAI. A Cohere é compatível com OpenAI (endpoint de compatibilidade `https://api.cohere.ai/compatibility/v1`), então registre-a uma vez e use todas as chaves:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Cada chave em `keys.txt` se torna uma conexão do nó do provedor `cohere` (`--api-key <key>` registra uma única chave, `--model <id>` substitui o padrão). Depois escolha um modelo dentro do 9Router:

```
cohere/command-a-03-2025
cohere/command-r-08-2024
cohere/command-r7b-12-2024
```

Aponte o conector para um `keys.txt` atualizado para adicionar mais contas; o nó e sua lista de modelos permanecem os mesmos. `node src/launcher.js --connect-9router` executa exatamente isso e pede primeiro a URL base e a senha.

Padrões: `--base http://localhost:20128`, `--password 123456`, `--name Cohere`, `--prefix cohere`, `--base-url https://api.cohere.ai/compatibility/v1`, `--model command-a-03-2025`.

## 🔑 O que uma chave lhe dá

| | |
| --- | --- |
| 🏢 Provedor | **Cohere** — [cohere.com](https://cohere.com) |
| 🎁 O que o provedor dá | 1 chave de teste por conta (1.000 chamadas/mês quando a campanha estava em vigor) — Chrome real + gate de confirmação do SendGrid |
| 🔑 O que uma chave lhe dá | uma chave de API limitada à sua própria conta: os 35 ids de modelo no endpoint abaixo, nos limites do seu plano. A cota vive na **conta**, que é exatamente por isso que esta ferramenta cria uma conta por chave |
| 🌐 Formato da API | Compatível com OpenAI: `POST https://api.cohere.ai/compatibility/v1/chat/completions` |
| 🔒 Seus dados | apenas cohere.com e o backend de caixa de correio que você configurar são contatados; as chaves permanecem na sua máquina |

## 🐞 Problemas

A Cohere mudou o RPC, a rota de confirmação ou a política de cadastro? A ferramenta para na etapa que falhou e avisa. **[Abra uma issue](../../issues)** com o comando que você executou e a saída exata — os dumps por tentativa em `out/` (capturas de tela, registros de DOM e rede) tornam as falhas reproduzíveis sem vazar uma chave. PRs são bem-vindos.

## 📄 Licença

MIT © 2026 — veja [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 cohere-bulk-apikey contributors

</div>