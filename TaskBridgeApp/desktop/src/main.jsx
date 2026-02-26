import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const DEFAULT_API = (import.meta.env.VITE_API_BASE || 'http://172.28.202.129:8787').trim();
const POLL_OK_MS = 5000;
const POLL_RETRY_MS = 7000;
const ATTENTION_STALE_MIN = 25;

const tone = {
  bg: '#f1f5f9',
  card: '#ffffff',
  border: '#dbe3ee',
  text: '#0f172a',
  muted: '#475569',
  ok: '#166534',
  okBg: '#dcfce7',
  warn: '#92400e',
  warnBg: '#fef3c7',
  bad: '#991b1b',
  badBg: '#fee2e2',
  info: '#1d4ed8',
  infoBg: '#dbeafe'
};

function App() {
  const [apiBase, setApiBase] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);
  const [apiDraft, setApiDraft] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);
  const [authToken, setAuthToken] = useState(localStorage.getItem('taskBridgeToken') || '');
  const [tokenDraft, setTokenDraft] = useState(localStorage.getItem('taskBridgeToken') || '');
  const [bridgeManaged, setBridgeManaged] = useState(false);

  const [health, setHealth] = useState({ state: 'loading', text: 'Checking connection…' });
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  const [diagConfig, setDiagConfig] = useState(null);
  const [diagLatencyMs, setDiagLatencyMs] = useState(null);
  const [diagState, setDiagState] = useState({ loading: true, error: '', refreshedAt: null });
  const [metrics, setMetrics] = useState(null);

  const [backendVersion, setBackendVersion] = useState(null);
  const [backendSelfcheck, setBackendSelfcheck] = useState(null);
  const [backendState, setBackendState] = useState({ loading: true, error: '', refreshedAt: null });

  const [lastSuccessSync, setLastSuccessSync] = useState(null);
  const [lastAttemptSync, setLastAttemptSync] = useState(null);
  const [connectionErrors, setConnectionErrors] = useState([]);
  const [retryTick, setRetryTick] = useState(0);

  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyState, setHistoryState] = useState({ loading: false, error: '' });

  const [taskActionState, setTaskActionState] = useState({ pinging: false, message: '', error: '' });
  const [toasts, setToasts] = useState([]);

  const headers = useMemo(() => {
    const h = {};
    if (authToken.trim()) h.Authorization = `Bearer ${authToken.trim()}`;
    return h;
  }, [authToken]);

  const pushToast = (kind, text) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((old) => [...old, { id, kind, text }]);
    window.setTimeout(() => setToasts((old) => old.filter((t) => t.id !== id)), 3800);
  };

  const humanError = (error) => {
    const raw = String(error || 'Unknown error');
    const msg = raw.toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('networkerror')) return 'Cannot reach the bridge service. Check if TaskBridge is running and the API URL is correct.';
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('forbidden')) return 'Access denied. Verify your token in Connection settings.';
    if (msg.includes('404')) return 'Requested data was not found. The selected session may have ended.';
    return `We could not complete that action. Details: ${raw}`;
  };

  const recordConnectionIssue = (err) => {
    const entry = { at: new Date(), text: humanError(err) };
    setConnectionErrors((old) => [entry, ...old].slice(0, 5));
  };

  const fetchMaybeJson = async (url, init = {}) => {
    const r = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await r.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!r.ok) {
      const details = body?.error || body?.details || body || `${r.status} ${r.statusText}`;
      throw new Error(String(details));
    }
    return body;
  };

  const fetchJson = async (url, init = {}) => {
    const data = await fetchMaybeJson(url, init);
    if (data == null || typeof data !== 'object') throw new Error('Expected JSON response');
    return data;
  };

  const refreshDiagnostics = async (base = apiBase) => {
    setDiagState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const t0 = performance.now();
      const [config, metricsData] = await Promise.all([
        fetchJson(`${base}/api/config`),
        fetchJson(`${base}/api/metrics`)
      ]);
      const latency = Math.round(performance.now() - t0);
      setDiagConfig(config);
      setMetrics(metricsData);
      setDiagLatencyMs(latency);
      setDiagState({ loading: false, error: '', refreshedAt: new Date() });
    } catch (e) {
      const plain = humanError(e.message || e);
      setDiagState({ loading: false, error: plain, refreshedAt: new Date() });
      recordConnectionIssue(e.message || e);
    }
  };

  const refreshBackendStatus = async (base = apiBase) => {
    setBackendState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [version, selfcheck] = await Promise.all([
        fetchMaybeJson(`${base}/api/version`),
        fetchMaybeJson(`${base}/api/selfcheck`)
      ]);
      setBackendVersion(version);
      setBackendSelfcheck(selfcheck);
      setBackendState({ loading: false, error: '', refreshedAt: new Date() });
    } catch (e) {
      const plain = humanError(e.message || e);
      setBackendState({ loading: false, error: plain, refreshedAt: new Date() });
      recordConnectionIssue(e.message || e);
    }
  };

  const refreshAll = async (base = apiBase) => {
    setLastAttemptSync(new Date());
    try {
      const h = await fetchJson(`${base}/health`);
      setHealth({ state: h.ok ? 'ok' : 'degraded', text: h.ok ? 'Bridge is reachable' : 'Bridge reports degraded health' });
    } catch (e) {
      setHealth({ state: 'down', text: 'Bridge is offline or unreachable' });
      recordConnectionIssue(e.message || e);
      return false;
    }

    try {
      const params = new URLSearchParams({ limit: '500', offset: '0' });
      const [tasksData, agentsData] = await Promise.all([
        fetchJson(`${base}/api/tasks?${params.toString()}`),
        fetchJson(`${base}/api/agents`)
      ]);
      setTasks(tasksData.items || []);
      setAgents(agentsData.items || []);
      setLastSuccessSync(new Date());
      return true;
    } catch (e) {
      setHealth({ state: 'degraded', text: 'Connected, but task details could not be refreshed' });
      recordConnectionIssue(e.message || e);
      return false;
    }
  };

  const optimisticRefresh = async (base = apiBase) => {
    const result = await Promise.allSettled([refreshAll(base), refreshDiagnostics(base), refreshBackendStatus(base)]);
    const hasFailure = result.some((r) => r.status === 'rejected');
    if (hasFailure) pushToast('error', 'Refresh completed with issues. See System health for details.');
    else pushToast('success', 'Dashboard refreshed.');
  };

  const refreshSelectedHistory = async (task = selectedTask) => {
    if (!task?.id) return;
    setHistoryState({ loading: true, error: '' });
    setHistory([]);
    try {
      const data = await fetchJson(`${apiBase}/api/tasks/${encodeURIComponent(task.id)}/history?limit=25`);
      setHistory(data.items || []);
      setHistoryState({ loading: false, error: '' });
    } catch (e) {
      setHistoryState({ loading: false, error: humanError(e.message || e) });
      setHistory([]);
    }
  };

  const openHistory = async (task) => {
    setSelectedTask(task);
    setHistoryOpen(true);
    await refreshSelectedHistory(task);
  };

  const pingSelected = async () => {
    if (!selectedTask?.id) return;
    setTaskActionState({ pinging: true, message: '', error: '' });
    try {
      const data = await fetchJson(`${apiBase}/api/tasks/${encodeURIComponent(selectedTask.id)}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'dashboard ping', agentId: selectedTask.agentId || undefined })
      });
      setTaskActionState({ pinging: false, message: data.message || 'Ping sent.', error: '' });
      pushToast('success', 'Ping sent successfully');
    } catch (e) {
      setTaskActionState({ pinging: false, message: '', error: humanError(e.message || e) });
    }
  };

  const runSelfCheck = async () => {
    await refreshBackendStatus(apiBase);
    if (backendSelfcheck?.ok) pushToast('success', 'Self-check passed.');
    else pushToast('error', 'Self-check completed. Review System health.');
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard?.writeText(text || '');
      setTaskActionState((s) => ({ ...s, message: `${label} copied`, error: '' }));
      pushToast('success', `${label} copied`);
    } catch {
      setTaskActionState((s) => ({ ...s, error: `Could not copy ${label.toLowerCase()}. Try again.` }));
    }
  };

  const copySupportBundleSummary = async () => {
    const summary = [
      `TaskBridge support summary`,
      `API: ${apiBase}`,
      `Connection: ${connectionModel.label}`,
      `Last successful sync: ${formatTs(lastSuccessSync)}`,
      `Tasks loaded: ${tasks.length}`,
      `Agents loaded: ${agents.length}`,
      `Backend version: ${backendVersion?.version || backendVersion?.tag || '-'}`,
      `Self-check ok: ${backendSelfcheck?.ok == null ? '-' : String(backendSelfcheck.ok)}`,
      `Recent issue: ${connectionErrors[0]?.text || 'none'}`
    ].join('\n');
    await copyText(summary, 'Support bundle summary');
  };

  useEffect(() => {
    let off = null;
    (async () => {
      if (window.bridgeCtl?.getUrl) {
        try {
          const detected = await window.bridgeCtl.getUrl();
          if (detected) {
            setBridgeManaged(true);
            setApiBase(detected);
            setApiDraft(detected);
            localStorage.setItem('taskBridgeApi', detected);
          }
          if (window.bridgeCtl.onStatus) {
            off = window.bridgeCtl.onStatus((payload) => {
              if (payload?.url) {
                setApiBase(payload.url);
                setApiDraft(payload.url);
                localStorage.setItem('taskBridgeApi', payload.url);
              }
            });
          }
        } catch {
          // ignore bridgeCtl probe errors
        }
      }
    })();
    return () => {
      if (typeof off === 'function') off();
    };
  }, []);

  useEffect(() => {
    optimisticRefresh(apiBase);
  }, [apiBase, authToken]);

  useEffect(() => {
    const intervalMs = health.state === 'down' ? POLL_RETRY_MS : POLL_OK_MS;
    const t = setInterval(async () => {
      setRetryTick((n) => n + 1);
      await optimisticRefresh(apiBase);
    }, intervalMs);
    return () => clearInterval(t);
  }, [apiBase, authToken, health.state]);

  const mismatchFlag = useMemo(() => {
    const versionInstance = backendVersion?.instanceId || backendVersion?.instance || backendVersion?.id || null;
    const selfcheckInstance = backendSelfcheck?.instanceId || backendSelfcheck?.instance || backendSelfcheck?.id || null;
    if (!versionInstance || !selfcheckInstance) return false;
    return String(versionInstance) !== String(selfcheckInstance);
  }, [backendVersion, backendSelfcheck]);

  const connectionModel = useMemo(() => {
    if (health.state === 'down') {
      return {
        key: 'offline',
        label: 'Offline',
        detail: 'Trying again automatically every 7 seconds.',
        chipBg: tone.badBg,
        chipFg: tone.bad
      };
    }

    const hasDiagIssue = Boolean(diagState.error || backendState.error || mismatchFlag);
    if (hasDiagIssue) {
      return {
        key: 'degraded',
        label: 'Degraded',
        detail: 'Connected, but some checks are failing. See System health.',
        chipBg: tone.warnBg,
        chipFg: tone.warn
      };
    }

    const reconnecting = health.state === 'loading' || (!lastSuccessSync && lastAttemptSync);
    if (reconnecting) {
      return {
        key: 'reconnecting',
        label: 'Reconnecting',
        detail: 'Attempting to restore healthy sync.',
        chipBg: tone.infoBg,
        chipFg: tone.info
      };
    }

    return {
      key: 'connected',
      label: 'Connected',
      detail: 'Everything looks healthy.',
      chipBg: tone.okBg,
      chipFg: tone.ok
    };
  }, [health.state, diagState.error, backendState.error, mismatchFlag, lastAttemptSync, lastSuccessSync]);

  const derived = useMemo(() => {
    const now = Date.now();
    const active = tasks.filter((t) => (t.status || '').toLowerCase() === 'active');
    const aborted = tasks.filter((t) => (t.status || '').toLowerCase() === 'aborted');
    const stale = active.filter((t) => {
      const ms = t.ageMs ?? (t.updatedAt ? now - new Date(t.updatedAt).getTime() : 0);
      return ms > ATTENTION_STALE_MIN * 60 * 1000;
    });
    const quiet = tasks.filter((t) => {
      const updated = new Date(t.updatedAt || 0).getTime();
      return Number.isFinite(updated) && now - updated > 2 * 60 * 60 * 1000;
    }).slice(0, 8);
    return { active, aborted, stale, quiet };
  }, [tasks, retryTick]);

  const applyConnection = () => {
    localStorage.setItem('taskBridgeApi', apiDraft.trim());
    localStorage.setItem('taskBridgeToken', tokenDraft.trim());
    setApiBase(apiDraft.trim());
    setAuthToken(tokenDraft.trim());
    pushToast('success', 'Connection settings saved');
  };

  const restartCmdUnix = "pkill -f 'TaskBridgeApp/bridge/src/server.js' || true; HOST=0.0.0.0 nohup node /home/hugog/.openclaw/workspace/TaskBridgeApp/bridge/src/server.js >/tmp/task-bridge.log 2>&1 &";
  const restartCmdWindows = 'wsl.exe -d Ubuntu -- bash -lc "pkill -f \\\"TaskBridgeApp/bridge/src/server.js\\\" || true; HOST=0.0.0.0 nohup node /home/hugog/.openclaw/workspace/TaskBridgeApp/bridge/src/server.js >/tmp/task-bridge.log 2>&1 &"';

  return (
    <main style={{ fontFamily: 'Inter, Segoe UI, sans-serif', background: tone.bg, minHeight: '100vh', padding: 16, color: tone.text }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, paddingBottom: 10, background: tone.bg }}>
        <h1 style={{ margin: '0 0 6px 0' }}>TaskBridge dashboard</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Chip text={connectionModel.label} bg={connectionModel.chipBg} fg={connectionModel.chipFg} />
          <span style={{ color: tone.muted, fontSize: 13 }}>{connectionModel.detail}</span>
          <span style={{ color: tone.muted, fontSize: 13 }}>Last successful sync: {formatTs(lastSuccessSync)}</span>
        </div>
      </header>

      <section style={{ marginTop: 10, marginBottom: 14, padding: 12, border: `1px solid ${tone.border}`, borderRadius: 12, background: tone.card }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={apiDraft} onChange={(e) => setApiDraft(e.target.value)} placeholder="API base URL" style={inputStyle(330)} />
          <input value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder="Bearer token (optional)" style={inputStyle(260)} />
          <button onClick={applyConnection}>Save connection</button>
          <button onClick={() => optimisticRefresh(apiBase)}>Refresh health</button>
          <button onClick={runSelfCheck}>Run self-check</button>
          <button onClick={copySupportBundleSummary}>Copy support bundle summary</button>
          {bridgeManaged ? (
            <button
              onClick={async () => {
                if (!window.bridgeCtl?.restart) return;
                try {
                  const info = await window.bridgeCtl.restart();
                  if (info?.url) {
                    setApiBase(info.url);
                    setApiDraft(info.url);
                  }
                  await optimisticRefresh(info?.url || apiBase);
                  pushToast('success', 'Bridge restart requested');
                } catch (e) {
                  pushToast('error', humanError(e.message || e));
                }
              }}
            >
              Restart bridge
            </button>
          ) : null}
          <button onClick={() => copyText(restartCmdUnix, 'Linux/macOS restart command')}>Copy restart cmd (Linux)</button>
          <button onClick={() => copyText(restartCmdWindows, 'Windows restart command')}>Copy restart cmd (Windows)</button>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 14 }}>
        <SummaryCard title="What needs attention now" value={`${derived.aborted.length + derived.stale.length}`} subtitle={`${derived.aborted.length} aborted · ${derived.stale.length} stale active`} toneName={derived.aborted.length + derived.stale.length > 0 ? 'warn' : 'ok'} />
        <SummaryCard title="Active work" value={String(derived.active.length)} subtitle={`${agents.length} agents available`} toneName="info" />
        <SummaryCard title="Recently quiet" value={String(derived.quiet.length)} subtitle="No updates in the last 2 hours" toneName="muted" />
        <SummaryCard title="System health" value={connectionModel.label} subtitle={backendSelfcheck?.ok ? 'Self-check passing' : 'Review diagnostics'} toneName={connectionModel.key === 'connected' ? 'ok' : connectionModel.key === 'offline' ? 'bad' : 'warn'} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, alignItems: 'start' }}>
        <Panel title="Active work">
          {derived.active.length === 0 ? (
            <EmptyState title="No active work right now" text="You're all clear. New active sessions will appear here automatically." />
          ) : (
            <TaskList tasks={derived.active.slice(0, 12)} onSelect={(t) => setSelectedTask(t)} onHistory={openHistory} selectedId={selectedTask?.id} />
          )}
        </Panel>

        <Panel title="What needs attention now">
          {derived.aborted.length + derived.stale.length === 0 ? (
            <EmptyState title="Nothing urgent" text="No aborted or stale active sessions detected." />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {derived.aborted.slice(0, 6).map((t) => (
                <IssueRow key={t.id} kind="Aborted" text={`${t.id} (${t.agentId || 'unknown agent'})`} />
              ))}
              {derived.stale.slice(0, 6).map((t) => (
                <IssueRow key={t.id} kind="Stale" text={`${t.id} has been active for > ${ATTENTION_STALE_MIN} min`} />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel title="Recently quiet">
          {derived.quiet.length === 0 ? (
            <EmptyState title="No quiet sessions" text="Everything has seen recent activity." />
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {derived.quiet.map((t) => (
                <div key={t.id} style={{ border: `1px solid ${tone.border}`, borderRadius: 8, padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{t.id}</div>
                  <div style={{ color: tone.muted, fontSize: 12 }}>Last update: {formatTs(t.updatedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="System health">
          <div style={{ display: 'grid', gap: 8 }}>
            <HealthRow label="Backend version" value={backendVersion?.version || backendVersion?.tag || '-'} />
            <HealthRow label="Self-check" value={backendSelfcheck?.ok == null ? '-' : backendSelfcheck.ok ? 'Passing' : 'Needs review'} />
            <HealthRow label="Latency" value={`${diagLatencyMs ?? '-'} ms`} />
            <HealthRow label="Requests / Errors" value={`${metrics?.requests ?? '-'} / ${metrics?.errors ?? '-'}`} />
            {mismatchFlag ? <IssueRow kind="Warning" text="Version and self-check instance IDs do not match." /> : null}
            {diagState.error ? <IssueRow kind="Diagnostics" text={diagState.error} /> : null}
            {backendState.error ? <IssueRow kind="Backend" text={backendState.error} /> : null}
            {connectionErrors.length > 0 ? (
              <div style={{ fontSize: 12, color: tone.muted }}>
                Last issue: {connectionErrors[0].text} ({formatTs(connectionErrors[0].at)})
              </div>
            ) : null}
          </div>
        </Panel>
      </section>

      {selectedTask ? (
        <section style={{ marginTop: 12 }}>
          <Panel title="Selected session actions">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: tone.muted }}>Session: <b>{selectedTask.id}</b></div>
              <button disabled={taskActionState.pinging} onClick={pingSelected}>{taskActionState.pinging ? 'Sending ping…' : 'Ping session'}</button>
              <button onClick={() => openHistory(selectedTask)}>View history</button>
              <button onClick={() => copyText(selectedTask.id || '', 'Session ID')}>Copy session id</button>
              <button onClick={() => copyText(selectedTask.key || '', 'Session key')}>Copy session key</button>
            </div>
            {taskActionState.message ? <div style={{ marginTop: 8, color: tone.ok, fontSize: 13 }}>{taskActionState.message}</div> : null}
            {taskActionState.error ? <div style={{ marginTop: 8, color: tone.bad, fontSize: 13 }}>{taskActionState.error}</div> : null}
          </Panel>
        </section>
      ) : null}

      {historyOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 'min(960px, 92vw)', maxHeight: '82vh', background: 'white', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 1, background: '#fff', borderBottom: `1px solid ${tone.border}`, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Session history</h3>
                <div style={{ fontSize: 12, color: tone.muted }}>{selectedTask?.id}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => refreshSelectedHistory(selectedTask)}>Refresh</button>
                <button onClick={() => setHistoryOpen(false)}>Close</button>
              </div>
            </div>

            <div style={{ overflow: 'auto', padding: 12, maxHeight: '70vh' }}>
              {historyState.loading ? <p style={{ color: tone.muted }}>Loading history…</p> : null}
              {!historyState.loading && historyState.error ? <p style={{ color: tone.bad }}>{historyState.error}</p> : null}
              {!historyState.loading && !historyState.error && history.length === 0 ? <p>No history available yet.</p> : null}

              {!historyState.loading && !historyState.error && history.map((m, i) => (
                <div key={i} style={{ borderTop: '1px solid #f0f0f0', padding: '10px 0' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <Chip text={(m.role || 'unknown').toUpperCase()} bg="#e2e8f0" fg="#0f172a" />
                    <span style={{ fontSize: 12, color: tone.muted }}>{formatTs(m.ts)}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text || ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', right: 12, bottom: 12, display: 'grid', gap: 8, zIndex: 60 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ minWidth: 260, maxWidth: 420, padding: '8px 10px', borderRadius: 8, color: '#fff', background: t.kind === 'error' ? '#b91c1c' : '#15803d', boxShadow: '0 6px 20px rgba(0,0,0,.15)' }}>
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}

function inputStyle(minWidth) {
  return { minWidth, padding: 8, borderRadius: 8, border: `1px solid ${tone.border}` };
}

function Panel({ title, children }) {
  return (
    <div style={{ background: tone.card, border: `1px solid ${tone.border}`, borderRadius: 12, padding: 12 }}>
      <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

function SummaryCard({ title, value, subtitle, toneName }) {
  const map = {
    ok: { bg: tone.okBg, fg: tone.ok },
    info: { bg: tone.infoBg, fg: tone.info },
    warn: { bg: tone.warnBg, fg: tone.warn },
    bad: { bg: tone.badBg, fg: tone.bad },
    muted: { bg: '#e2e8f0', fg: '#334155' }
  };
  const c = map[toneName] || map.muted;
  return (
    <div style={{ border: `1px solid ${tone.border}`, background: tone.card, borderRadius: 12, padding: 12 }}>
      <div style={{ color: tone.muted, fontSize: 12 }}>{title}</div>
      <div style={{ marginTop: 6, marginBottom: 6, fontSize: 26, fontWeight: 700 }}>{value}</div>
      <Chip text={subtitle} bg={c.bg} fg={c.fg} />
    </div>
  );
}

function Chip({ text, bg, fg }) {
  return <span style={{ background: bg, color: fg, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{text}</span>;
}

function EmptyState({ title, text }) {
  return (
    <div style={{ border: `1px dashed ${tone.border}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ color: tone.muted, fontSize: 13 }}>{text}</div>
    </div>
  );
}

function TaskList({ tasks, onSelect, onHistory, selectedId }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {tasks.map((t) => {
        const isSelected = selectedId === t.id;
        return (
          <div key={t.id} style={{ border: `1px solid ${isSelected ? '#93c5fd' : tone.border}`, background: isSelected ? '#eff6ff' : '#fff', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{t.id}</div>
                <div style={{ fontSize: 12, color: tone.muted }}>{t.agentId || 'unknown agent'} · {t.kind || 'task'} · updated {formatTs(t.updatedAt)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onSelect(t)}>Select</button>
                <button onClick={() => onHistory(t)}>History</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IssueRow({ kind, text }) {
  return (
    <div style={{ border: `1px solid ${tone.border}`, borderRadius: 8, padding: 8, background: '#fff' }}>
      <div style={{ fontSize: 12, color: tone.warn, fontWeight: 700 }}>{kind}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}

function HealthRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, borderBottom: `1px dashed ${tone.border}`, paddingBottom: 5 }}>
      <span style={{ color: tone.muted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function formatTs(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

createRoot(document.getElementById('root')).render(<App />);
