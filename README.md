# Imob Monorepo

Os três projetos (`site-imob`, `SIteLeads` e `ai-agent`) unificados em um único
repositório, com **um único deploy no Railway**:

| Rota | O que é | Projeto original |
| --- | --- | --- |
| `/` | Site público do consultor imobiliário (Deivid Vilela) | [`site-imob`](https://github.com/italodve/site-imob) |
| `/painel` | Painel de cadastro de imóveis e gestão de leads | [`SIteLeads`](https://github.com/italodve/siteleads) |
| `/chat`, `/chat/session`, `/lead`, `/health` | API do agente de IA (Claude) | [`ai-agent`](https://github.com/italodve/ai-agent) |

## Por que essa stack

- **1 serviço só na Railway** em vez de 3 → menor custo e um único deploy.
- Um único servidor **Node.js + Express** serve os dois front-ends estáticos e
  a API. Não há build step: os sites são HTML/CSS/JS puro.
- O chat do site chama a API **na mesma origem** → sem CORS, sem preflight,
  sem precisar configurar `ALLOWED_ORIGIN` apontando para outro domínio.
- Assets estáticos são servidos **antes** do rate limiter da API (imagens e
  CSS não consomem cota) e com cache de 1 dia (HTML sempre revalidado).

## Estrutura

```
├── src/                  # backend (Express + Claude)
│   ├── server.js         # servidor: estáticos + API
│   ├── agent.js          # prompt e chamada ao Claude
│   └── memory.js         # memória por sessão
├── public/               # site público (servido em /)
│   └── painel/           # painel de imóveis/leads (servido em /painel)
├── google-apps-script/   # backend opcional na planilha do Google
├── docs/                 # READMEs originais dos projetos
├── railway.json          # configuração de deploy do Railway
└── package.json
```

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha ANTHROPIC_API_KEY e CHAT_SESSION_SECRET
npm start
# http://localhost:3000        → site
# http://localhost:3000/painel → painel
```

## Deploy no Railway

1. Crie um projeto no Railway e conecte este repositório (branch principal).
2. Configure as variáveis:
   - `ANTHROPIC_API_KEY` — chave da Anthropic (obrigatória para o chat)
   - `CHAT_SESSION_SECRET` — segredo longo e aleatório
   - `LEAD_WEBHOOK_URL` — URL do Apps Script que grava os leads na planilha
     (opcional; sem ela o `/lead` responde 503)
   - `ALLOWED_ORIGIN` — **opcional**, só se algum outro domínio externo for
     chamar a API (o site e o painel deste deploy já são aceitos)
3. O Railway detecta Node.js e usa o `railway.json` (start `npm start`,
   healthcheck em `/health`).
4. Em **Settings → Networking**, gere o domínio público. Pronto: site, painel
   e API no mesmo domínio.

## Integração com a planilha do Google

O fluxo de dados continua o mesmo dos projetos originais:

1. O painel (`/painel`) cadastra os imóveis na aba `Imoveis` da planilha via
   Apps Script ([`google-apps-script/apps-script.gs`](./google-apps-script/apps-script.gs)).
2. O site (`/`) lê a aba `Imoveis` (endpoint `gviz`, somente leitura) e monta
   os cards de imóveis.
3. O chat coleta o lead e o backend encaminha para `LEAD_WEBHOOK_URL`, que
   grava na aba `Leads` — lida pelo painel.

Detalhes de cada projeto: [`docs/site.md`](./docs/site.md),
[`docs/painel.md`](./docs/painel.md).

## API

A API é a mesma do `ai-agent` original — `POST /chat/session`, `POST /chat`,
`POST /lead`, `GET /health` — documentada em detalhe abaixo.

### Session Token

`POST /chat/session` com `{ "sessionId": "user-123" }` →
`{ "token": "...", "expiresInMs": 900000 }`

### Chat

`POST /chat` com header `X-Chat-Token` e body
`{ "sessionId": "user-123", "message": "Olá" }` → `{ "reply": "..." }`

### Lead

`POST /lead` com header `X-Chat-Token` e body
`{ "sessionId": "user-123", "lead": [{ "label": "Nome", "value": "Italo" }], "source": "https://site.com" }`
→ `{ "status": "accepted" }` (encaminha para `LEAD_WEBHOOK_URL`)

### Erros

- `400` input inválido · `401` token inválido/expirado · `403` origin não
  permitida · `413` payload muito grande · `429` rate limit · `500` erro
  interno · `502` falha no webhook · `503` `LEAD_WEBHOOK_URL` ausente
