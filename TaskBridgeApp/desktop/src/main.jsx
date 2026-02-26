import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const DEFAULT_API = (import.meta.env.VITE_API_BASE || 'http://172.28.202.129:8787').trim();
const PAGE_SIZE = 20;

const statusColor = {
  active: '#2563eb',
  aborted: '#dc2626',
  unknown: '#6b7280'
};

const roleChip = {
  user: { bg: '#dbeafe', fg: '#1e3a8a' },
  assistant: { bg: '#dcfce7', fg: '#14532d' },
  system: { bg: '#ede9fe', fg: '#4c1d95' },
  tool: { bg: '#ffe4e6', fg: '#881337' },
  unknown: { bg: '#e5e7eb', fg: '#374151' }
};

function App() {
  const [apiBase, setApiBase] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);
  const [apiDraft, setApiDraft] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);
  const [authToken, setAuthToken] = useState(localStorage.getItem('taskBridgeToken') || '');
  const [tokenDraft, setTokenDraft] = useState(localStorage.getItem('taskBridgeToken') || '');
  const [bridgeManaged, setBridgeManaged] = useState(false);

  const [health, setHealth] = useState({ state: 'loading', text: 'Connecting…' });
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');

  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyState, setHistoryState] = useState({ loading: false, error: '' });

  const [taskActionState, setTaskActionState] = useState({ pinging: false, message: '', error: '' });

  const [diagConfig, setDiagConfig] = useState(null);
  const [diagLatencyMs, setDiagLatencyMs] = useState(null);
  const [diagState, setDiagState] = useState({ loading: true, error: '', refreshedAt: null });
  const [metrics, setMetrics] = useState(null);

  const [backendVersion, setBackendVersion] = useState(null);
  const [backendSelfcheck, setBackendSelfcheck] = useState(null);
  const [backendState, setBackendState] = useState({ loading: true, error: '', refreshedAt: null });

  const [toasts, setToasts] = useState([]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

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

  const optimisticRefresh = async (base = apiBase) => {
    setLastUpdated(new Date());
    setHealth((h) => ({ ...h, text: 'Refreshing…' }));
    await Promise.allSettled([refreshAll(base), refreshDiagnostics(base)]);
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
      setDiagState({ loading: false, error: e.message || 'Failed to load diagnostics', refreshedAt: new Date() });
      pushToast('error', `Diagnostics refresh failed: ${e.message || 'unknown error'}`);
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
      setBackendState({ loading: false, error: e.message || 'Failed to probe backend', refreshedAt: new Date() });
      pushToast('error', `Backend status probe failed: ${e.message || 'unknown error'}`);
    }
  };

  const refreshAll = async (base = apiBase) => {
    try {
      const h = await fetchJson(`${base}/health`);
      setHealth({ state: h.ok ? 'ok' : 'degraded', text: h.ok ? 'OpenClaw reachable' : 'Bridge degraded' });
    } catch {
      setHealth({ state: 'down', text: 'Bridge offline/unreachable' });
      return;
    }

    try {
      const params = new URLSearchParams({ limit: '500', offset: '0' });
      if (query.trim()) params.set('q', query.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (agentFilter !== 'all') params.set('agentId', agentFilter);

      const [tasksData, agentsData] = await Promise.all([
        fetchJson(`${base}/api/tasks?${params.toString()}`),
        fetchJson(`${base}/api/agents`)
      ]);

      setTasks(tasksData.items || []);
      setAgents(agentsData.items || []);
      setLastUpdated(new Date());
    } catch (e) {
      setHealth({ state: 'degraded', text: 'Health OK, but failed to load tasks/agents' });
      pushToast('error', `Data refresh failed: ${e.message || 'unknown error'}`);
    }
  };

  const openHistory = async (task) => {
    setSelectedTask(task);
    setHistoryOpen(true);
    await refreshSelectedHistory(task);
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
      setHistoryState({ loading: false, error: e.message || 'Failed to load history' });
      setHistory([]);
      pushToast('error', `History load failed: ${e.message || 'unknown error'}`);
    }
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
      setTaskActionState({ pinging: false, message: '', error: e.message || 'Ping failed' });
      pushToast('error', `Ping failed: ${e.message || 'unknown error'}`);
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard?.writeText(text || '');
      setTaskActionState((s) => ({ ...s, message: `${label} copied`, error: '' }));
      pushToast('success', `${label} copied`);
    } catch {
      setTaskActionState((s) => ({ ...s, error: `Failed to copy ${label.toLowerCase()}` }));
      pushToast('error', `Failed to copy ${label.toLowerCase()}`);
    }
  };

  const clearLocalCache = () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('taskBridge') || k.startsWith('openclaw'))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    setAuthToken('');
    setTokenDraft('');
    setApiBase(DEFAULT_API);
    setApiDraft(DEFAULT_API);
    pushToast('success', `Cleared ${keys.length} local cache entries`);
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
    refreshAll(apiBase);
    refreshDiagnostics(apiBase);
    refreshBackendStatus(apiBase);
  }, [apiBase, query, statusFilter, agentFilter, authToken]);

  useEffect(() => {
    const t = setInterval(() => {
      refreshAll(apiBase);
      refreshDiagnostics(apiBase);
      refreshBackendStatus(apiBase);
    }, health.state === 'down' ? 7000 : 5000);
    return () => clearInterval(t);
  }, [apiBase, query, statusFilter, agentFilter, authToken, health.state]);

  const filtered = useMemo(() => {
    const list = [...tasks];
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = a[sortBy] ?? '';
      const bv = b[sortBy] ?? '';
      if (sortBy === 'updatedAt') return dir * ((new Date(av).getTime() || 0) - (new Date(bv).getTime() || 0));
      if (typeof av === 'number' && typeof bv === 'number') return dir * (av - bv);
      return dir * String(av).localeCompare(String(bv));
    });
    return list;
  }, [tasks, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const mismatchFlag = useMemo(() => {
    const versionInstance = backendVersion?.instanceId || backendVersion?.instance || backendVersion?.id || null;
    const selfcheckInstance = backendSelfcheck?.instanceId || backendSelfcheck?.instance || backendSelfcheck?.id || null;
    if (!versionInstance || !selfcheckInstance) return false;
    return String(versionInstance) !== String(selfcheckInstance);
  }, [backendVersion, backendSelfcheck]);

  useEffect(() => setPage(0), [query, statusFilter, agentFilter]);

  const applyConnection = () => {
    localStorage.setItem('taskBridgeApi', apiDraft.trim());
    localStorage.setItem('taskBridgeToken', tokenDraft.trim());
    setApiBase(apiDraft.trim());
    setAuthToken(tokenDraft.trim());
    pushToast('success', 'Connection settings applied');
  };

  const restartCmdUnix = "pkill -f 'TaskBridgeApp/bridge/src/server.js' || true; HOST=0.0.0.0 nohup node /home/hugog/.openclaw/workspace/TaskBridgeApp/bridge/src/server.js >/tmp/task-bridge.log 2>&1 &";
  const restartCmdWindows = 'wsl.exe -d Ubuntu -- bash -lc "pkill -f \"TaskBridgeApp/bridge/src/server.js\" || true; HOST=0.0.0.0 nohup node /home/hugog/.openclaw/workspace/TaskBridgeApp/bridge/src/server.js >/tmp/task-bridge.log 2>&1 &"';

  return (
    <main style={{ fontFamily: 'Segoe UI, sans-serif', background: '#f3f4f6', minHeight: '100vh', padding: 14 }}>
      <h1 style={{ marginTop: 0 }}>OpenClaw Dashboard</h1>

      <div style={{ marginBottom: 10, display: 'grid', gap: 8 }}>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: mismatchFlag ? '#fee2e2' : '#e0f2fe', border: `1px solid ${mismatchFlag ? '#ef4444' : '#7dd3fc'}`, fontSize: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>Backend status</b>
          {backendState.loading ? <span>Probing…</span> : null}
          <span>version: {backendVersion?.version || backendVersion?.tag || '-'}</span>
          <span>selfcheck: {backendSelfcheck?.ok == null ? '-' : String(backendSelfcheck.ok)}</span>
          <span>instance(v): {backendVersion?.instanceId || backendVersion?.instance || '-'}</span>
          <span>instance(s): {backendSelfcheck?.instanceId || backendSelfcheck?.instance || '-'}</span>
          {mismatchFlag ? <span style={{ color: '#991b1b', fontWeight: 700 }}>STALE INSTANCE MISMATCH</span> : <span style={{ color: '#155e75' }}>instance OK</span>}
          {backendState.error ? <span style={{ color: '#991b1b' }}>probe error: {backendState.error}</span> : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge health={health} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>{lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'No data yet'}</span>
        </div>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={apiDraft} onChange={(e) => setApiDraft(e.target.value)} placeholder="API base" style={{ minWidth: 320, padding: 7 }} />
        <input value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder="Bearer token (optional)" style={{ minWidth: 260, padding: 7 }} />
        <button onClick={applyConnection}>Apply</button>
        <button onClick={() => optimisticRefresh(apiBase)}>Refresh</button>
        {bridgeManaged && (
          <button onClick={async () => {
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
              pushToast('error', `Bridge restart failed: ${e.message || 'unknown error'}`);
            }
          }}>Restart bridge</button>
        )}
      </div>

      <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
        <button onClick={() => setActiveTab('tasks')} disabled={activeTab === 'tasks'}>Tasks</button>
        <button onClick={() => setActiveTab('diagnostics')} disabled={activeTab === 'diagnostics'}>Diagnostics</button>
      </div>

      {activeTab === 'tasks' ? (
        <>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: 7 }} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">active</option>
              <option value="aborted">aborted</option>
            </select>
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
              <option value="all">All agents</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="updatedAt">updatedAt</option>
              <option value="id">id</option>
              <option value="agentId">agentId</option>
              <option value="totalTokens">totalTokens</option>
            </select>
            <button onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}>Dir: {sortDir}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'start' }}>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
              <table cellPadding="6" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr><th>Status</th><th>Task ID</th><th>Agent</th><th>Kind</th><th>Age(s)</th><th>Tokens</th><th>Updated</th><th>Actions</th></tr></thead>
                <tbody>
                  {pageRows.map((t) => (
                    <tr key={t.id} style={{ borderTop: '1px solid #eee', background: selectedTask?.id === t.id ? '#f8fafc' : 'transparent' }}>
                      <td><span style={{ background: statusColor[(t.status || '').toLowerCase()] || statusColor.unknown, color: '#fff', borderRadius: 999, padding: '2px 8px' }}>{t.status}</span></td>
                      <td>{t.id}</td>
                      <td>{t.agentId}</td>
                      <td>{t.kind}</td>
                      <td>{t.ageMs != null ? Math.round(t.ageMs / 1000) : '-'}</td>
                      <td>{t.totalTokens ?? '-'}</td>
                      <td>{formatTs(t.updatedAt)}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openHistory(t)}>History</button>
                        <button onClick={() => setSelectedTask(t)}>Select</button>
                        <button onClick={() => window.open(`${apiBase.replace(/:\d+$/, ':18789')}/`, '_blank')}>Open UI</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12 }}>Showing {pageRows.length}/{filtered.length}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button disabled={pageSafe <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
                  <span style={{ fontSize: 12 }}>Page {pageSafe + 1}/{totalPages}</span>
                  <button disabled={pageSafe + 1 >= totalPages} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <Panel title="Task actions">
                {!selectedTask ? <div style={{ color: '#6b7280', fontSize: 13 }}>Select a task row to enable actions.</div> : (
                  <>
                    <div style={{ fontSize: 12, marginBottom: 8 }}><b>ID:</b> {selectedTask.id}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <button disabled={taskActionState.pinging} onClick={pingSelected}>{taskActionState.pinging ? 'Pinging…' : 'Ping session'}</button>
                      <button onClick={() => refreshSelectedHistory(selectedTask)}>Refresh selected history</button>
                      <button onClick={() => copyText(selectedTask.id || '', 'Session ID')}>Copy session id</button>
                      <button onClick={() => copyText(selectedTask.key || '', 'Session key')}>Copy session key</button>
                    </div>
                    {taskActionState.message && <div style={{ fontSize: 12, color: '#166534' }}>{taskActionState.message}</div>}
                    {taskActionState.error && <div style={{ fontSize: 12, color: '#b91c1c' }}>{taskActionState.error}</div>}
                  </>
                )}
              </Panel>

              <Panel title="Bridge doctor">
                <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => copyText(restartCmdUnix, 'Linux/macOS restart command')}>Copy restart cmd (WSL/Linux)</button>
                    <button onClick={() => copyText(restartCmdWindows, 'Windows restart command')}>Copy restart cmd (Windows)</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => refreshBackendStatus(apiBase)}>Probe /api/version + /api/selfcheck</button>
                    <button onClick={clearLocalCache}>Clear local token/api cache</button>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Last probe: {formatTs(backendState.refreshedAt)}</div>
                </div>
              </Panel>
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <Panel title="Diagnostics metrics">
            <div style={{ marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
              Last refresh: {formatTs(diagState.refreshedAt)}
            </div>
            {diagState.loading ? <div style={{ fontSize: 13, color: '#6b7280' }}>Loading diagnostics…</div> : null}
            {diagState.error ? <div style={{ fontSize: 13, color: '#b91c1c' }}>{diagState.error}</div> : null}
            {!diagState.loading && !diagState.error ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <MetricCard label="Latency" value={`${diagLatencyMs ?? '-'} ms`} />
                <MetricCard label="Bridge host" value={diagConfig?.host ?? '-'} />
                <MetricCard label="Bridge port" value={String(diagConfig?.port ?? '-')} />
                <MetricCard label="Auth enabled" value={String(diagConfig?.authEnabled ?? false)} />
                <MetricCard label="Uptime (s)" value={String(metrics?.uptimeSec ?? metrics?.uptime ?? '-')} />
                <MetricCard label="Requests" value={String(metrics?.requestsTotal ?? metrics?.requests ?? '-')} />
                <MetricCard label="Errors" value={String(metrics?.errorsTotal ?? metrics?.errors ?? '-')} />
                <MetricCard label="Active sessions" value={String(metrics?.activeSessions ?? metrics?.sessions ?? '-')} />
              </div>
            ) : null}
          </Panel>

          <Panel title="Raw metrics (/api/metrics)">
            <pre style={{ margin: 0, overflow: 'auto', fontSize: 12, background: '#0b1020', color: '#d1d5db', padding: 10, borderRadius: 8 }}>
              {JSON.stringify(metrics || {}, null, 2)}
            </pre>
          </Panel>
        </div>
      )}

      {historyOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 'min(960px, 92vw)', maxHeight: '82vh', background: 'white', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 1, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Session history preview</h3>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedTask?.id}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => refreshSelectedHistory(selectedTask)}>Refresh</button>
                <button onClick={() => setHistoryOpen(false)}>Close</button>
              </div>
            </div>

            <div style={{ overflow: 'auto', padding: 12, maxHeight: '70vh' }}>
              {historyState.loading ? <p style={{ color: '#6b7280' }}>Loading history…</p> : null}
              {!historyState.loading && historyState.error ? <p style={{ color: '#b91c1c' }}>{historyState.error}</p> : null}
              {!historyState.loading && !historyState.error && history.length === 0 ? <p>No history available.</p> : null}

              {!historyState.loading && !historyState.error && history.map((m, i) => {
                const role = (m.role || 'unknown').toLowerCase();
                const style = roleChip[role] || roleChip.unknown;
                return (
                  <div key={i} style={{ borderTop: '1px solid #f0f0f0', padding: '10px 0' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ background: style.bg, color: style.fg, borderRadius: 999, padding: '2px 8px', fontSize: 11, textTransform: 'uppercase' }}>{role}</span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{formatTs(m.ts)}</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.text || ''}</div>
                  </div>
                );
              })}
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

function Panel({ title, children }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', padding: 10 }}>
      <div style={{ fontSize: 12, color: '#475569' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Badge({ health }) {
  const bg = health.state === 'ok' ? '#16a34a' : health.state === 'down' ? '#dc2626' : '#ca8a04';
  return <span style={{ color: '#fff', background: bg, borderRadius: 999, padding: '3px 10px', fontSize: 12 }}>{health.text}</span>;
}

function formatTs(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

createRoot(document.getElementById('root')).render(<App />);
