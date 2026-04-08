import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { validateChatInput, validateSessionId } from './utils/validation.js';
import { SessionMemory } from './memory.js';
import { chat } from './agent.js';

const app = express();
const PORT = process.env.PORT || 3000;
const memory = new SessionMemory();
const sessionTokenSecret = process.env.CHAT_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const SESSION_TOKEN_TTL_MS = 15 * 60 * 1000;
const SESSION_MESSAGE_COOLDOWN_MS = 1500;
const MAX_SESSION_ACTIVITY = 1000;
const sessionActivity = new Map();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Chat-Token'],
  maxAge: 600,
};

function getRequestOrigin(req) {
  const originHeader = req.get('origin');
  if (originHeader) {
    return originHeader;
  }

  const refererHeader = req.get('referer');
  if (!refererHeader) {
    return '';
  }

  try {
    return new URL(refererHeader).origin;
  } catch {
    return '';
  }
}

function requireTrustedOrigin(req, res, next) {
  if (allowedOrigins.length === 0) {
    return res.status(503).json({ error: 'Server origin policy is not configured' });
  }

  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  return next();
}

function signSessionToken(sessionId) {
  const payload = JSON.stringify({
    sessionId,
    exp: Date.now() + SESSION_TOKEN_TTL_MS,
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', sessionTokenSecret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token, sessionId) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return false;
  }

  const [encodedPayload, providedSignature] = token.split('.');
  const expectedSignature = crypto
    .createHmac('sha256', sessionTokenSecret)
    .update(encodedPayload)
    .digest('base64url');

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return payload.sessionId === sessionId && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function enforceSessionCooldown(sessionId) {
  const now = Date.now();
  const lastActivityAt = sessionActivity.get(sessionId) || 0;
  if (now - lastActivityAt < SESSION_MESSAGE_COOLDOWN_MS) {
    return false;
  }

  sessionActivity.delete(sessionId);
  sessionActivity.set(sessionId, now);

  while (sessionActivity.size > MAX_SESSION_ACTIVITY) {
    const oldestKey = sessionActivity.keys().next().value;
    if (!oldestKey) {
      break;
    }
    sessionActivity.delete(oldestKey);
  }

  return true;
}

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(express.json({ limit: '8kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.path === '/health',
});

app.use(limiter);

const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many session requests, please try again later' },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat requests, please try again later' },
});

app.use((err, _req, res, next) => {
  if (!err) {
    return next();
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }

  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  return res.status(400).json({ error: 'Bad request' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-agent' });
});

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-agent' });
});

app.post('/chat/session', requireTrustedOrigin, sessionLimiter, (req, res) => {
  const sessionValidation = validateSessionId(req.body?.sessionId);
  if (!sessionValidation.valid) {
    return res.status(400).json({ error: sessionValidation.error });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    token: signSessionToken(req.body.sessionId),
    expiresInMs: SESSION_TOKEN_TTL_MS,
  });
});

app.post('/chat', requireTrustedOrigin, chatLimiter, async (req, res) => {
  const { valid, error } = validateChatInput(req.body);
  if (!valid) {
    return res.status(400).json({ error });
  }

  const sessionId = req.body.sessionId;
  const message = req.body.message.trim();
  const sessionToken = req.get('x-chat-token');

  if (!verifySessionToken(sessionToken, sessionId)) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  if (!enforceSessionCooldown(sessionId)) {
    return res.status(429).json({ error: 'Please wait before sending another message' });
  }

  try {
    res.setHeader('Cache-Control', 'no-store');
    const reply = await chat(sessionId, message, memory);
    return res.json({ reply });
  } catch (err) {
    console.error('Agent error:', err.message);

    if (err.status) {
      return res.status(err.status).json({ error: 'Upstream service error' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Agent running on port ${PORT}`);
});
