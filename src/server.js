import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateChatInput } from './utils/validation.js';
import { SessionMemory } from './memory.js';
import { chat } from './agent.js';

const app = express();
const PORT = process.env.PORT || 3000;
const memory = new SessionMemory();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const indexFile = path.join(publicDir, 'index.html');
const hasStaticIndex = fs.existsSync(indexFile);

const corsOptions = process.env.ALLOWED_ORIGIN
  ? { origin: process.env.ALLOWED_ORIGIN }
  : undefined;

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(publicDir));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-agent' });
});

app.get('/', (_req, res) => {
  if (!hasStaticIndex) {
    return res.json({ status: 'ok', service: 'ai-agent' });
  }

  res.sendFile(indexFile);
});

app.post('/chat', async (req, res) => {
  const { valid, error } = validateChatInput(req.body);
  if (!valid) {
    return res.status(400).json({ error });
  }

  const { sessionId, message } = req.body;

  try {
    const reply = await chat(sessionId, message, memory);
    return res.json({ reply });
  } catch (err) {
    console.error('Agent error:', err.message);

    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/chat') || req.path.startsWith('/health')) {
    return next();
  }

  if (!hasStaticIndex) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.sendFile(indexFile);
});

app.listen(PORT, () => {
  console.log(`AI Agent running on port ${PORT}`);
});
