import express from 'express';
import cors from 'cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const app = express();
app.use(cors());
app.use(express.json());

const execFileAsync = promisify(execFile);

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/home/hugog/.npm-global/bin/openclaw';
const OPENCLAW_PATH_PREFIX = process.env.OPENCLAW_PATH_PREFIX || '/home/hugog/.npm-global/bin';

function auth(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const header = req.headers.authorization || '';
  if (header === `Bearer ${AUTH_TOKEN}`) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

async function runOpenClawJson(args) {
  const { stdout } = await execFileAsync(OPENCLAW_BIN, [...args, '--json'], {
    timeout: 15000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      PATH: `${OPENCLAW_PATH_PREFIX}:${process.env.PATH || ''}`
    }
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
  const q = String(req.query.q || '').trim().toLowerCase();
  const agentId = String(req.query.agentId || '').trim();
  const statusFilter = String(req.query.status || '').trim().toLowerCase();

  try {
    const sessionsData = await runOpenClawJson(['sessions', '--all-agents']);
    const sessions = Array.isArray(sessionsData.sessions) ? sessionsData.sessions : [];

    const mapped = sessions
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
      }))
      .filter((t) => {
        if (agentId && t.agentId !== agentId) return false;
        if (statusFilter && t.status.toLowerCase() !== statusFilter) return false;
        if (q) {
          const hay = `${t.id} ${t.key} ${t.agentId} ${t.kind} ${t.model || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const page = mapped.slice(offset, offset + limit);
    res.json({ items: page, total: mapped.length, limit, offset, filters: { q, agentId, status: statusFilter || null } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read tasks', details: e.message });
  }
});

async function resolveSessionJsonl(sessionId) {
  const agents = await runOpenClawJson(['agents', 'list']);
  if (!Array.isArray(agents)) return null;

  for (const a of agents) {
    if (!a?.id) continue;
    const p = path.join(process.env.HOME || '', '.openclaw', 'agents', a.id, 'sessions', `${sessionId}.jsonl`);
    try {
      const content = await readFile(p, 'utf8');
      return { path: p, content };
    } catch {
      // continue
    }
  }
  return null;
}

app.get('/api/tasks/:id/history', auth, async (req, res) => {
  const sessionId = String(req.params.id || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 200);
  if (!sessionId) return res.status(400).json({ error: 'Missing session id' });

  try {
    const resolved = await resolveSessionJsonl(sessionId);
    if (!resolved) return res.json({ items: [], sessionId, found: false });

    const lines = resolved.content.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      try {
        const j = JSON.parse(line);
        const role = j.role || j?.message?.role || j?.payload?.role || j?.author || null;
        const rawText = j.text || j?.message?.content || j?.payload?.content || j?.content || '';
        const text = typeof rawText === 'string' ? rawText : JSON.stringify(rawText);
        const ts = j.ts || j.timestamp || j.createdAt || null;
        if (role || text) parsed.push({ role, text: String(text).slice(0, 4000), ts });
      } catch {
        // skip malformed lines
      }
    }

    res.json({ items: parsed.slice(-limit), sessionId, found: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load history', details: e.message });
  }
});

app.get('/api/config', auth, (_req, res) => {
  res.json({
    host: HOST,
    port: PORT,
    authEnabled: Boolean(AUTH_TOKEN),
    openclawBin: OPENCLAW_BIN
  });
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
  console.log(`OPENCLAW_BIN=${OPENCLAW_BIN}`);
});
