import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const DEFAULT_API = (import.meta.env.VITE_API_BASE || 'http://172.28.202.129:8787').trim();
const PAGE_SIZE = 20;

const statusColor = {
  active: '#2563eb',
  aborted: '#dc2626',
  unknown: '#6b7280'
};

function App() {
  const [apiBase, setApiBase] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);
  const [apiDraft, setApiDraft] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);
  const [authToken, setAuthToken] = useState(localStorage.getItem('taskBridgeToken') || '');
  const [tokenDraft, setTokenDraft] = useState(localStorage.getItem('taskBridgeToken') || '');

  const [health, setHealth] = useState({ state: 'loading', text: 'Connecting…' });
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

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

  const fetchJson = async (url) => {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
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
    } catch {
      setHealth({ state: 'degraded', text: 'Health OK, but failed to load tasks/agents' });
    }
  };

  const openHistory = async (task) => {
    setSelectedTask(task);
    setHistoryOpen(true);
    try {
      const data = await fetchJson(`${apiBase}/api/tasks/${encodeURIComponent(task.id)}/history?limit=25`);
      setHistory(data.items || []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => { refreshAll(apiBase); }, [apiBase, query, statusFilter, agentFilter, authToken]);
  useEffect(() => {
    const t = setInterval(() => refreshAll(apiBase), health.state === 'down' ? 7000 : 2000);
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

  useEffect(() => setPage(0), [query, statusFilter, agentFilter]);

  const applyConnection = () => {
    localStorage.setItem('taskBridgeApi', apiDraft.trim());
    localStorage.setItem('taskBridgeToken', tokenDraft.trim());
    setApiBase(apiDraft.trim());
    setAuthToken(tokenDraft.trim());
  };

  return (
    <main style={{ fontFamily: 'Segoe UI, sans-serif', background: '#f3f4f6', minHeight: '100vh', padding: 14 }}>
      <h1 style={{ marginTop: 0 }}>OpenClaw Dashboard</h1>
      <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge health={health} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>{lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'No data yet'}</span>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={apiDraft} onChange={(e) => setApiDraft(e.target.value)} placeholder="API base" style={{ minWidth: 320, padding: 7 }} />
        <input value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder="Bearer token (optional)" style={{ minWidth: 260, padding: 7 }} />
        <button onClick={applyConnection}>Apply</button>
        <button onClick={() => refreshAll(apiBase)}>Refresh</button>
      </div>

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

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
        <table cellPadding="6" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr><th>Status</th><th>Task ID</th><th>Agent</th><th>Kind</th><th>Age(s)</th><th>Tokens</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            {pageRows.map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
                <td><span style={{ background: statusColor[(t.status || '').toLowerCase()] || statusColor.unknown, color: '#fff', borderRadius: 999, padding: '2px 8px' }}>{t.status}</span></td>
                <td>{t.id}</td>
                <td>{t.agentId}</td>
                <td>{t.kind}</td>
                <td>{t.ageMs != null ? Math.round(t.ageMs / 1000) : '-'}</td>
                <td>{t.totalTokens ?? '-'}</td>
                <td>{formatIso(t.updatedAt)}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openHistory(t)}>History</button>
                  <button onClick={() => navigator.clipboard?.writeText(t.key || '')}>Copy key</button>
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

      {historyOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 'min(900px, 92vw)', maxHeight: '82vh', overflow: 'auto', background: 'white', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Session history preview</h3>
              <button onClick={() => setHistoryOpen(false)}>Close</button>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280' }}>{selectedTask?.id}</p>
            {history.length === 0 ? <p>No history available.</p> : history.map((m, i) => (
              <div key={i} style={{ borderTop: '1px solid #f0f0f0', padding: '8px 0' }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{m.role || 'unknown'} • {formatIso(m.ts)}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text || ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function Badge({ health }) {
  const bg = health.state === 'ok' ? '#16a34a' : health.state === 'down' ? '#dc2626' : '#ca8a04';
  return <span style={{ color: '#fff', background: bg, borderRadius: 999, padding: '3px 10px', fontSize: 12 }}>{health.text}</span>;
}

function formatIso(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

createRoot(document.getElementById('root')).render(<App />);
