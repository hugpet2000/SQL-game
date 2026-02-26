import express from 'express';
import cors from 'cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

const execFileAsync = promisify(execFile);

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/home/hugog/.npm-global/bin/openclaw';
const OPENCLAW_PATH_PREFIX = process.env.OPENCLAW_PATH_PREFIX || '/home/hugog/.npm-global/bin';
const CLI_TIMEOUT_MS = Number(process.env.CLI_TIMEOUT_MS || 15000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
const MAX_PING_TEXT = Number(process.env.MAX_PING_TEXT || 1200);

function sendError(res, status, error, details, code) {
  return res.status(status).json({ error, details, code });
}

function withTimeout(promise, ms, code = 'TIMEOUT') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Operation timed out after ${ms}ms`);
      err.code = code;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function auth(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const header = req.headers.authorization || '';
  if (header === `Bearer ${AUTH_TOKEN}`) return next();
  return sendError(res, 401, 'Unauthorized', 'Missing or invalid bearer token', 'AUTH_REQUIRED');
}

function sanitizePingText(input) {
  const text = String(input ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, MAX_PING_TEXT);
}

async function runOpenClawJson(args, timeoutMs = CLI_TIMEOUT_MS) {
  const { stdout } = await withTimeout(
    execFileAsync(OPENCLAW_BIN, [...args, '--json'], {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: `${OPENCLAW_PATH_PREFIX}:${process.env.PATH || ''}`
      }
    }),
    timeoutMs + 200,
    'CLI_TIMEOUT'
  );

  try {
    return JSON.parse(stdout);
  } catch (e) {
    const err = new Error('Failed to parse JSON from OpenClaw CLI');
    err.code = 'CLI_JSON_PARSE';
    err.details = e.message;
    throw err;
  }
}

function extractReadableText(value, depth = 0) {
  if (value == null || depth > 8) return [];
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? [t] : [];
  }
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((v) => extractReadableText(v, depth + 1));
  if (typeof value === 'object') {
    const preferredKeys = ['text', 'value', 'content', 'message', 'body', 'prompt', 'output'];
    const chunks = [];
    for (const key of preferredKeys) {
      if (key in value) chunks.push(...extractReadableText(value[key], depth + 1));
    }
    if (!chunks.length) {
      for (const nested of Object.values(value)) {
        chunks.push(...extractReadableText(nested, depth + 1));
      }
    }
    return chunks;
  }
  return [];
}

function normalizeHistoryEntry(j) {
  const role = j.role || j?.message?.role || j?.payload?.role || j?.author || null;
  const ts = j.ts || j.timestamp || j.createdAt || j?.message?.createdAt || null;

  const rawCandidates = [
    j.text,
    j?.message?.content,
    j?.payload?.content,
    j?.content,
    j?.response,
    j?.message,
    j?.payload
  ];

  const text = rawCandidates
    .flatMap((v) => extractReadableText(v))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000);

  if (!role && !text) return null;
  return { role, text, ts };
}

app.use((req, res, next) => {
  req._startAt = Date.now();
  req._reqId = crypto.randomUUID().slice(0, 8);
  res.setHeader('X-Request-Id', req._reqId);

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      sendError(res, 504, 'Request timeout', `Exceeded ${REQUEST_TIMEOUT_MS}ms`, 'REQUEST_TIMEOUT');
    }
  }, REQUEST_TIMEOUT_MS);

  res.on('finish', () => {
    clearTimeout(timer);
    const dur = Date.now() - req._startAt;
    console.log(`[${new Date().toISOString()}] ${req._reqId} ${req.method} ${req.originalUrl} ${res.statusCode} ${dur}ms`);
  });

  next();
});

app.get('/health', async (_req, res) => {
  try {
    const status = await runOpenClawJson(['status']);
    res.json({ ok: true, service: 'task-bridge', ts: new Date().toISOString(), status });
  } catch (e) {
    return sendError(res, 503, 'Health check failed', e.message, e.code || 'HEALTH_CHECK_FAILED');
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
    return sendError(res, 500, 'Failed to read tasks', e.message, e.code || 'TASKS_LIST_FAILED');
  }
});

async function resolveSessionJsonl(sessionId) {
  const agents = await runOpenClawJson(['agents', 'list']);
  if (!Array.isArray(agents)) return null;

  for (const a of agents) {
    if (!a?.id) continue;
    const p = path.join(process.env.HOME || '', '.openclaw', 'agents', a.id, 'sessions', `${sessionId}.jsonl`);
    try {
      const content = await withTimeout(readFile(p, 'utf8'), 5000, 'SESSION_READ_TIMEOUT');
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
  if (!sessionId) return sendError(res, 400, 'Missing session id', 'Parameter :id is required', 'MISSING_SESSION_ID');

  try {
    const resolved = await resolveSessionJsonl(sessionId);
    if (!resolved) return res.json({ items: [], sessionId, found: false });

    const lines = resolved.content.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = [];

    for (const line of lines) {
      try {
        const j = JSON.parse(line);
        const entry = normalizeHistoryEntry(j);
        if (entry) parsed.push(entry);
      } catch {
        // skip malformed lines
      }
    }

    res.json({ items: parsed.slice(-limit), sessionId, found: true });
  } catch (e) {
    return sendError(res, 500, 'Failed to load history', e.message, e.code || 'HISTORY_LOAD_FAILED');
  }
});

app.post('/api/tasks/:id/ping', auth, async (req, res) => {
  const sessionId = String(req.params.id || '').trim();
  const text = sanitizePingText(req.body?.text);
  const agentId = String(req.body?.agentId || '').trim();

  if (!sessionId) return sendError(res, 400, 'Missing session id', 'Parameter :id is required', 'MISSING_SESSION_ID');
  if (!text) return sendError(res, 400, 'Invalid text', 'Body { text } is required', 'INVALID_TEXT');

  try {
    const args = ['agent', '--session-id', sessionId, '--message', text];
    if (agentId) args.push('--agent', agentId);

    const result = await runOpenClawJson(args);
    res.json({ ok: true, sessionId, sent: true, textLength: text.length, result });
  } catch (e) {
    return sendError(res, 502, 'Failed to ping session', e.message, e.code || 'PING_FAILED');
  }
});

app.get('/api/config', auth, (_req, res) => {
  res.json({
    host: HOST,
    port: PORT,
    authEnabled: Boolean(AUTH_TOKEN),
    openclawBin: OPENCLAW_BIN,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    cliTimeoutMs: CLI_TIMEOUT_MS
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
    return sendError(res, 500, 'Failed to read agents', e.message, e.code || 'AGENTS_LIST_FAILED');
  }
});

app.use((_req, res) => sendError(res, 404, 'Not found', 'Route does not exist', 'NOT_FOUND'));

app.listen(PORT, HOST, () => {
  console.log(`task-bridge listening at http://${HOST}:${PORT}`);
  console.log(`OPENCLAW_BIN=${OPENCLAW_BIN}`);
});
