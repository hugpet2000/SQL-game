import express from 'express';
import cors from 'cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

const STARTED_AT_MS = Date.now();
const SERVER_PID = process.pid;
const BRIDGE_DIR = path.dirname(fileURLToPath(import.meta.url));
const TASKBRIDGE_ROOT = path.resolve(BRIDGE_DIR, '..', '..');

const metrics = {
  requests: 0,
  errors: 0,
  totalLatencyMs: 0,
  avgLatencyMs: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cliCalls: 0,
  cliRetries: 0,
  cliFailures: 0
};

const runtimeConfig = {
  host: '127.0.0.1',
  port: 8787,
  authToken: '',
  openclawBin: '/home/hugog/.npm-global/bin/openclaw',
  openclawPathPrefix: '/home/hugog/.npm-global/bin',
  cliTimeoutMs: 15000,
  requestTimeoutMs: 20000,
  maxPingText: 1200,
  cacheTtlMs: 2000,
  cliRetryCount: 2,
  cliRetryBaseDelayMs: 250,
  cliRetryMaxDelayMs: 2000,
  breakerFailureThreshold: 3,
  breakerCooldownMs: 8000,
  healthGraceMs: 15000
};

const cache = {
  sessions: { value: null, expiresAt: 0, fetchedAt: 0 },
  agents: { value: null, expiresAt: 0, fetchedAt: 0 }
};

const inFlight = {
  sessions: null,
  agents: null
};

const breakers = {
  sessions: createBreaker(),
  agents: createBreaker()
};

const health = {
  openclawReachable: false,
  lastSuccessAt: null,
  lastFailureAt: null,
  consecutiveFailures: 0,
  latencySamplesMs: []
};

let bridgeVersion = {
  commit: 'unknown',
  branch: 'unknown'
};

function createBreaker() {
  return {
    state: 'closed',
    failures: 0,
    openedAt: null,
    cooldownUntil: null,
    lastError: null
  };
}

function loadRuntimeConfig() {
  runtimeConfig.host = process.env.HOST || '127.0.0.1';
  runtimeConfig.port = Number(process.env.PORT || 8787);
  runtimeConfig.authToken = process.env.AUTH_TOKEN || '';
  runtimeConfig.openclawBin = process.env.OPENCLAW_BIN || '/home/hugog/.npm-global/bin/openclaw';
  runtimeConfig.openclawPathPrefix = process.env.OPENCLAW_PATH_PREFIX || '/home/hugog/.npm-global/bin';
  runtimeConfig.cliTimeoutMs = Number(process.env.CLI_TIMEOUT_MS || 15000);
  runtimeConfig.requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
  runtimeConfig.maxPingText = Number(process.env.MAX_PING_TEXT || 1200);
  runtimeConfig.cacheTtlMs = Number(process.env.CACHE_TTL_MS || 2000);
  runtimeConfig.cliRetryCount = Number(process.env.CLI_RETRY_COUNT || 2);
  runtimeConfig.cliRetryBaseDelayMs = Number(process.env.CLI_RETRY_BASE_DELAY_MS || 250);
  runtimeConfig.cliRetryMaxDelayMs = Number(process.env.CLI_RETRY_MAX_DELAY_MS || 2000);
  runtimeConfig.breakerFailureThreshold = Number(process.env.BREAKER_FAILURE_THRESHOLD || 3);
  runtimeConfig.breakerCooldownMs = Number(process.env.BREAKER_COOLDOWN_MS || 8000);
  runtimeConfig.healthGraceMs = Number(process.env.HEALTH_GRACE_MS || 15000);
}

function sendError(res, status, error, details, code, extra = {}) {
  return res.status(status).json({
    error,
    details,
    code,
    ...extra
  });
}

function createStableError(err, fallbackCode = 'INTERNAL_ERROR') {
  const code = err?.code || fallbackCode;
  const message = err?.message || 'Unknown error';
  return {
    code,
    message,
    retriable: Boolean(err?.retriable),
    attempts: Number(err?.attempts || 1),
    timeoutMs: err?.timeoutMs ?? null,
    cause: err?.cause ?? null
  };
}

function withTimeout(promise, ms, code = 'TIMEOUT') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Operation timed out after ${ms}ms`);
      err.code = code;
      err.timeoutMs = ms;
      err.retriable = true;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function auth(req, res, next) {
  if (!runtimeConfig.authToken) return next();
  const header = req.headers.authorization || '';
  if (header === `Bearer ${runtimeConfig.authToken}`) return next();
  return sendError(res, 401, 'Unauthorized', 'Missing or invalid bearer token', 'AUTH_REQUIRED');
}

function sanitizePingText(input) {
  const text = String(input ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, runtimeConfig.maxPingText);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function updateLatencySample(ms) {
  health.latencySamplesMs.push(ms);
  if (health.latencySamplesMs.length > 200) health.latencySamplesMs.shift();
}

function calcP95(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

function markOpenclawSuccess(latencyMs) {
  health.openclawReachable = true;
  health.lastSuccessAt = nowIso();
  health.consecutiveFailures = 0;
  if (typeof latencyMs === 'number') updateLatencySample(latencyMs);
}

function markOpenclawFailure() {
  health.openclawReachable = false;
  health.lastFailureAt = nowIso();
  health.consecutiveFailures += 1;
}

function msSinceIso(iso) {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Date.now() - ts);
}

function computeHealthState() {
  const sinceSuccessMs = msSinceIso(health.lastSuccessAt);
  const graceActive = Number.isFinite(sinceSuccessMs) && sinceSuccessMs <= runtimeConfig.healthGraceMs;
  const breakerOpen = Object.values(breakers).some((b) => b.state === 'open');

  const stableReachable = health.openclawReachable || graceActive;
  const hardDown = health.consecutiveFailures >= Math.max(2, runtimeConfig.breakerFailureThreshold);
  const ok = stableReachable && !hardDown;
  const state = ok ? (health.openclawReachable ? 'connected' : 'degraded') : 'down';

  return {
    ok,
    state,
    breakerOpen,
    stableReachable,
    graceActive,
    sinceLastSuccessMs: sinceSuccessMs
  };
}

function isTransientCliError(err) {
  const knownCodes = new Set(['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ENOBUFS', 'EAI_AGAIN', 'CLI_TIMEOUT']);
  if (knownCodes.has(err?.code)) return true;

  const message = `${err?.message || ''} ${err?.stderr || ''}`.toLowerCase();
  if (message.includes('timed out')) return true;
  if (message.includes('temporarily unavailable')) return true;
  if (message.includes('resource busy')) return true;

  if (typeof err?.code === 'number' && err.code !== 0) {
    return message.includes('internal') || message.includes('failed to connect') || message.includes('try again');
  }

  return false;
}

function nextBackoffMs(attempt) {
  const base = runtimeConfig.cliRetryBaseDelayMs;
  const max = runtimeConfig.cliRetryMaxDelayMs;
  const raw = Math.min(max, base * (2 ** (attempt - 1)));
  const jitter = Math.floor(Math.random() * Math.max(20, Math.floor(raw * 0.2)));
  return raw + jitter;
}

function ensureBreakerAllows(key) {
  const breaker = breakers[key];
  if (!breaker) return;

  if (breaker.state === 'open') {
    if (breaker.cooldownUntil && Date.now() >= breaker.cooldownUntil) {
      breaker.state = 'half-open';
      return;
    }

    const err = new Error(`Circuit open for ${key}`);
    err.code = 'CIRCUIT_OPEN';
    err.retriable = true;
    err.cause = {
      key,
      cooldownUntil: breaker.cooldownUntil ? new Date(breaker.cooldownUntil).toISOString() : null,
      lastError: breaker.lastError
    };
    throw err;
  }
}

function recordBreakerSuccess(key) {
  const breaker = breakers[key];
  if (!breaker) return;
  breaker.state = 'closed';
  breaker.failures = 0;
  breaker.openedAt = null;
  breaker.cooldownUntil = null;
  breaker.lastError = null;
}

function recordBreakerFailure(key, err) {
  const breaker = breakers[key];
  if (!breaker) return;

  breaker.failures += 1;
  breaker.lastError = err?.message || err?.code || 'unknown';

  if (breaker.failures >= runtimeConfig.breakerFailureThreshold) {
    breaker.state = 'open';
    breaker.openedAt = Date.now();
    breaker.cooldownUntil = Date.now() + runtimeConfig.breakerCooldownMs;
  }
}

async function runOpenClawJson(args, timeoutMs = runtimeConfig.cliTimeoutMs, options = {}) {
  const retries = Number.isFinite(options.retries) ? options.retries : runtimeConfig.cliRetryCount;
  const expensiveKey = options.expensiveKey || null;

  metrics.cliCalls += 1;

  if (expensiveKey) ensureBreakerAllows(expensiveKey);

  let lastErr = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const started = Date.now();

    try {
      const { stdout } = await withTimeout(
        execFileAsync(runtimeConfig.openclawBin, [...args, '--json'], {
          timeout: timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            PATH: `${runtimeConfig.openclawPathPrefix}:${process.env.PATH || ''}`
          }
        }),
        timeoutMs + 250,
        'CLI_TIMEOUT'
      );

      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch (e) {
        const parseErr = new Error('Failed to parse JSON from OpenClaw CLI');
        parseErr.code = 'CLI_JSON_PARSE';
        parseErr.details = e.message;
        parseErr.retriable = false;
        throw parseErr;
      }

      markOpenclawSuccess(Date.now() - started);
      if (expensiveKey) recordBreakerSuccess(expensiveKey);

      return parsed;
    } catch (rawErr) {
      const transient = isTransientCliError(rawErr);
      const err = rawErr;
      err.retriable = transient;
      err.attempts = attempt;
      err.timeoutMs = timeoutMs;

      markOpenclawFailure();
      lastErr = err;

      if (expensiveKey) recordBreakerFailure(expensiveKey, err);

      const canRetry = transient && attempt <= retries;
      if (!canRetry) break;

      metrics.cliRetries += 1;
      await sleep(nextBackoffMs(attempt));
    }
  }

  metrics.cliFailures += 1;
  throw lastErr;
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

function ageFromFetchedAt(fetchedAt) {
  if (!fetchedAt) return null;
  return Math.max(0, Date.now() - fetchedAt);
}

async function getCachedJson(key, fetcher) {
  const now = Date.now();
  const entry = cache[key];
  if (entry && entry.value && entry.expiresAt > now) {
    metrics.cacheHits += 1;
    return { data: entry.value, cache: 'hit', ageMs: ageFromFetchedAt(entry.fetchedAt) };
  }

  metrics.cacheMisses += 1;
  const data = await fetcher();
  cache[key] = {
    value: data,
    fetchedAt: Date.now(),
    expiresAt: now + runtimeConfig.cacheTtlMs
  };
  return { data, cache: 'miss', ageMs: 0 };
}

function getDedupePromise(key, factory) {
  if (inFlight[key]) return inFlight[key];
  inFlight[key] = Promise.resolve()
    .then(factory)
    .finally(() => {
      inFlight[key] = null;
    });
  return inFlight[key];
}

function clearLookupCaches() {
  cache.sessions = { value: null, expiresAt: 0, fetchedAt: 0 };
  cache.agents = { value: null, expiresAt: 0, fetchedAt: 0 };
}

async function getSessionsData() {
  return getDedupePromise('sessions', async () => {
    const result = await getCachedJson('sessions', () => runOpenClawJson(['sessions', '--all-agents'], runtimeConfig.cliTimeoutMs, { expensiveKey: 'sessions' }));
    const sessions = Array.isArray(result.data?.sessions) ? result.data.sessions : [];
    return { sessions, cache: result.cache, ageMs: result.ageMs };
  });
}

async function getAgentsData() {
  return getDedupePromise('agents', async () => {
    const result = await getCachedJson('agents', () => runOpenClawJson(['agents', 'list'], runtimeConfig.cliTimeoutMs, { expensiveKey: 'agents' }));
    const agents = Array.isArray(result.data) ? result.data : [];
    return { agents, cache: result.cache, ageMs: result.ageMs };
  });
}

function toRelativeTime(tsMs) {
  if (!Number.isFinite(tsMs)) return 'unknown';
  const delta = Math.max(0, Date.now() - tsMs);
  const sec = Math.floor(delta / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function mapSessionStatus(s) {
  if (s.abortedLastRun) return 'Attention needed';
  const ageMs = Number(s.ageMs || 0);
  if (ageMs > 12 * 60 * 60 * 1000) return 'Stale';
  if (ageMs > 60 * 60 * 1000) return 'Idle';
  return 'Active';
}

function getRiskFlags(s) {
  const flags = [];
  const ageMs = Number(s.ageMs || 0);
  if (s.abortedLastRun) flags.push('abortedLastRun');
  if (ageMs > 6 * 60 * 60 * 1000) flags.push('staleSession');
  if (!s.agentId) flags.push('unknownAgent');
  if ((s.contextTokens || 0) > 120000) flags.push('highContextTokens');
  return flags;
}

function getSessionStatusCode(s) {
  if (s.abortedLastRun) return 'failed';
  const ageMs = Number(s.ageMs || 0);
  if (ageMs <= 5 * 60 * 1000) return 'running';
  if (ageMs <= 30 * 60 * 1000) return 'active';
  if (ageMs <= 6 * 60 * 60 * 1000) return 'queued';
  return 'inactive';
}

function getSessionStatusLabelFromCode(code) {
  const labels = {
    running: 'Running',
    active: 'Active',
    queued: 'Queued',
    failed: 'Failed',
    inactive: 'Inactive'
  };
  return labels[code] || 'Unknown';
}

function deriveCurrentTask(s) {
  return {
    sessionId: s.sessionId || s.key || null,
    kind: s.kind || 'unknown',
    model: s.model || null,
    updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
    lastSeenRelative: toRelativeTime(Number(s.updatedAt || Date.now() - (s.ageMs || 0))),
    totalTokens: s.totalTokens ?? null,
    contextTokens: s.contextTokens ?? null
  };
}

function buildSystemHealthPayload() {
  const p95LatencyMs = calcP95(health.latencySamplesMs);
  const breakersState = {
    sessions: {
      state: breakers.sessions.state,
      failures: breakers.sessions.failures,
      cooldownUntil: breakers.sessions.cooldownUntil ? new Date(breakers.sessions.cooldownUntil).toISOString() : null
    },
    agents: {
      state: breakers.agents.state,
      failures: breakers.agents.failures,
      cooldownUntil: breakers.agents.cooldownUntil ? new Date(breakers.agents.cooldownUntil).toISOString() : null
    }
  };

  const allClosed = Object.values(breakersState).every((b) => b.state === 'closed');

  return {
    connection: {
      openclawReachable: health.openclawReachable,
      status: health.openclawReachable ? 'connected' : 'degraded',
      lastSuccessAt: health.lastSuccessAt,
      lastFailureAt: health.lastFailureAt,
      consecutiveFailures: health.consecutiveFailures,
      latencyP95Ms: p95LatencyMs
    },
    system: {
      uptimeSec: Math.floor(process.uptime()),
      requests: metrics.requests,
      errors: metrics.errors,
      avgLatencyMs: metrics.avgLatencyMs,
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
      circuitBreakers: breakersState,
      healthy: (health.openclawReachable || health.lastSuccessAt !== null) && allClosed
    }
  };
}

function buildActivityFeed(sessions, agentNameMap, limit = 25) {
  return sessions
    .map((s) => {
      const statusCode = getSessionStatusCode(s);
      const updatedMs = Number(s.updatedAt || Date.now() - (s.ageMs || 0));
      const agentId = s.agentId || 'unknown';
      const actionText = s.abortedLastRun
        ? `Session ${s.sessionId || s.key || 'unknown'} aborted on ${s.model || 'unknown model'}`
        : `Session ${s.sessionId || s.key || 'unknown'} updated (${s.kind || 'unknown'})`;

      return {
        timestamp: Number.isFinite(updatedMs) ? new Date(updatedMs).toISOString() : null,
        agentName: agentNameMap.get(agentId) || agentId,
        actionText,
        status: statusCode
      };
    })
    .sort((a, b) => (Date.parse(b.timestamp || 0) || 0) - (Date.parse(a.timestamp || 0) || 0))
    .slice(0, limit);
}

function buildAgentsSnapshot(agents, sessions) {
  const byAgent = new Map();

  for (const s of sessions) {
    const agentId = s.agentId || 'unknown';
    const list = byAgent.get(agentId) || [];
    list.push(s);
    byAgent.set(agentId, list);
  }

  return agents.map((a) => {
    const agentSessions = (byAgent.get(a.id) || []).sort((x, y) => Number(y.updatedAt || 0) - Number(x.updatedAt || 0));
    const current = agentSessions[0] || null;
    const statusCode = current ? getSessionStatusCode(current) : 'inactive';

    return {
      id: a.id,
      name: a.identityName || a.name || a.id,
      emoji: a.identityEmoji || null,
      model: a.model || null,
      workspace: a.workspace || null,
      isDefault: Boolean(a.isDefault),
      status: statusCode,
      statusLabel: getSessionStatusLabelFromCode(statusCode),
      currentTask: current ? deriveCurrentTask(current) : null,
      heartbeat: {
        lastSeenAt: current?.updatedAt ? new Date(current.updatedAt).toISOString() : null,
        lastSeenRelative: current ? toRelativeTime(Number(current.updatedAt || Date.now() - (current.ageMs || 0))) : 'unknown',
        stale: current ? Number(current.ageMs || 0) > 6 * 60 * 60 * 1000 : true
      },
      sessionsCount: agentSessions.length
    };
  });
}

function summarizeSessions(sessions, agentsMap) {
  const now = Date.now();
  const activeThresholdMs = 30 * 60 * 1000;
  const staleThresholdMs = 6 * 60 * 60 * 1000;

  let activeSessions = 0;
  let staleSessions = 0;
  let abortedSessions = 0;
  let recent15m = 0;
  let recent60m = 0;
  let runningCount = 0;
  let queuedCount = 0;
  let failedCount = 0;

  const byAgent = new Map();

  for (const s of sessions) {
    const ageMs = Number(s.ageMs ?? (s.updatedAt ? now - s.updatedAt : Number.POSITIVE_INFINITY));

    if (ageMs <= activeThresholdMs && !s.abortedLastRun) activeSessions += 1;
    if (ageMs >= staleThresholdMs) staleSessions += 1;
    if (s.abortedLastRun) abortedSessions += 1;
    if (ageMs <= 15 * 60 * 1000) recent15m += 1;
    if (ageMs <= 60 * 60 * 1000) recent60m += 1;

    const statusCode = getSessionStatusCode(s);
    if (statusCode === 'running') runningCount += 1;
    if (statusCode === 'queued') queuedCount += 1;
    if (statusCode === 'failed') failedCount += 1;

    const aId = s.agentId || 'unknown';
    const current = byAgent.get(aId) || { agentId: aId, agentName: agentsMap.get(aId) || aId, sessions: 0 };
    current.sessions += 1;
    byAgent.set(aId, current);
  }

  const topAgents = Array.from(byAgent.values())
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);

  return {
    totals: {
      sessions: sessions.length,
      activeSessions,
      staleSessions,
      abortedSessions
    },
    kpis: {
      active: activeSessions,
      running: runningCount,
      queued: queuedCount,
      failed: failedCount
    },
    recentActivity: {
      updatedLast15m: recent15m,
      updatedLast60m: recent60m
    },
    topAgents
  };
}

async function detectGitVersion() {
  try {
    const [{ stdout: commit }, { stdout: branch }] = await Promise.all([
      execFileAsync('git', ['-C', TASKBRIDGE_ROOT, 'rev-parse', '--short', 'HEAD']),
      execFileAsync('git', ['-C', TASKBRIDGE_ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'])
    ]);

    bridgeVersion = {
      commit: commit.trim() || 'unknown',
      branch: branch.trim() || 'unknown'
    };
  } catch {
    bridgeVersion = { commit: 'unknown', branch: 'unknown' };
  }
}

app.use((req, res, next) => {
  metrics.requests += 1;

  req._startAt = Date.now();
  req._reqId = crypto.randomUUID().slice(0, 8);
  res.setHeader('X-Request-Id', req._reqId);

  const requestTimeoutMs = req.path.includes('/api/tasks/') && req.path.endsWith('/ping')
    ? Math.max(runtimeConfig.requestTimeoutMs, 60000)
    : runtimeConfig.requestTimeoutMs;

  const timer = setTimeout(() => {
    if (!res.headersSent && !res.writableEnded) {
      sendError(res, 504, 'Request timeout', `Exceeded ${requestTimeoutMs}ms`, 'REQUEST_TIMEOUT');
    }
  }, requestTimeoutMs);

  res.on('finish', () => {
    clearTimeout(timer);
    const dur = Date.now() - req._startAt;
    metrics.totalLatencyMs += dur;
    metrics.avgLatencyMs = Number((metrics.totalLatencyMs / Math.max(metrics.requests, 1)).toFixed(2));
    if (res.statusCode >= 400) metrics.errors += 1;

    console.log(`[${new Date().toISOString()}] ${req._reqId} ${req.method} ${req.originalUrl} ${res.statusCode} ${dur}ms`);
  });

  next();
});

app.get('/health', async (_req, res) => {
  try {
    const status = await runOpenClawJson(['status']);
    res.json({ ok: true, service: 'task-bridge', ts: new Date().toISOString(), status });
  } catch (e) {
    const stable = createStableError(e, 'HEALTH_CHECK_FAILED');
    return sendError(res, 503, 'Health check failed', stable.message, stable.code, { diagnostics: stable });
  }
});

function sendHealthz(res) {
  const p95LatencyMs = calcP95(health.latencySamplesMs);
  const computed = computeHealthState();

  res.status(computed.ok ? 200 : 503).json({
    ok: computed.ok,
    state: computed.state,
    service: 'task-bridge',
    now: nowIso(),
    openclawReachable: health.openclawReachable,
    stableReachable: computed.stableReachable,
    graceActive: computed.graceActive,
    healthGraceMs: runtimeConfig.healthGraceMs,
    sinceLastSuccessMs: computed.sinceLastSuccessMs,
    lastSuccessAt: health.lastSuccessAt,
    lastFailureAt: health.lastFailureAt,
    consecutiveFailures: health.consecutiveFailures,
    latencyP95Ms: p95LatencyMs,
    breakerOpen: computed.breakerOpen
  });
}

app.get('/healthz', (_req, res) => sendHealthz(res));
app.get('/api/healthz', (_req, res) => sendHealthz(res));

app.get('/api/version', (_req, res) => {
  res.json({
    service: 'task-bridge',
    commit: bridgeVersion.commit,
    branch: bridgeVersion.branch,
    pid: SERVER_PID,
    uptimeSec: Math.floor(process.uptime()),
    startedAt: new Date(STARTED_AT_MS).toISOString(),
    now: new Date().toISOString()
  });
});

app.get('/api/selfcheck', async (_req, res) => {
  const details = {
    version: bridgeVersion,
    pid: SERVER_PID,
    uptimeSec: Math.floor(process.uptime()),
    openclawBin: runtimeConfig.openclawBin,
    openclawStatus: null,
    openclawReachable: health.openclawReachable,
    lastSuccessAt: health.lastSuccessAt,
    consecutiveFailures: health.consecutiveFailures,
    latencyP95Ms: calcP95(health.latencySamplesMs),
    cacheAgeMs: {
      sessions: ageFromFetchedAt(cache.sessions.fetchedAt),
      agents: ageFromFetchedAt(cache.agents.fetchedAt)
    }
  };

  try {
    const status = await runOpenClawJson(['status']);
    details.openclawStatus = status;
    details.openclawReachable = true;
    return res.json({ ok: true, details });
  } catch (e) {
    const stable = createStableError(e, 'SELFCHECK_FAILED');
    return res.status(503).json({
      ok: false,
      details,
      error: stable.message,
      code: stable.code,
      diagnostics: stable
    });
  }
});

app.post('/api/reload-config', auth, (req, res) => {
  const before = {
    cliTimeoutMs: runtimeConfig.cliTimeoutMs,
    requestTimeoutMs: runtimeConfig.requestTimeoutMs,
    maxPingText: runtimeConfig.maxPingText,
    authEnabled: Boolean(runtimeConfig.authToken),
    cacheTtlMs: runtimeConfig.cacheTtlMs,
    openclawBin: runtimeConfig.openclawBin,
    cliRetryCount: runtimeConfig.cliRetryCount,
    breakerFailureThreshold: runtimeConfig.breakerFailureThreshold,
    breakerCooldownMs: runtimeConfig.breakerCooldownMs,
    healthGraceMs: runtimeConfig.healthGraceMs
  };

  loadRuntimeConfig();
  clearLookupCaches();

  const after = {
    cliTimeoutMs: runtimeConfig.cliTimeoutMs,
    requestTimeoutMs: runtimeConfig.requestTimeoutMs,
    maxPingText: runtimeConfig.maxPingText,
    authEnabled: Boolean(runtimeConfig.authToken),
    cacheTtlMs: runtimeConfig.cacheTtlMs,
    openclawBin: runtimeConfig.openclawBin,
    cliRetryCount: runtimeConfig.cliRetryCount,
    breakerFailureThreshold: runtimeConfig.breakerFailureThreshold,
    breakerCooldownMs: runtimeConfig.breakerCooldownMs,
    healthGraceMs: runtimeConfig.healthGraceMs
  };

  res.json({ ok: true, reloaded: true, before, after, clearedCaches: ['sessions', 'agents'] });
});

app.get('/api/tasks', auth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 1000);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  const q = String(req.query.q || '').trim().toLowerCase();
  const agentId = String(req.query.agentId || '').trim();
  const statusFilter = String(req.query.status || '').trim().toLowerCase();

  try {
    const [sessionsResult, agentsResult] = await Promise.all([getSessionsData(), getAgentsData()]);

    const sessions = sessionsResult.sessions;
    const agents = agentsResult.agents;
    const agentNameMap = new Map(agents.map((a) => [a.id, a.identityName || a.name || a.id]));

    const mapped = sessions
      .map((s) => {
        const resolvedAgentId = s.agentId || 'unknown';
        return {
          id: s.sessionId || s.key,
          key: s.key,
          agentId: resolvedAgentId,
          agentName: agentNameMap.get(resolvedAgentId) || resolvedAgentId,
          kind: s.kind || 'unknown',
          model: s.model || null,
          updatedAt: s.updatedAt || null,
          ageMs: s.ageMs ?? null,
          totalTokens: s.totalTokens ?? null,
          contextTokens: s.contextTokens ?? null,
          status: s.abortedLastRun ? 'aborted' : 'active'
        };
      })
      .filter((t) => {
        if (agentId && t.agentId !== agentId) return false;
        if (statusFilter && t.status.toLowerCase() !== statusFilter) return false;
        if (q) {
          const hay = `${t.id} ${t.key} ${t.agentId} ${t.agentName} ${t.kind} ${t.model || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const page = mapped.slice(offset, offset + limit);
    res.json({
      items: page,
      total: mapped.length,
      limit,
      offset,
      filters: { q, agentId, status: statusFilter || null },
      diagnostics: {
        cache: {
          sessions: sessionsResult.cache,
          sessionsAgeMs: sessionsResult.ageMs,
          agents: agentsResult.cache,
          agentsAgeMs: agentsResult.ageMs,
          ttlMs: runtimeConfig.cacheTtlMs,
          hits: metrics.cacheHits,
          misses: metrics.cacheMisses
        }
      }
    });
  } catch (e) {
    const stable = createStableError(e, 'TASKS_LIST_FAILED');
    return sendError(res, 500, 'Failed to read tasks', stable.message, stable.code, { diagnostics: stable });
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
    const stable = createStableError(e, 'HISTORY_LOAD_FAILED');
    return sendError(res, 500, 'Failed to load history', stable.message, stable.code, { diagnostics: stable });
  }
});

async function discoverAgentIdForSession(sessionId) {
  const sessionsResult = await getSessionsData();
  let match = sessionsResult.sessions.find((s) => s.sessionId === sessionId || s.key === sessionId);
  if (match?.agentId) return { agentId: String(match.agentId).trim(), source: 'cache' };

  clearLookupCaches();
  const refreshed = await getSessionsData();
  match = refreshed.sessions.find((s) => s.sessionId === sessionId || s.key === sessionId);
  return { agentId: String(match?.agentId || '').trim(), source: 'refreshed' };
}

app.post('/api/tasks/:id/ping', auth, async (req, res) => {
  const sessionId = String(req.params.id || '').trim();
  const text = sanitizePingText(req.body?.text);
  const requestedAgentId = String(req.body?.agentId || '').trim();

  if (!sessionId) return sendError(res, 400, 'Missing session id', 'Parameter :id is required', 'MISSING_SESSION_ID');
  if (!text) return sendError(res, 400, 'Invalid text', 'Body { text } is required', 'INVALID_TEXT');

  try {
    let discoveredAgentId = '';
    let discoveredAgentSource = null;
    if (!requestedAgentId) {
      try {
        const discovered = await discoverAgentIdForSession(sessionId);
        discoveredAgentId = discovered.agentId;
        discoveredAgentSource = discovered.source;
      } catch {
        // best effort only
      }
    }

    const candidateAgents = [requestedAgentId, discoveredAgentId, '']
      .filter((v, i, arr) => v || i === arr.length - 1)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    let lastErr = null;

    for (let i = 0; i < candidateAgents.length; i += 1) {
      const agentId = candidateAgents[i];
      const args = ['agent', '--session-id', sessionId, '--message', text, '--timeout', '45'];
      if (agentId) args.push('--agent', agentId);

      try {
        const result = await runOpenClawJson(args, Math.max(runtimeConfig.cliTimeoutMs, 50000), { retries: 1 });
        if (res.headersSent || res.writableEnded) return;
        return res.json({ ok: true, sessionId, sent: true, textLength: text.length, agentId: agentId || null, attempts: i + 1, triedAgentIds: candidateAgents.map((a) => a || null), discoveredAgentSource, result });
      } catch (e) {
        lastErr = e;
        if (i < candidateAgents.length - 1) await sleep(250);
      }
    }

    if (res.headersSent || res.writableEnded) return;
    const stable = createStableError(lastErr || new Error('Unknown ping error'), 'PING_FAILED');
    return sendError(res, 502, 'Failed to ping session', stable.message, stable.code, { diagnostics: stable });
  } catch (e) {
    if (res.headersSent || res.writableEnded) return;
    const stable = createStableError(e, 'PING_FAILED');
    return sendError(res, 502, 'Failed to ping session', stable.message, stable.code, { diagnostics: stable });
  }
});

app.get('/api/config', auth, (_req, res) => {
  res.json({
    host: runtimeConfig.host,
    port: runtimeConfig.port,
    authEnabled: Boolean(runtimeConfig.authToken),
    openclawBin: runtimeConfig.openclawBin,
    requestTimeoutMs: runtimeConfig.requestTimeoutMs,
    cliTimeoutMs: runtimeConfig.cliTimeoutMs,
    cacheTtlMs: runtimeConfig.cacheTtlMs,
    cliRetryCount: runtimeConfig.cliRetryCount,
    cliRetryBaseDelayMs: runtimeConfig.cliRetryBaseDelayMs,
    cliRetryMaxDelayMs: runtimeConfig.cliRetryMaxDelayMs,
    breakerFailureThreshold: runtimeConfig.breakerFailureThreshold,
    breakerCooldownMs: runtimeConfig.breakerCooldownMs,
    healthGraceMs: runtimeConfig.healthGraceMs
  });
});

app.get('/api/agents', auth, async (_req, res) => {
  try {
    const [agentsResult, sessionsResult] = await Promise.all([getAgentsData(), getSessionsData()]);
    const snapshotMap = new Map(buildAgentsSnapshot(agentsResult.agents, sessionsResult.sessions).map((i) => [i.id, i]));

    const items = agentsResult.agents.map((a) => {
      const snapshot = snapshotMap.get(a.id);
      return {
        id: a.id,
        name: a.identityName || a.name || a.id,
        emoji: a.identityEmoji || null,
        model: a.model || null,
        workspace: a.workspace || null,
        isDefault: Boolean(a.isDefault),
        status: snapshot?.status || 'inactive',
        currentTask: snapshot?.currentTask || null,
        heartbeat: snapshot?.heartbeat || { lastSeenAt: null, lastSeenRelative: 'unknown', stale: true }
      };
    });
    res.json({ items });
  } catch (e) {
    const stable = createStableError(e, 'AGENTS_LIST_FAILED');
    return sendError(res, 500, 'Failed to read agents', stable.message, stable.code, { diagnostics: stable });
  }
});

app.get('/api/dashboard/summary', auth, async (_req, res) => {
  try {
    const [sessionsResult, agentsResult] = await Promise.all([getSessionsData(), getAgentsData()]);
    const agentNameMap = new Map(agentsResult.agents.map((a) => [a.id, a.identityName || a.name || a.id]));

    const summary = summarizeSessions(sessionsResult.sessions, agentNameMap);
    const activityFeed = buildActivityFeed(sessionsResult.sessions, agentNameMap, 12);
    const agentsSnapshot = buildAgentsSnapshot(agentsResult.agents, sessionsResult.sessions).slice(0, 8);
    const healthPanel = buildSystemHealthPayload();

    res.json({
      contractVersion: 'dashboard.v2',
      ...summary,
      activityFeed,
      agentsSnapshot,
      healthPanel,
      diagnostics: {
        cacheAgeMs: {
          sessions: sessionsResult.ageMs,
          agents: agentsResult.ageMs
        },
        openclawReachable: health.openclawReachable,
        lastSuccessAt: health.lastSuccessAt,
        consecutiveFailures: health.consecutiveFailures
      }
    });
  } catch (e) {
    const stable = createStableError(e, 'DASHBOARD_SUMMARY_FAILED');
    return sendError(res, 500, 'Failed to build dashboard summary', stable.message, stable.code, { diagnostics: stable });
  }
});

app.get('/api/dashboard/sessions', auth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  const offset = Math.max(Number(req.query.offset || 0), 0);

  try {
    const [sessionsResult, agentsResult] = await Promise.all([getSessionsData(), getAgentsData()]);
    const agentNameMap = new Map(agentsResult.agents.map((a) => [a.id, a.identityName || a.name || a.id]));

    const mapped = sessionsResult.sessions
      .map((s) => {
        const updatedMs = Number(s.updatedAt || Date.now() - (s.ageMs || 0));
        const agentId = s.agentId || 'unknown';

        const status = getSessionStatusCode(s);
        return {
          id: s.sessionId || s.key,
          key: s.key,
          agentId,
          agentName: agentNameMap.get(agentId) || agentId,
          kind: s.kind || 'unknown',
          model: s.model || null,
          status,
          statusLabel: getSessionStatusLabelFromCode(status) || mapSessionStatus(s),
          currentTask: deriveCurrentTask(s),
          heartbeat: {
            lastSeenAt: Number.isFinite(updatedMs) ? new Date(updatedMs).toISOString() : null,
            lastSeenRelative: toRelativeTime(updatedMs),
            stale: Number(s.ageMs || 0) > 6 * 60 * 60 * 1000
          },
          lastSeenAt: Number.isFinite(updatedMs) ? new Date(updatedMs).toISOString() : null,
          lastSeenRelative: toRelativeTime(updatedMs),
          ageMs: s.ageMs ?? null,
          totalTokens: s.totalTokens ?? null,
          contextTokens: s.contextTokens ?? null,
          riskFlags: getRiskFlags(s)
        };
      })
      .sort((a, b) => {
        const aTime = Date.parse(a.lastSeenAt || 0) || 0;
        const bTime = Date.parse(b.lastSeenAt || 0) || 0;
        return bTime - aTime;
      });

    const items = mapped.slice(offset, offset + limit);
    res.json({
      items,
      total: mapped.length,
      limit,
      offset,
      diagnostics: {
        cacheAgeMs: {
          sessions: sessionsResult.ageMs,
          agents: agentsResult.ageMs
        }
      }
    });
  } catch (e) {
    const stable = createStableError(e, 'DASHBOARD_SESSIONS_FAILED');
    return sendError(res, 500, 'Failed to build dashboard sessions', stable.message, stable.code, { diagnostics: stable });
  }
});

app.get('/api/dashboard/activity', auth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 200);

  try {
    const [sessionsResult, agentsResult] = await Promise.all([getSessionsData(), getAgentsData()]);
    const agentNameMap = new Map(agentsResult.agents.map((a) => [a.id, a.identityName || a.name || a.id]));
    const items = buildActivityFeed(sessionsResult.sessions, agentNameMap, limit);

    return res.json({
      contractVersion: 'dashboard.activity.v1',
      items,
      total: items.length,
      limit,
      diagnostics: {
        cacheAgeMs: {
          sessions: sessionsResult.ageMs,
          agents: agentsResult.ageMs
        }
      }
    });
  } catch (e) {
    const stable = createStableError(e, 'DASHBOARD_ACTIVITY_FAILED');
    return sendError(res, 500, 'Failed to build dashboard activity', stable.message, stable.code, { diagnostics: stable });
  }
});

app.get('/api/dashboard/agents', auth, async (_req, res) => {
  try {
    const [sessionsResult, agentsResult] = await Promise.all([getSessionsData(), getAgentsData()]);
    const items = buildAgentsSnapshot(agentsResult.agents, sessionsResult.sessions);
    return res.json({
      contractVersion: 'dashboard.agents.v1',
      items,
      total: items.length
    });
  } catch (e) {
    const stable = createStableError(e, 'DASHBOARD_AGENTS_FAILED');
    return sendError(res, 500, 'Failed to build dashboard agents', stable.message, stable.code, { diagnostics: stable });
  }
});

app.get('/api/agents/:id', auth, async (req, res) => {
  const agentId = String(req.params.id || '').trim();
  if (!agentId) return sendError(res, 400, 'Missing agent id', 'Parameter :id is required', 'MISSING_AGENT_ID');

  try {
    const [sessionsResult, agentsResult] = await Promise.all([getSessionsData(), getAgentsData()]);
    const agent = agentsResult.agents.find((a) => a.id === agentId);
    if (!agent) return sendError(res, 404, 'Agent not found', `No agent with id '${agentId}'`, 'AGENT_NOT_FOUND');

    const agentSessions = sessionsResult.sessions
      .filter((s) => (s.agentId || 'unknown') === agentId)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

    const current = agentSessions[0] || null;
    const status = current ? getSessionStatusCode(current) : 'inactive';
    const recentTasks = agentSessions.slice(0, 8).map((s) => ({
      sessionId: s.sessionId || s.key || null,
      key: s.key || null,
      status: getSessionStatusCode(s),
      kind: s.kind || 'unknown',
      model: s.model || null,
      updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
      lastSeenRelative: toRelativeTime(Number(s.updatedAt || Date.now() - (s.ageMs || 0))),
      tokens: {
        total: s.totalTokens ?? null,
        context: s.contextTokens ?? null
      }
    }));

    const recentLogs = recentTasks.map((task) => ({
      timestamp: task.updatedAt,
      level: task.status === 'failed' ? 'error' : 'info',
      message: task.status === 'failed'
        ? `Task ${task.sessionId || task.key || 'unknown'} ended with failure state`
        : `Task ${task.sessionId || task.key || 'unknown'} updated (${task.kind})`
    }));

    return res.json({
      contractVersion: 'agent.detail.v1',
      id: agent.id,
      name: agent.identityName || agent.name || agent.id,
      emoji: agent.identityEmoji || null,
      model: agent.model || null,
      workspace: agent.workspace || null,
      isDefault: Boolean(agent.isDefault),
      status,
      currentTask: current ? deriveCurrentTask(current) : null,
      heartbeat: {
        lastSeenAt: current?.updatedAt ? new Date(current.updatedAt).toISOString() : null,
        lastSeenRelative: current ? toRelativeTime(Number(current.updatedAt || Date.now() - (current.ageMs || 0))) : 'unknown',
        stale: current ? Number(current.ageMs || 0) > 6 * 60 * 60 * 1000 : true
      },
      recentTasks,
      recentLogs,
      sessionsCount: agentSessions.length
    });
  } catch (e) {
    const stable = createStableError(e, 'AGENT_DETAIL_FAILED');
    return sendError(res, 500, 'Failed to read agent details', stable.message, stable.code, { diagnostics: stable });
  }
});

app.get('/api/dashboard/health', auth, (_req, res) => {
  res.json({
    contractVersion: 'dashboard.health.v1',
    ...buildSystemHealthPayload(),
    cacheAgeMs: {
      sessions: ageFromFetchedAt(cache.sessions.fetchedAt),
      agents: ageFromFetchedAt(cache.agents.fetchedAt)
    },
    version: {
      commit: bridgeVersion.commit,
      branch: bridgeVersion.branch
    }
  });
});

app.get('/api/metrics', auth, (_req, res) => {
  res.json({
    requests: metrics.requests,
    errors: metrics.errors,
    avgLatencyMs: metrics.avgLatencyMs,
    cacheHits: metrics.cacheHits,
    cacheMisses: metrics.cacheMisses,
    uptimeSec: Math.floor(process.uptime()),
    openclawReachable: health.openclawReachable,
    lastSuccessAt: health.lastSuccessAt,
    consecutiveFailures: health.consecutiveFailures,
    latencyP95Ms: calcP95(health.latencySamplesMs),
    cacheAgeMs: {
      sessions: ageFromFetchedAt(cache.sessions.fetchedAt),
      agents: ageFromFetchedAt(cache.agents.fetchedAt)
    },
    circuitBreakers: {
      sessions: {
        state: breakers.sessions.state,
        failures: breakers.sessions.failures,
        cooldownUntil: breakers.sessions.cooldownUntil ? new Date(breakers.sessions.cooldownUntil).toISOString() : null
      },
      agents: {
        state: breakers.agents.state,
        failures: breakers.agents.failures,
        cooldownUntil: breakers.agents.cooldownUntil ? new Date(breakers.agents.cooldownUntil).toISOString() : null
      }
    },
    cli: {
      calls: metrics.cliCalls,
      retries: metrics.cliRetries,
      failures: metrics.cliFailures
    }
  });
});

app.use((_req, res) => sendError(res, 404, 'Not found', 'Route does not exist', 'NOT_FOUND'));

loadRuntimeConfig();
await detectGitVersion();

app.listen(runtimeConfig.port, runtimeConfig.host, () => {
  console.log(`task-bridge listening at http://${runtimeConfig.host}:${runtimeConfig.port}`);
  console.log(`OPENCLAW_BIN=${runtimeConfig.openclawBin}`);
  console.log(`version=${bridgeVersion.commit} (${bridgeVersion.branch}) pid=${SERVER_PID}`);
});
