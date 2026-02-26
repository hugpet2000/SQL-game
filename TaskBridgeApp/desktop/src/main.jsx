import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [health, setHealth] = useState('loading...');
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const h = await fetch('http://127.0.0.1:8787/health').then(r => r.json());
        setHealth(h.ok ? 'bridge online' : 'bridge issue');
      } catch {
        setHealth('bridge offline');
      }
    };
    load();
    const timer = setInterval(async () => {
      try {
        const data = await fetch('http://127.0.0.1:8787/api/tasks?limit=100&offset=0').then(r => r.json());
        setTasks(data.items || []);
      } catch {
        // keep last
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main style={{ fontFamily: 'Segoe UI, sans-serif', padding: 16 }}>
      <h1>Task Desktop</h1>
      <p>Status: {health}</p>
      <p>Tasks loaded: {tasks.length}</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
