import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const API = 'http://127.0.0.1:8787';

function App() {
  const [health, setHealth] = useState('loading...');
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const h = await fetch(`${API}/health`).then((r) => r.json());
        setHealth(h.ok ? 'bridge online' : 'bridge issue');
      } catch {
        setHealth('bridge offline');
      }

      try {
        const a = await fetch(`${API}/api/agents`).then((r) => r.json());
        setAgents(a.items || []);
      } catch {
        // keep last
      }
    };

    const refreshTasks = async () => {
      try {
        const data = await fetch(`${API}/api/tasks?limit=100&offset=0`).then((r) => r.json());
        setTasks(data.items || []);
      } catch {
        // keep last
      }
    };

    load();
    refreshTasks();
    const timer = setInterval(refreshTasks, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main style={{ fontFamily: 'Segoe UI, sans-serif', padding: 16 }}>
      <h1>Task Desktop</h1>
      <p>Status: {health}</p>

      <h2>Agents ({agents.length})</h2>
      <ul>
        {agents.map((a) => (
          <li key={a.id}>
            {a.emoji ? `${a.emoji} ` : ''}
            <strong>{a.name}</strong> ({a.id}) — {a.model || 'unknown model'}
            {a.isDefault ? ' [default]' : ''}
          </li>
        ))}
      </ul>

      <h2>Tasks / Sessions ({tasks.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table cellPadding="6" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th align="left">Agent</th>
              <th align="left">Kind</th>
              <th align="left">Session Key</th>
              <th align="left">Status</th>
              <th align="right">Age (s)</th>
              <th align="right">Tokens</th>
              <th align="left">Model</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid #ddd' }}>
                <td>{t.agentId}</td>
                <td>{t.kind}</td>
                <td>{t.key}</td>
                <td>{t.status}</td>
                <td align="right">{t.ageMs != null ? Math.round(t.ageMs / 1000) : '-'}</td>
                <td align="right">{t.totalTokens ?? '-'}</td>
                <td>{t.model || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
