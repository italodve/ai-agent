# AI Agent

AI Agent powered by Claude, with session memory and ready for Railway deployment.

## Features

- Claude-powered conversational AI via `POST /chat`
- Per-session conversation memory
- API key authentication (`x-api-key` header)
- Rate limiting (20 requests/minute)
- Input validation (max 1000 characters per message)
- Cost control (`max_tokens: 300`)

## Setup Local

1. Clone the repository:
   ```bash
   git clone https://github.com/italodve/ai-agent.git
   cd ai-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Fill in the environment variables in `.env`:
   - `ANTHROPIC_API_KEY` — your Anthropic API key
   - `INTERNAL_API_KEY` — a secret key for authenticating requests

5. Start the server:
   ```bash
   npm start
   ```

## Deploy on Railway

1. Push this repository to GitHub.

2. Go to [railway.app](https://railway.app) and create a new project.

3. Select **Deploy from GitHub repo** and connect this repository.

4. Add the following environment variables in Railway's dashboard:
   - `ANTHROPIC_API_KEY` — your Anthropic API key
   - `INTERNAL_API_KEY` — a secret key for authenticating requests

   > `PORT` is automatically set by Railway — no need to configure it.

5. Railway will detect Node.js, run `npm install`, and execute `npm start` automatically.

## API Usage

### Health Check

```
GET /
```

Response: `{ "status": "ok", "service": "ai-agent" }`

### Chat

```
POST /chat
```

**Headers:**
- `Content-Type: application/json`
- `x-api-key: YOUR_INTERNAL_API_KEY`

**Body:**
```json
{
  "sessionId": "user-123",
  "message": "Hello!"
}
```

**Response:**
```json
{
  "reply": "Hello! How can I help you today?"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid input (missing fields or message too long) |
| 401 | Missing or invalid `x-api-key` |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Project Structure

```
src/
├── server.js           # Express app, routes, startup
├── agent.js            # Claude API integration
├── memory.js           # Session memory (Map, Redis-ready)
├── middleware/
│   └── auth.js         # API key authentication
└── utils/
    └── validation.js   # Input validation
```
