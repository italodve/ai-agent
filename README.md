# AI Agent

Backend de chat com Claude, memoria por sessao e pronto para deploy no Railway.

## Features

- API de chat via `POST /chat`
- Memoria por sessao
- Rate limiting (20 requests/minute)
- Validacao de entrada (max 1000 caracteres por mensagem)
- CORS configuravel por variavel de ambiente
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
   - voce pode informar multiplos dominios separados por virgula

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

### Chat

```
POST /chat
```

Headers:

- `Content-Type: application/json`

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

## Error Responses

- `400` input invalido
- `403` origin nao permitida
- `413` payload muito grande
- `429` limite de requests excedido
- `500` erro interno
