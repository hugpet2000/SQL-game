import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const DEFAULT_API = (import.meta.env.VITE_API_BASE || 'http://172.28.202.129:8787').trim();

const STATUS_COLORS = {
  connected: { bg: '#13361f', fg: '#79e2a5', border: '#215a34' },
  degraded: { bg: '#3c2a12', fg: '#f7c873', border: '#6b4d20' },
  offline: { bg: '#3a151a', fg: '#ff9aa7', border: '#6d2831' },
  busy: { bg: '#16273a', fg: '#93c5fd', border: '#23405f' },
  idle: { bg: '#1f2632', fg: '#b7c2d6', border: '#39455a' },
  error: { bg: '#3a151a', fg: '#ff9aa7', border: '#6d2831' },
  running: { bg: '#16273a', fg: '#93c5fd', border: '#23405f' },
  queued: { bg: '#3c2a12', fg: '#f7c873', border: '#6b4d20' },
  failed: { bg: '#3a151a', fg: '#ff9aa7', border: '#6d2831' },
  success: { bg: '#13361f', fg: '#79e2a5', border: '#215a34' }
};

function App() {
  const [apiBase, setApiBase] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);
  const [authToken, setAuthToken] = useState(localStorage.getItem('taskBridgeToken') || '');
  const [apiDraft, setApiDraft] = useState(localStorage.getItem('taskBridgeApi') || DEFAULT_API);
  const [tokenDraft, setTokenDraft] = useState(localStorage.getItem('taskBridgeToken') || '');
  const [bridgeManaged, setBridgeManaged] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(null);

  const [health, setHealth] = useState({ state: 'loading', text: 'Checking bridge…' });
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [backendVersion, setBackendVersion] = useState(null);
  const [backendSelfcheck, setBackendSelfcheck] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [autoReconnect, setAutoReconnect] = useState((localStorage.getItem('taskBridgeAutoReconnect') ?? '1') === '1');
  const [pollMs, setPollMs] = useState(Number(localStorage.getItem('taskBridgePollMs') || 6000));
  const [method, setMethod] = useState(localStorage.getItem('taskBridgeMethod') || 'http');
  const [hostDraft, setHostDraft] = useState(localStorage.getItem('taskBridgeHost') || '127.0.0.1');
  const [portDraft, setPortDraft] = useState(localStorage.getItem('taskBridgePort') || '8787');

  const [theme, setTheme] = useState(localStorage.getItem('taskBridgeTheme') || 'dark');
  const [compactMode, setCompactMode] = useState((localStorage.getItem('taskBridgeCompact') ?? '0') === '1');
  const [relativeTime, setRelativeTime] = useState((localStorage.getItem('taskBridgeRelativeTime') ?? '0') === '1');
  const [logLevel, setLogLevel] = useState(localStorage.getItem('taskBridgeLogLevel') || 'info');

  const headers = useMemo(() => (authToken.trim() ? { Authorization: `Bearer ${authToken.trim()}` } : {}), [authToken]);

  const themeVars = useMemo(() => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    return isDark
      ? {
          bg: '#0d1117',
          card: '#161b22',
          cardAlt: '#1c2330',
          border: '#2b3543',
          text: '#e6edf3',
          muted: '#9fb0c4',
          shadow: '0 10px 24px rgba(0,0,0,.24)'
        }
      : {
          bg: '#f4f7fb',
          card: '#ffffff',
          cardAlt: '#f8fafc',
          border: '#d9e1ec',
          text: '#0f172a',
          muted: '#475569',
          shadow: '0 8px 18px rgba(15,23,42,.08)'
        };
  }, [theme]);

  const fetchMaybeJson = async (url, init = {}) => {
    const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const txt = await res.text();
    let body = null;
    try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
    if (!res.ok) throw new Error(String(body?.error || body?.details || body || `${res.status} ${res.statusText}`));
    return body;
  };

  const formatTs = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    if (!relativeTime) return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const connectionState = useMemo(() => {
    if (health.state === 'down') return 'offline';
    if (error || backendSelfcheck?.ok === false) return 'degraded';
    if (health.state === 'ok') return 'connected';
    return 'degraded';
  }, [health.state, error, backendSelfcheck]);

  const mappedAgents = useMemo(() => {
    return (agents || []).map((a) => {
      const statusRaw = (a.status || a.state || '').toLowerCase();
      const status = statusRaw.includes('error') ? 'error' : statusRaw.includes('busy') || statusRaw.includes('active') ? 'busy' : 'idle';
      const linkedTasks = tasks.filter((t) => String(t.agentId || t.agent || '') === String(a.id || a.agentId || a.name || ''));
      const currentTask = linkedTasks.find((t) => /active|running/i.test(t.status || '')) || linkedTasks[0] || null;
      return {
        id: String(a.id || a.agentId || a.name || Math.random()),
        name: a.name || a.agentName || a.id || 'Unknown agent',
        role: a.role || a.kind || 'Worker',
        status,
        taskText: currentTask?.title || currentTask?.kind || currentTask?.id || 'No active task',
        lastUpdated: a.updatedAt || a.lastHeartbeat || currentTask?.updatedAt || null,
        heartbeat: a.lastHeartbeat || a.updatedAt || null,
        tasks: linkedTasks
      };
    });
  }, [agents, tasks]);

  const filteredAgents = useMemo(() => {
    return mappedAgents.filter((a) => {
      const q = search.trim().toLowerCase();
      const matchQ = !q || `${a.name} ${a.role} ${a.taskText}`.toLowerCase().includes(q);
      const matchF = agentFilter === 'all' || a.status === agentFilter;
      return matchQ && matchF;
    });
  }, [mappedAgents, search, agentFilter]);

  const selectedAgent = useMemo(() => {
    return mappedAgents.find((a) => a.id === selectedAgentId) || filteredAgents[0] || null;
  }, [mappedAgents, filteredAgents, selectedAgentId]);

  const activityFeed = useMemo(() => {
    return [...tasks]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .slice(0, 80)
      .map((t) => ({
        id: t.id || `${t.agentId}-${t.updatedAt}`,
        ts: t.updatedAt || t.createdAt,
        agent: t.agentId || t.agent || 'unknown-agent',
        action: t.title || t.kind || 'Task update',
        status: normalizeTaskStatus(t.status)
      }));
  }, [tasks]);

  const stats = useMemo(() => {
    const activeAgents = mappedAgents.filter((a) => a.status === 'busy').length;
    const running = tasks.filter((t) => /active|running/i.test(t.status || '')).length;
    const queued = tasks.filter((t) => /queued|pending/i.test(t.status || '')).length;
    const failed = tasks.filter((t) => /fail|abort|error/i.test(t.status || '')).length;
    return { activeAgents, running, queued, failed };
  }, [mappedAgents, tasks]);

  const refreshAll = async (base = apiBase) => {
    setLoading(true);
    setError('');
    try {
      const healthData = await fetchMaybeJson(`${base}/health`);
      setHealth({ state: healthData?.ok ? 'ok' : 'degraded', text: healthData?.ok ? 'Bridge reachable' : 'Bridge degraded' });
      const [tasksData, agentsData, metricsData, versionData, selfcheckData] = await Promise.allSettled([
        fetchMaybeJson(`${base}/api/tasks?limit=500&offset=0`),
        fetchMaybeJson(`${base}/api/agents`),
        fetchMaybeJson(`${base}/api/metrics`),
        fetchMaybeJson(`${base}/api/version`),
        fetchMaybeJson(`${base}/api/selfcheck`)
      ]);
      if (tasksData.status === 'fulfilled') setTasks(tasksData.value?.items || []);
      if (agentsData.status === 'fulfilled') setAgents(agentsData.value?.items || []);
      if (metricsData.status === 'fulfilled') setMetrics(metricsData.value || null);
      if (versionData.status === 'fulfilled') setBackendVersion(versionData.value || null);
      if (selfcheckData.status === 'fulfilled') setBackendSelfcheck(selfcheckData.value || null);
      const hadSoftFail = [tasksData, agentsData].some((x) => x.status === 'rejected');
      if (hadSoftFail) setError('Connected, but some data endpoints failed.');
      setLastSync(new Date());
      setLastPing(new Date());
    } catch (e) {
      setHealth({ state: 'down', text: 'Bridge offline or unreachable' });
      setError(String(e.message || e));
      setLastPing(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let off = null;
    (async () => {
      if (!window.bridgeCtl?.getUrl) return;
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
            if (!payload?.url) return;
            setApiBase(payload.url);
            setApiDraft(payload.url);
            localStorage.setItem('taskBridgeApi', payload.url);
          });
        }
      } catch {
        // noop
      }
    })();
    return () => typeof off === 'function' && off();
  }, []);

  useEffect(() => { refreshAll(apiBase); }, [apiBase, authToken]);

  useEffect(() => {
    if (!autoReconnect) return;
    const ms = Number.isFinite(pollMs) && pollMs > 0 ? pollMs : 6000;
    const t = setInterval(() => refreshAll(apiBase), ms);
    return () => clearInterval(t);
  }, [apiBase, authToken, autoReconnect, pollMs]);

  useEffect(() => { localStorage.setItem('taskBridgeTheme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('taskBridgeCompact', compactMode ? '1' : '0'); }, [compactMode]);
  useEffect(() => { localStorage.setItem('taskBridgeRelativeTime', relativeTime ? '1' : '0'); }, [relativeTime]);

  const saveConnection = () => {
    const computed = method === 'http' || method === 'https' ? `${method}://${hostDraft.trim()}:${String(portDraft).trim()}` : apiDraft.trim();
    localStorage.setItem('taskBridgeMethod', method);
    localStorage.setItem('taskBridgeHost', hostDraft.trim());
    localStorage.setItem('taskBridgePort', String(portDraft).trim());
    localStorage.setItem('taskBridgeApi', computed);
    localStorage.setItem('taskBridgeToken', tokenDraft.trim());
    setApiBase(computed);
    setApiDraft(computed);
    setAuthToken(tokenDraft.trim());
  };

  const testConnection = async () => {
    try {
      await fetchMaybeJson(`${apiDraft.trim()}/health`);
      setError('');
      setHealth({ state: 'ok', text: 'Test connection successful' });
    } catch (e) {
      setError(String(e.message || e));
      setHealth({ state: 'down', text: 'Test connection failed' });
    }
  };

  const exportDiagnostics = () => {
    const payload = {
      apiBase,
      connectionState,
      health,
      lastSync,
      lastPing,
      backendVersion,
      backendSelfcheck,
      metrics,
      agents: agents.length,
      tasks: tasks.length,
      error,
      generatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskbridge-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearCache = () => {
    ['taskBridgeToken', 'taskBridgeApi'].forEach((k) => localStorage.removeItem(k));
    setTokenDraft('');
    setAuthToken('');
    setApiDraft(DEFAULT_API);
    setApiBase(DEFAULT_API);
  };

  const contentPadding = compactMode ? 10 : 16;

  return (
    <div style={{ minHeight: '100vh', background: themeVars.bg, color: themeVars.text, fontFamily: 'Inter, Segoe UI, sans-serif', display: 'grid', gridTemplateColumns: '240px 1fr' }}>
      <SidebarNav
        activeTab={activeTab}
        onChange={setActiveTab}
        connectionState={connectionState}
        version={backendVersion?.version || backendVersion?.tag || 'dev'}
        vars={themeVars}
      />

      <div style={{ padding: contentPadding }}>
        <TopHeaderBar
          title={activeTab === 'home' ? 'Home' : activeTab === 'agents' ? 'Agents' : 'Settings'}
          onRefresh={() => refreshAll(apiBase)}
          loading={loading}
          connectionState={connectionState}
          search={activeTab === 'agents' ? search : ''}
          onSearch={setSearch}
          vars={themeVars}
        />

        {activeTab === 'home' && (
          <HomeTab
            stats={stats}
            activityFeed={activityFeed}
            agents={mappedAgents}
            health={health}
            error={error}
            lastPing={lastPing}
            lastSync={lastSync}
            metrics={metrics}
            formatTs={formatTs}
            onStatClick={(target) => {
              setActiveTab('agents');
              if (target === 'running') setAgentFilter('busy');
              if (target === 'failed') setAgentFilter('error');
              if (target === 'queued') setSearch('queued');
            }}
            onOpenActivity={setSelectedActivity}
            onReconnect={() => refreshAll(apiBase)}
            vars={themeVars}
          />
        )}

        {activeTab === 'agents' && (
          <AgentsTab
            agents={filteredAgents}
            selectedAgent={selectedAgent}
            selectedAgentId={selectedAgent?.id}
            onSelectAgent={(id) => setSelectedAgentId(id)}
            filter={agentFilter}
            onFilter={setAgentFilter}
            onRefresh={() => refreshAll(apiBase)}
            error={error}
            formatTs={formatTs}
            vars={themeVars}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            method={method}
            setMethod={setMethod}
            hostDraft={hostDraft}
            setHostDraft={setHostDraft}
            portDraft={portDraft}
            setPortDraft={setPortDraft}
            apiDraft={apiDraft}
            setApiDraft={setApiDraft}
            tokenDraft={tokenDraft}
            setTokenDraft={setTokenDraft}
            onSave={saveConnection}
            onTest={testConnection}
            autoReconnect={autoReconnect}
            setAutoReconnect={(v) => {
              setAutoReconnect(v);
              localStorage.setItem('taskBridgeAutoReconnect', v ? '1' : '0');
            }}
            pollMs={pollMs}
            setPollMs={(v) => {
              setPollMs(v);
              localStorage.setItem('taskBridgePollMs', String(v));
            }}
            theme={theme}
            setTheme={setTheme}
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            relativeTime={relativeTime}
            setRelativeTime={setRelativeTime}
            onClearCache={clearCache}
            onExportDiagnostics={exportDiagnostics}
            logLevel={logLevel}
            setLogLevel={(v) => {
              setLogLevel(v);
              localStorage.setItem('taskBridgeLogLevel', v);
            }}
            bridgeManaged={bridgeManaged}
            vars={themeVars}
          />
        )}
      </div>

      {selectedActivity && (
        <DetailsDrawer vars={themeVars} title="Activity details" onClose={() => setSelectedActivity(null)}>
          <div style={{ display: 'grid', gap: 10 }}>
            <KV label="Timestamp" value={formatTs(selectedActivity.ts)} vars={themeVars} />
            <KV label="Agent" value={selectedActivity.agent} vars={themeVars} />
            <KV label="Action" value={selectedActivity.action} vars={themeVars} />
            <div><StatusBadge status={selectedActivity.status} /></div>
          </div>
        </DetailsDrawer>
      )}
    </div>
  );
}

function SidebarNav({ activeTab, onChange, connectionState, version, vars }) {
  const item = (id, label) => (
    <button
      onClick={() => onChange(id)}
      style={{
        width: '100%',
        textAlign: 'left',
        background: activeTab === id ? vars.cardAlt : 'transparent',
        color: vars.text,
        border: `1px solid ${activeTab === id ? vars.border : 'transparent'}`,
        padding: '10px 12px',
        borderRadius: 10,
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );

  return (
    <aside style={{ borderRight: `1px solid ${vars.border}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: 10, borderRadius: 12, background: vars.card, border: `1px solid ${vars.border}`, boxShadow: vars.shadow }}>
        <div style={{ fontSize: 12, color: vars.muted }}>TaskBridgeApp</div>
        <div style={{ fontWeight: 700 }}>Desktop Console</div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {item('home', 'Home')}
        {item('agents', 'Agents')}
        {item('settings', 'Settings')}
      </div>
      <div style={{ marginTop: 'auto', border: `1px solid ${vars.border}`, borderRadius: 10, padding: 10, background: vars.card }}>
        <div style={{ marginBottom: 6 }}><StatusBadge status={connectionState} /></div>
        <div style={{ fontSize: 12, color: vars.muted }}>Version {version}</div>
      </div>
    </aside>
  );
}

function TopHeaderBar({ title, onRefresh, loading, connectionState, search, onSearch, vars }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 4, background: vars.bg, paddingBottom: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {search !== '' && <SearchInput value={search} onChange={onSearch} placeholder="Search agents or tasks" vars={vars} />}
          <StatusBadge status={connectionState} />
          <button onClick={onRefresh}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>
    </div>
  );
}

function HomeTab({ stats, activityFeed, agents, health, error, lastPing, lastSync, metrics, formatTs, onStatClick, onOpenActivity, onReconnect, vars }) {
  const disconnected = health.state === 'down';
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <StatCard title="Active Agents" value={String(stats.activeAgents)} status="busy" onClick={() => onStatClick('activeAgents')} vars={vars} />
        <StatCard title="Running Tasks" value={String(stats.running)} status="running" onClick={() => onStatClick('running')} vars={vars} />
        <StatCard title="Queued Tasks" value={String(stats.queued)} status="queued" onClick={() => onStatClick('queued')} vars={vars} />
        <StatCard title="Failed / Alerts" value={String(stats.failed)} status={stats.failed > 0 ? 'failed' : 'success'} onClick={() => onStatClick('failed')} vars={vars} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        <Card title="Live Activity Feed" vars={vars}>
          {activityFeed.length === 0 ? (
            <EmptyState title="No activity yet" text="Task activity appears here in real time." vars={vars} />
          ) : (
            <div style={{ maxHeight: 360, overflow: 'auto', display: 'grid', gap: 8 }}>
              {activityFeed.map((item) => (
                <ActivityFeedItem key={item.id} item={item} onClick={() => onOpenActivity(item)} formatTs={formatTs} vars={vars} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Agents Snapshot" vars={vars}>
          {agents.length === 0 ? (
            <EmptyState title="No agents discovered" text="Once connected, active agents will show here." vars={vars} />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {agents.slice(0, 10).map((a) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, border: `1px solid ${vars.border}`, borderRadius: 10, padding: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ color: vars.muted, fontSize: 12 }}>{a.role}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="System Health" vars={vars}>
        {disconnected ? (
          <EmptyState title="Disconnected" text="Bridge is unavailable. Check settings and reconnect." actionLabel="Reconnect" onAction={onReconnect} vars={vars} />
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <KV label="Connection" value={health.text} vars={vars} />
            <KV label="Last ping" value={formatTs(lastPing)} vars={vars} />
            <KV label="Last sync" value={formatTs(lastSync)} vars={vars} />
            <KV label="CPU / RAM" value={`${metrics?.cpu ?? '-'} / ${metrics?.memory ?? metrics?.ram ?? '-'}`} vars={vars} />
            {error && <div style={{ color: '#ff9aa7', fontSize: 13 }}>⚠ {error}</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

function AgentsTab({ agents, selectedAgent, selectedAgentId, onSelectAgent, filter, onFilter, onRefresh, error, formatTs, vars }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 12 }}>
      <Card title="Agents" vars={vars}>
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          <FilterChips
            options={[
              { id: 'all', label: 'All' },
              { id: 'busy', label: 'Busy' },
              { id: 'idle', label: 'Idle' },
              { id: 'error', label: 'Error' }
            ]}
            value={filter}
            onChange={onFilter}
          />
          <button onClick={onRefresh}>Refresh list</button>
        </div>
        <div style={{ maxHeight: '68vh', overflow: 'auto', display: 'grid', gap: 8 }}>
          {agents.length === 0 ? (
            <EmptyState title="No matching agents" text="Try another search/filter or verify connection." vars={vars} />
          ) : (
            agents.map((agent) => (
              <AgentListItem key={agent.id} agent={agent} selected={selectedAgentId === agent.id} onClick={() => onSelectAgent(agent.id)} formatTs={formatTs} vars={vars} />
            ))
          )}
        </div>
      </Card>

      <Card title="Agent Details" vars={vars}>
        {!selectedAgent ? (
          <EmptyState title="No agent selected" text="Choose an agent from the left list to inspect details." vars={vars} />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedAgent.name}</div>
                <div style={{ color: vars.muted }}>{selectedAgent.role}</div>
              </div>
              <StatusBadge status={selectedAgent.status} />
            </div>

            <KV label="Last heartbeat" value={formatTs(selectedAgent.heartbeat)} vars={vars} />

            <Card title="Current Task" vars={vars}>
              <div style={{ fontWeight: 600 }}>{selectedAgent.taskText}</div>
              <div style={{ color: vars.muted, fontSize: 12, marginTop: 4 }}>Updated {formatTs(selectedAgent.lastUpdated)}</div>
            </Card>

            <Card title="Recent Tasks" vars={vars}>
              {selectedAgent.tasks.length === 0 ? (
                <EmptyState title="No tasks" text="No task history available for this agent." vars={vars} />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle(vars)}>Task</th>
                      <th style={thStyle(vars)}>Status</th>
                      <th style={thStyle(vars)}>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAgent.tasks.slice(0, 8).map((t) => (
                      <tr key={t.id || `${t.kind}-${t.updatedAt}`}>
                        <td style={tdStyle(vars)}>{t.title || t.kind || t.id}</td>
                        <td style={tdStyle(vars)}><StatusBadge status={normalizeTaskStatus(t.status)} /></td>
                        <td style={tdStyle(vars)}>{formatTs(t.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Logs / Events" vars={vars}>
              <div style={{ display: 'grid', gap: 8 }}>
                {(selectedAgent.tasks.slice(0, 5)).map((t) => (
                  <div key={`${t.id}-log`} style={{ border: `1px solid ${vars.border}`, borderRadius: 8, padding: 8, background: vars.cardAlt }}>
                    <div style={{ fontWeight: 600 }}>{t.id || 'task'}</div>
                    <div style={{ color: vars.muted, fontSize: 12 }}>{t.title || t.kind || 'Task event'} · {formatTs(t.updatedAt)}</div>
                  </div>
                ))}
                <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(selectedAgent.tasks.slice(0, 15), null, 2))}>Copy events JSON</button>
              </div>
            </Card>

            {error ? <div style={{ color: '#ff9aa7' }}>Error: {error}</div> : null}
          </div>
        )}
      </Card>
    </div>
  );
}

function SettingsTab(props) {
  const { vars } = props;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <SettingsSection title="Connection" vars={vars}>
        <SettingsRow label="Method">
          <select value={props.method} onChange={(e) => props.setMethod(e.target.value)}>
            <option value="http">http</option>
            <option value="https">https</option>
            <option value="custom">custom url</option>
          </select>
        </SettingsRow>
        {props.method !== 'custom' ? (
          <>
            <SettingsRow label="Host"><input value={props.hostDraft} onChange={(e) => props.setHostDraft(e.target.value)} /></SettingsRow>
            <SettingsRow label="Port"><input value={props.portDraft} onChange={(e) => props.setPortDraft(e.target.value)} /></SettingsRow>
          </>
        ) : (
          <SettingsRow label="API URL"><input value={props.apiDraft} onChange={(e) => props.setApiDraft(e.target.value)} /></SettingsRow>
        )}
        <SettingsRow label="Token"><input value={props.tokenDraft} onChange={(e) => props.setTokenDraft(e.target.value)} placeholder="Bearer token" /></SettingsRow>
        <SettingsRow label="Auto reconnect"><input type="checkbox" checked={props.autoReconnect} onChange={(e) => props.setAutoReconnect(e.target.checked)} /></SettingsRow>
        <SettingsRow label="Polling interval (ms)"><input type="number" value={props.pollMs} onChange={(e) => props.setPollMs(Number(e.target.value))} /></SettingsRow>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={props.onTest}>Test connection</button>
          <button onClick={props.onSave}>Save connection</button>
          {props.bridgeManaged && <span style={{ color: vars.muted, fontSize: 12 }}>Bridge URL managed by desktop bridgeCtl when available.</span>}
        </div>
      </SettingsSection>

      <SettingsSection title="Display" vars={vars}>
        <SettingsRow label="Theme">
          <select value={props.theme} onChange={(e) => props.setTheme(e.target.value)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Compact mode"><input type="checkbox" checked={props.compactMode} onChange={(e) => props.setCompactMode(e.target.checked)} /></SettingsRow>
        <SettingsRow label="Relative timestamps"><input type="checkbox" checked={props.relativeTime} onChange={(e) => props.setRelativeTime(e.target.checked)} /></SettingsRow>
      </SettingsSection>

      <SettingsSection title="Data / Debug" vars={vars}>
        <SettingsRow label="Log level">
          <select value={props.logLevel} onChange={(e) => props.setLogLevel(e.target.value)}>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </SettingsRow>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={props.onClearCache}>Clear cache</button>
          <button onClick={props.onExportDiagnostics}>Export diagnostics</button>
        </div>
      </SettingsSection>
    </div>
  );
}

function Card({ title, children, vars }) {
  return (
    <div style={{ background: vars.card, border: `1px solid ${vars.border}`, borderRadius: 14, padding: 12, boxShadow: vars.shadow }}>
      {title ? <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div> : null}
      {children}
    </div>
  );
}

function StatCard({ title, value, status, onClick, vars }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', background: vars.card, color: vars.text, border: `1px solid ${vars.border}`, borderRadius: 14, padding: 12, cursor: 'pointer', boxShadow: vars.shadow }}>
      <div style={{ color: vars.muted, fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 700, margin: '4px 0 8px' }}>{value}</div>
      <StatusBadge status={status} />
    </button>
  );
}

function StatusBadge({ status }) {
  const key = (status || 'idle').toLowerCase();
  const c = STATUS_COLORS[key] || STATUS_COLORS.idle;
  return <span style={{ display: 'inline-block', background: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{status}</span>;
}

function AgentListItem({ agent, selected, onClick, formatTs, vars }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', background: selected ? vars.cardAlt : vars.card, color: vars.text, border: `1px solid ${selected ? '#4b75b8' : vars.border}`, borderRadius: 10, padding: 10, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: vars.muted }}>{agent.role}</div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      <div style={{ fontSize: 13, marginTop: 6 }}>{agent.taskText}</div>
      <div style={{ fontSize: 12, color: vars.muted, marginTop: 4 }}>Updated {formatTs(agent.lastUpdated)}</div>
    </button>
  );
}

function SearchInput({ value, onChange, placeholder, vars }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ minWidth: 220, padding: '8px 10px', borderRadius: 10, border: `1px solid ${vars.border}`, background: vars.card, color: vars.text }} />;
}

function FilterChips({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{ borderRadius: 999, padding: '4px 10px', border: '1px solid #3a4558', background: value === o.id ? '#223247' : '#161b22', color: '#c6d4e3', cursor: 'pointer' }}>{o.label}</button>
      ))}
    </div>
  );
}

function DetailsDrawer({ title, children, onClose, vars }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 30 }} onClick={onClose}>
      <div style={{ width: 420, maxWidth: '90vw', background: vars.card, borderLeft: `1px solid ${vars.border}`, padding: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>{title}</strong>
          <button onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActivityFeedItem({ item, onClick, formatTs, vars }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', border: `1px solid ${vars.border}`, background: vars.cardAlt, color: vars.text, borderRadius: 10, padding: 8, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 12, color: vars.muted }}>{formatTs(item.ts)} · {item.agent}</div>
        <StatusBadge status={item.status} />
      </div>
      <div style={{ marginTop: 4 }}>{item.action}</div>
    </button>
  );
}

function SettingsSection({ title, children, vars }) {
  return <Card title={title} vars={vars}><div style={{ display: 'grid', gap: 8 }}>{children}</div></Card>;
}

function SettingsRow({ label, children }) {
  return <label style={{ display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'center', gap: 8 }}><span>{label}</span>{children}</label>;
}

function EmptyState({ title, text, actionLabel, onAction, vars }) {
  return (
    <div style={{ border: `1px dashed ${vars.border}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: vars.muted, fontSize: 13, marginTop: 4 }}>{text}</div>
      {actionLabel && <button style={{ marginTop: 8 }} onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

function KV({ label, value, vars }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: `1px dashed ${vars.border}`, paddingBottom: 5 }}>
      <span style={{ color: vars.muted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{String(value ?? '-')}</span>
    </div>
  );
}

function thStyle(vars) {
  return { textAlign: 'left', color: vars.muted, borderBottom: `1px solid ${vars.border}`, padding: '6px 4px' };
}
function tdStyle(vars) {
  return { borderBottom: `1px solid ${vars.border}`, padding: '6px 4px' };
}

function normalizeTaskStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('fail') || s.includes('abort') || s.includes('error')) return 'failed';
  if (s.includes('queue') || s.includes('pending')) return 'queued';
  if (s.includes('run') || s.includes('active')) return 'running';
  if (s.includes('ok') || s.includes('done') || s.includes('success')) return 'success';
  return 'idle';
}

createRoot(document.getElementById('root')).render(<App />);
