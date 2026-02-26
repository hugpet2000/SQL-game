import express from 'express';
import cors from 'cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const app = express();
app.use(cors());
app.use(express.json());

const execFileAsync = promisify(execFile);

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

function auth(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const header = req.headers.authorization || '';
  if (header === `Bearer ${AUTH_TOKEN}`) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

async function runOpenClawJson(args) {
  const { stdout } = await execFileAsync('openclaw', [...args, '--json'], {
    timeout: 15000,
    maxBuffer: 4 * 1024 * 1024
  });
  return JSON.parse(stdout);
}

app.get('/health', async (_req, res) => {
  try {
    const status = await runOpenClawJson(['status']);
    res.json({ ok: true, service: 'task-bridge', ts: new Date().toISOString(), status });
  } catch (e) {
    res.status(503).json({ ok: false, service: 'task-bridge', error: e.message, ts: new Date().toISOString() });
  }
});

// Tasks are modeled as OpenClaw sessions (active conversation work units).
app.get('/api/tasks', auth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 1000);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  try {
    const sessionsData = await runOpenClawJson(['sessions', '--all-agents']);
    const sessions = Array.isArray(sessionsData.sessions) ? sessionsData.sessions : [];

    const mapped = sessions
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((s) => ({
        id: s.sessionId || s.key,
        key: s.key,
        agentId: s.agentId || 'unknown',
        kind: s.kind || 'unknown',
        model: s.model || null,
        updatedAt: s.updatedAt || null,
        ageMs: s.ageMs ?? null,
        totalTokens: s.totalTokens ?? null,
        contextTokens: s.contextTokens ?? null,
        status: s.abortedLastRun ? 'aborted' : 'active'
      }));

    const page = mapped.slice(offset, offset + limit);
    res.json({ items: page, total: mapped.length, limit, offset });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read tasks', details: e.message });
  }
});

app.get('/api/agents', auth, async (_req, res) => {
  try {
    const agents = await runOpenClawJson(['agents', 'list']);
    const items = Array.isArray(agents)
      ? agents.map((a) => ({
          id: a.id,
          name: a.identityName || a.name || a.id,
          emoji: a.identityEmoji || null,
          model: a.model || null,
          workspace: a.workspace || null,
          isDefault: Boolean(a.isDefault)
        }))
      : [];
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read agents', details: e.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`task-bridge listening at http://${HOST}:${PORT}`);
});
