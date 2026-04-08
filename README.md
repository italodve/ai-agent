# AI Agent

Backend de chat com Claude, memória por sessão e pronto para deploy no Railway.

## Features

- API de chat via `POST /chat`
- Memória por sessão
- Rate limiting (20 requests/minute)
- Validação de entrada (max 1000 caracteres por mensagem)
- CORS configurável por variável de ambiente
- Cost control (`max_tokens: 300`)

## Setup Local

1. Clone o repositório:
   ```bash
   git clone https://github.com/italodve/ai-agent.git
   cd ai-agent
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie o `.env` a partir do exemplo:
   ```bash
   cp .env.example .env
   ```

4. Preencha as variáveis:
   - `ANTHROPIC_API_KEY` - sua chave da Anthropic
   - `ALLOWED_ORIGIN` - domínio do front-end autorizado a chamar a API

5. Inicie o servidor:
   ```bash
   npm start
   ```

## Deploy no Railway

1. Publique este repositório no GitHub.
2. Crie um projeto no Railway e conecte este repositório.
3. Configure as variáveis:
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

- `400` input inválido
- `429` limite de requests excedido
- `500` erro interno
