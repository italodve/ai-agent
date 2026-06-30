# AI Agent

Backend de chat com Claude, memoria por sessao e pronto para deploy no Railway.

## Features

- API de chat via `POST /chat`
- Endpoint de token temporario via `POST /chat/session`
- Memoria por sessao
- Rate limiting e cooldown por sessao
- Validacao de entrada
- CORS por allowlist
- Limites de memoria por sessao e numero maximo de sessoes em memoria
- Cost control (`max_tokens: 300`)

## Setup Local

1. Clone o repositorio:
   ```bash
   git clone https://github.com/italodve/ai-agent.git
   cd ai-agent
   ```

2. Instale as dependencias:
   ```bash
   npm install
   ```

3. Crie o `.env` a partir do exemplo:
   ```bash
   cp .env.example .env
   ```

4. Preencha as variaveis:
   - `ANTHROPIC_API_KEY` - sua chave da Anthropic
   - `ALLOWED_ORIGIN` - dominio do front-end autorizado a chamar a API
   - `CHAT_SESSION_SECRET` - segredo longo e aleatorio para assinar tokens temporarios do chat
   - voce pode informar multiplos dominios em `ALLOWED_ORIGIN`, separados por virgula

5. Inicie o servidor:
   ```bash
   npm start
   ```

## Deploy no Railway

1. Publique este repositorio no GitHub.
2. Crie um projeto no Railway e conecte este repositorio.
3. Configure as variaveis:
   - `ANTHROPIC_API_KEY`
   - `ALLOWED_ORIGIN`
   - `CHAT_SESSION_SECRET`
4. O Railway detecta Node.js e executa `npm start`.

## API

### Health

```
GET /
```

ou

```
GET /health
```

Resposta:

```json
{
  "status": "ok",
  "service": "ai-agent"
}
```

### Session Token

```
POST /chat/session
```

Headers:

- `Content-Type: application/json`

Body:

```json
{
  "sessionId": "user-123"
}
```

Resposta:

```json
{
  "token": "token-temporario",
  "expiresInMs": 900000
}
```

### Chat

```
POST /chat
```

Headers:

- `Content-Type: application/json`
- `X-Chat-Token: token-temporario`

Body:

```json
{
  "sessionId": "user-123",
  "message": "Hello!"
}
```

Resposta:

```json
{
  "reply": "Hello! How can I help you today?"
}
```

### Lead

```
POST /lead
```

Headers:

- `Content-Type: application/json`
- `X-Chat-Token: token-temporario`

Body:

```json
{
  "sessionId": "user-123",
  "lead": [
    { "label": "Nome", "value": "Italo" },
    { "label": "Interesse", "value": "comprar" }
  ],
  "source": "https://site.com"
}
```

Resposta:

```json
{ "status": "accepted" }
```

O endpoint encaminha o lead para `LEAD_WEBHOOK_URL`. Sem essa variavel configurada, retorna `503`.

#### Salvando numa planilha do Google (Apps Script)

1. Crie uma planilha no Google Sheets.
2. Em **Extensoes > Apps Script**, cole:

   ```js
   function doPost(e) {
     const data = JSON.parse(e.postData.contents);
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
     const campos = (data.fields || []).map(f => `${f.label}: ${f.value}`).join(' | ');
     sheet.appendRow([data.receivedAt, data.sessionId, campos, data.source || '']);
     return ContentService.createTextOutput('ok');
   }
   ```

3. **Implantar > Nova implantacao > App da Web**, com acesso "Qualquer pessoa".
4. Copie a URL gerada e use em `LEAD_WEBHOOK_URL`.

## Error Responses

- `400` input invalido
- `401` token invalido ou expirado
- `403` origin nao permitida
- `413` payload muito grande
- `429` limite de requests excedido
- `500` erro interno
- `502` falha ao enviar o lead ao webhook
- `503` armazenamento de lead nao configurado (`LEAD_WEBHOOK_URL` ausente)
