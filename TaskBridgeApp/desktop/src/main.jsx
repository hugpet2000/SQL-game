import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const DEFAULT_API = (import.meta.env.VITE_API_BASE || 'http://172.28.202.129:8787').trim();
const PAGE_SIZE = 20;

const statusColor = {
  active: '#2563eb',
  aborted: '#dc2626',
  queued: '#7c3aed',
  running: '#0f766e',
  completed: '#15803d',
  failed: '#b91c1c',
  unknown: '#6b7280'
};

function App() {
  const [apiBase, setApiBase] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);
  const [apiDraft, setApiDraft] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);

  const [health, setHealth] = useState({ state: 'loading', text: 'Connecting…' });
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

  const [pollMs, setPollMs] = useState(2000);

  const refreshAll = async (base = apiBase) => {
    try {
      const h = await fetch(`${base}/health`).then((r) => r.json());
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
        fetch(`${base}/api/tasks?${params.toString()}`).then((r) => r.json()),
        fetch(`${base}/api/agents`).then((r) => r.json())
      ]);

      const nextTasks = tasksData.items || [];
      const nextAgents = agentsData.items || [];
      setTasks(nextTasks);
      setAgents(nextAgents);

      if (selectedTask) {
        const stillThere = nextTasks.find((t) => t.id === selectedTask.id);
        setSelectedTask(stillThere || null);
      }

      setLastUpdated(new Date());
    } catch {
      setHealth({ state: 'degraded', text: 'Health OK, but failed to load tasks/agents' });
    }
  };

  useEffect(() => {
    refreshAll(apiBase);
  }, [apiBase, query, statusFilter, agentFilter]);

  useEffect(() => {
    const timer = setInterval(() => refreshAll(apiBase), pollMs);
    return () => clearInterval(timer);
  }, [apiBase, pollMs, selectedTask, query, statusFilter, agentFilter]);

  useEffect(() => {
    if (health.state === 'down') {
      setPollMs(7000);
    } else {
      setPollMs(2000);
    }
  }, [health.state]);

  const summary = useMemo(() => {
    const counts = { queued: 0, running: 0, completed: 0, failed: 0, active: 0, aborted: 0 };
    for (const t of tasks) {
      const key = (t.status || 'unknown').toLowerCase();
      if (counts[key] != null) counts[key] += 1;
    }

    const online = agents.length;
    const busy = agents.filter((a) => !!a.currentTaskId).length;
    const idle = Math.max(0, online - busy);

    return { counts, online, busy, idle };
  }, [tasks, agents]);

  const searchableFields = (t) => `${t.id || ''} ${t.key || ''} ${t.agentId || ''} ${t.model || ''}`.toLowerCase();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tasks.filter((t) => {
      const statusOk = statusFilter === 'all' || (t.status || '').toLowerCase() === statusFilter;
      const queryOk = !q || searchableFields(t).includes(q);
      return statusOk && queryOk;
    });

    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = a[sortBy] ?? '';
      const bv = b[sortBy] ?? '';
      if (sortBy === 'updatedAt') {
        return dir * ((new Date(av).getTime() || 0) - (new Date(bv).getTime() || 0));
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return dir * (av - bv);
      }
      return dir * String(av).localeCompare(String(bv));
    });

    return list;
  }, [tasks, query, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, agentFilter]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const ids = tasks
      .map((t) => t.id)
      .filter(Boolean)
      .filter((id) => id.toLowerCase().includes(q));
    return [...new Set(ids)].slice(0, 8);
  }, [query, tasks]);

  const saveApiAndRefresh = () => {
    localStorage.setItem('taskBridgeApi', apiDraft.trim());
    setApiBase(apiDraft.trim());
  };

  return (
    <main style={{ fontFamily: 'Segoe UI, sans-serif', background: '#f3f4f6', minHeight: '100vh', padding: 14, color: '#111827' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>OpenClaw Dashboard</h1>
        <span style={{ padding: '3px 10px', borderRadius: 999, color: 'white', background: health.state === 'ok' ? '#16a34a' : health.state === 'down' ? '#dc2626' : '#ca8a04', fontSize: 12 }}>
          {health.text}
        </span>
        <span style={{ color: '#6b7280', fontSize: 12 }}>
          {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'No data yet'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={apiDraft} onChange={(e) => setApiDraft(e.target.value)} style={{ minWidth: 360, padding: '7px 9px' }} />
        <button onClick={saveApiAndRefresh}>Apply API</button>
        <button onClick={() => refreshAll(apiBase)}>Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Card title="Queued" value={summary.counts.queued} />
        <Card title="Running" value={summary.counts.running || summary.counts.active} />
        <Card title="Completed" value={summary.counts.completed} />
        <Card title="Failed" value={summary.counts.failed || summary.counts.aborted} />
        <Card title="Agents Online" value={summary.online} />
        <Card title="Agents Busy/Idle" value={`${summary.busy}/${summary.idle}`} />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={{ background: 'white', borderRadius: 10, padding: 10, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              placeholder="Search task id/key/agent/model"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(0);
                  if (filtered.length > 0) setSelectedTask(filtered[0]);
                }
              }}
              style={{ padding: '7px 9px', minWidth: 260 }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">active</option>
              <option value="aborted">aborted</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </select>
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
              <option value="all">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.id}</option>
              ))}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="updatedAt">Sort: updatedAt</option>
              <option value="id">Sort: id</option>
              <option value="status">Sort: status</option>
              <option value="agentId">Sort: agentId</option>
              <option value="totalTokens">Sort: totalTokens</option>
            </select>
            <button onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>Dir: {sortDir}</button>
          </div>

          {suggestions.length > 0 && (
            <div style={{ marginBottom: 10, fontSize: 12, color: '#4b5563' }}>
              Suggestions:{' '}
              {suggestions.map((s) => (
                <button key={s} onClick={() => setQuery(s)} style={{ marginRight: 6, fontSize: 12 }}>
                  {s.slice(0, 10)}...
                </button>
              ))}
            </div>
          )}

          <div style={{ overflowX: 'auto', maxHeight: '62vh' }}>
            <table cellPadding="6" style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <TH>Status</TH>
                  <TH>Task ID</TH>
                  <TH>Agent</TH>
                  <TH>Kind</TH>
                  <TH align="right">Age (s)</TH>
                  <TH align="right">Tokens</TH>
                  <TH>Updated</TH>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTask(t)}
                    style={{ borderTop: '1px solid #e5e7eb', cursor: 'pointer', background: selectedTask?.id === t.id ? '#eef2ff' : 'white' }}
                  >
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: statusColor[(t.status || '').toLowerCase()] || statusColor.unknown, color: 'white', fontSize: 11 }}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.id}</td>
                    <td>{t.agentId}</td>
                    <td>{t.kind}</td>
                    <td align="right">{t.ageMs != null ? Math.round(t.ageMs / 1000) : '-'}</td>
                    <td align="right">{t.totalTokens ?? '-'}</td>
                    <td>{formatIso(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Showing {pageRows.length} / {filtered.length} rows
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button disabled={pageSafe <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
              <span style={{ fontSize: 12 }}>Page {pageSafe + 1} / {totalPages}</span>
              <button disabled={pageSafe + 1 >= totalPages} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ background: 'white', borderRadius: 10, padding: 10, border: '1px solid #e5e7eb' }}>
            <h3 style={{ marginTop: 0 }}>Agents ({agents.length})</h3>
            <div style={{ maxHeight: '28vh', overflow: 'auto', fontSize: 13 }}>
              {agents.map((a) => (
                <div key={a.id} style={{ borderTop: '1px solid #f3f4f6', padding: '6px 0' }}>
                  <div><strong>{a.emoji ? `${a.emoji} ` : ''}{a.name}</strong> ({a.id})</div>
                  <div style={{ color: '#6b7280' }}>{a.model || 'unknown model'}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 10, padding: 10, border: '1px solid #e5e7eb' }}>
            <h3 style={{ marginTop: 0 }}>Task details</h3>
            {!selectedTask ? (
              <p style={{ color: '#6b7280', margin: 0 }}>Click a task row to view details.</p>
            ) : (
              <div style={{ fontSize: 13 }}>
                <Detail label="Task ID" value={selectedTask.id} copyable />
                <Detail label="Session Key" value={selectedTask.key} />
                <Detail label="Status" value={selectedTask.status} />
                <Detail label="Agent" value={selectedTask.agentId} />
                <Detail label="Kind" value={selectedTask.kind} />
                <Detail label="Model" value={selectedTask.model || '-'} />
                <Detail label="Updated" value={formatIso(selectedTask.updatedAt)} />
                <Detail label="Age (s)" value={selectedTask.ageMs != null ? Math.round(selectedTask.ageMs / 1000) : '-'} />
                <Detail label="Total Tokens" value={selectedTask.totalTokens ?? '-'} />
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function TH({ children, align = 'left' }) {
  return <th align={align} style={{ textAlign: align, fontWeight: 600 }}>{children}</th>;
}

function Card({ title, value }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
      <div style={{ color: '#6b7280', fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Detail({ label, value, copyable = false }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <strong>{label}: </strong>
      <span>{String(value)}</span>
      {copyable && (
        <button style={{ marginLeft: 8, fontSize: 11 }} onClick={() => navigator.clipboard?.writeText(String(value))}>
          Copy
        </button>
      )}
    </div>
  );
}

function formatIso(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

createRoot(document.getElementById('root')).render(<App />);
