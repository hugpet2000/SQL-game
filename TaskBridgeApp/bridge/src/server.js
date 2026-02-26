import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

function auth(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const header = req.headers.authorization || '';
  if (header === `Bearer ${AUTH_TOKEN}`) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'task-bridge', ts: new Date().toISOString() });
});

// Placeholder endpoints for Sprint 1 wiring
app.get('/api/tasks', auth, (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 1000);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  res.json({ items: [], total: 0, limit, offset });
});

app.get('/api/agents', auth, (_req, res) => {
  res.json({ items: [] });
});

app.listen(PORT, HOST, () => {
  console.log(`task-bridge listening at http://${HOST}:${PORT}`);
});
