# AI Agent

AI Agent powered by Claude, with session memory and ready for Railway deployment.

## Features

- Claude-powered conversational AI via `POST /chat`
- Per-session conversation memory
- Same-origin friendly frontend + backend deployment
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
   - `ANTHROPIC_API_KEY` - your Anthropic API key
   - `ALLOWED_ORIGIN` - optional origin allowed for cross-origin requests during development

5. Start the server:
   ```bash
   npm start
   ```

## Deploy on Railway

1. Push this repository to GitHub.

2. Go to [railway.app](https://railway.app) and create a new project.

3. Select **Deploy from GitHub repo** and connect this repository.

4. Add the following environment variables in Railway's dashboard:
   - `ANTHROPIC_API_KEY` - your Anthropic API key
   - `ALLOWED_ORIGIN` - optional; only needed if your frontend is hosted on another domain during development

   > `PORT` is automatically set by Railway - no need to configure it.

5. Railway will detect Node.js, run `npm install`, and execute `npm start` automatically.

6. To serve the landing page and API on the same domain, place your frontend files inside `public/`.
   - Example: `public/index.html`
   - The server will serve `/` from that file when it exists
   - The frontend can then call `POST /chat` without exposing secrets in the browser

## API Usage

### Health Check

```
GET /health
```

Response: `{ "status": "ok", "service": "ai-agent" }`

### Chat

```
POST /chat
```

**Headers:**
- `Content-Type: application/json`

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
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Project Structure

```
src/
|-- server.js           # Express app, routes, startup
|-- agent.js            # Claude API integration
|-- memory.js           # Session memory (Map, Redis-ready)
|-- middleware/         # Optional middleware extensions
`-- utils/
    `-- validation.js   # Input validation
```
