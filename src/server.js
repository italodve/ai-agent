import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';
import { validateChatInput } from './utils/validation.js';
import { SessionMemory } from './memory.js';
import { chat } from './agent.js';

const app = express();
const PORT = process.env.PORT || 3000;
const memory = new SessionMemory();

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

app.use(limiter);

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-agent' });
});

app.post('/chat', authMiddleware, async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`AI Agent running on port ${PORT}`);
});
