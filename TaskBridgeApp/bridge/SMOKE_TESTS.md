# Smoke tests (UI-overhaul backend contract)

Date: 2026-02-26

## GET /api/dashboard/summary
```bash
curl -sS "http://127.0.0.1:8797/api/dashboard/summary" | jq
```
```json
{
  "contractVersion": "dashboard.v2",
  "totals": {
    "sessions": 9,
    "activeSessions": 7,
    "staleSessions": 1,
    "abortedSessions": 0
  },
  "kpis": {
    "active": 7,
    "running": 5,
    "queued": 1,
    "failed": 0
  },
  "recentActivity": {
    "updatedLast15m": 5,
    "updatedLast60m": 8
  },
  "topAgents": [
    {
      "agentId": "main",
      "agentName": "Plupp",
      "sessions": 3
    },
    {
      "agentId": "qa",
      "agentName": "qa",
      "sessions": 2
    },
    {
      "agentId": "backend",
      "agentName": "backend",
      "sessions": 2
    },
    {
      "agentId": "frontend",
      "agentName": "frontend",
      "sessions": 2
    }
  ],
  "activityFeed": [
    {
      "timestamp": "2026-02-26T22:14:35.874Z",
      "agentName": "Plupp",
      "actionText": "Session aec43fb7-c638-4f5a-ba0a-a0c4a579ab82 updated (direct)",
      "status": "running"
    },
    {
      "timestamp": "2026-02-26T22:14:33.008Z",
      "agentName": "Plupp",
      "actionText": "Session 89828308-8368-418e-80eb-6e525fbe44c8 updated (direct)",
      "status": "running"
    },
    {
      "timestamp": "2026-02-26T22:14:29.214Z",
      "agentName": "qa",
      "actionText": "Session 212729eb-516b-4fec-9cdd-fb27fdd14c22 updated (direct)",
      "status": "running"
    },
    {
      "timestamp": "2026-02-26T22:11:50.776Z",
      "agentName": "backend",
      "actionText": "Session 5c28906f-d22e-406e-9e8e-15206a87b363 updated (direct)",
      "status": "running"
    },
    {
      "timestamp": "2026-02-26T22:11:50.683Z",
      "agentName": "frontend",
      "actionText": "Session 5f1a471e-5c28-438c-ab39-6a6b4cf6158d updated (direct)",
      "status": "running"
    },
    {
      "timestamp": "2026-02-26T21:48:04.667Z",
      "agentName": "backend",
      "actionText": "Session 16ca458f-b728-475f-afe8-2514bb536843 updated (direct)",
      "status": "active"
    },
    {
      "timestamp": "2026-02-26T21:46:46.856Z",
      "agentName": "frontend",
      "actionText": "Session f8309580-2b7b-4e09-8ea7-1d336ed10fa6 updated (direct)",
      "status": "active"
    },
    {
      "timestamp": "2026-02-26T21:30:20.834Z",
      "agentName": "qa",
      "actionText": "Session c0be767c-f4b1-4333-8119-8a07fa7795ea updated (direct)",
      "status": "queued"
    },
    {
      "timestamp": "2026-02-26T14:11:41.385Z",
      "agentName": "Plupp",
      "actionText": "Session 50c0d41d-9f5b-49f3-8104-9e6e3c52ed69 updated (direct)",
      "status": "inactive"
    }
  ],
  "agentsSnapshot": [
    {
      "id": "main",
      "name": "Plupp",
      "emoji": "😌",
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace",
      "isDefault": true,
      "status": "running",
      "statusLabel": "Running",
      "currentTask": {
        "sessionId": "aec43fb7-c638-4f5a-ba0a-a0c4a579ab82",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:14:35.874Z",
        "lastSeenRelative": "just now",
        "totalTokens": 105423,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:14:35.874Z",
        "lastSeenRelative": "just now",
        "stale": false
      },
      "sessionsCount": 3
    },
    {
      "id": "supervisor",
      "name": "supervisor",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-supervisor",
      "isDefault": false,
      "status": "inactive",
      "statusLabel": "Inactive",
      "currentTask": null,
      "heartbeat": {
        "lastSeenAt": null,
        "lastSeenRelative": "unknown",
        "stale": true
      },
      "sessionsCount": 0
    },
    {
      "id": "backend",
      "name": "backend",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-backend",
      "isDefault": false,
      "status": "running",
      "statusLabel": "Running",
      "currentTask": {
        "sessionId": "5c28906f-d22e-406e-9e8e-15206a87b363",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:11:50.776Z",
        "lastSeenRelative": "2m ago",
        "totalTokens": null,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:11:50.776Z",
        "lastSeenRelative": "2m ago",
        "stale": false
      },
      "sessionsCount": 2
    },
    {
      "id": "frontend",
      "name": "frontend",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-frontend",
      "isDefault": false,
      "status": "running",
      "statusLabel": "Running",
      "currentTask": {
        "sessionId": "5f1a471e-5c28-438c-ab39-6a6b4cf6158d",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:11:50.683Z",
        "lastSeenRelative": "2m ago",
        "totalTokens": null,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:11:50.683Z",
        "lastSeenRelative": "2m ago",
        "stale": false
      },
      "sessionsCount": 2
    },
    {
      "id": "qa",
      "name": "qa",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-qa",
      "isDefault": false,
      "status": "running",
      "statusLabel": "Running",
      "currentTask": {
        "sessionId": "212729eb-516b-4fec-9cdd-fb27fdd14c22",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:14:29.214Z",
        "lastSeenRelative": "just now",
        "totalTokens": 37022,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:14:29.214Z",
        "lastSeenRelative": "just now",
        "stale": false
      },
      "sessionsCount": 2
    }
  ],
  "healthPanel": {
    "connection": {
      "openclawReachable": true,
      "status": "connected",
      "lastSuccessAt": "2026-02-26T22:14:38.265Z",
      "lastFailureAt": null,
      "consecutiveFailures": 0,
      "latencyP95Ms": 2647
    },
    "system": {
      "uptimeSec": 15,
      "requests": 7,
      "errors": 0,
      "avgLatencyMs": 724.17,
      "cacheHits": 4,
      "cacheMisses": 6,
      "circuitBreakers": {
        "sessions": {
          "state": "closed",
          "failures": 0,
          "cooldownUntil": null
        },
        "agents": {
          "state": "closed",
          "failures": 0,
          "cooldownUntil": null
        }
      },
      "healthy": true
    }
  },
  "diagnostics": {
    "cacheAgeMs": {
      "sessions": 0,
      "agents": 0
    },
    "openclawReachable": true,
    "lastSuccessAt": "2026-02-26T22:14:38.265Z",
    "consecutiveFailures": 0
  }
}
```

## GET /api/dashboard/activity?limit=2
```bash
curl -sS "http://127.0.0.1:8797/api/dashboard/activity?limit=2" | jq
```
```json
{
  "contractVersion": "dashboard.activity.v1",
  "items": [
    {
      "timestamp": "2026-02-26T22:14:35.874Z",
      "agentName": "Plupp",
      "actionText": "Session aec43fb7-c638-4f5a-ba0a-a0c4a579ab82 updated (direct)",
      "status": "running"
    },
    {
      "timestamp": "2026-02-26T22:14:33.008Z",
      "agentName": "Plupp",
      "actionText": "Session 89828308-8368-418e-80eb-6e525fbe44c8 updated (direct)",
      "status": "running"
    }
  ],
  "total": 2,
  "limit": 2,
  "diagnostics": {
    "cacheAgeMs": {
      "sessions": 104,
      "agents": 8
    }
  }
}
```

## GET /api/dashboard/agents
```bash
curl -sS "http://127.0.0.1:8797/api/dashboard/agents" | jq
```
```json
{
  "contractVersion": "dashboard.agents.v1",
  "items": [
    {
      "id": "main",
      "name": "Plupp",
      "emoji": "😌",
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace",
      "isDefault": true,
      "status": "running",
      "statusLabel": "Running",
      "currentTask": {
        "sessionId": "aec43fb7-c638-4f5a-ba0a-a0c4a579ab82",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:14:35.874Z",
        "lastSeenRelative": "just now",
        "totalTokens": 105423,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:14:35.874Z",
        "lastSeenRelative": "just now",
        "stale": false
      },
      "sessionsCount": 3
    },
    {
      "id": "supervisor",
      "name": "supervisor",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-supervisor",
      "isDefault": false,
      "status": "inactive",
      "statusLabel": "Inactive",
      "currentTask": null,
      "heartbeat": {
        "lastSeenAt": null,
        "lastSeenRelative": "unknown",
        "stale": true
      },
      "sessionsCount": 0
    },
    {
      "id": "backend",
      "name": "backend",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-backend",
      "isDefault": false,
      "status": "running",
      "statusLabel": "Running",
      "currentTask": {
        "sessionId": "5c28906f-d22e-406e-9e8e-15206a87b363",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:11:50.776Z",
        "lastSeenRelative": "2m ago",
        "totalTokens": null,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:11:50.776Z",
        "lastSeenRelative": "2m ago",
        "stale": false
      },
      "sessionsCount": 2
    },
    {
      "id": "frontend",
      "name": "frontend",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-frontend",
      "isDefault": false,
      "status": "running",
      "statusLabel": "Running",
      "currentTask": {
        "sessionId": "5f1a471e-5c28-438c-ab39-6a6b4cf6158d",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:11:50.683Z",
        "lastSeenRelative": "2m ago",
        "totalTokens": null,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:11:50.683Z",
        "lastSeenRelative": "2m ago",
        "stale": false
      },
      "sessionsCount": 2
    },
    {
      "id": "qa",
      "name": "qa",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-qa",
      "isDefault": false,
      "status": "running",
      "statusLabel": "Running",
      "currentTask": {
        "sessionId": "212729eb-516b-4fec-9cdd-fb27fdd14c22",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:14:29.214Z",
        "lastSeenRelative": "just now",
        "totalTokens": 37022,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:14:29.214Z",
        "lastSeenRelative": "just now",
        "stale": false
      },
      "sessionsCount": 2
    }
  ],
  "total": 5
}
```

## GET /api/dashboard/health
```bash
curl -sS "http://127.0.0.1:8797/api/dashboard/health" | jq
```
```json
{
  "contractVersion": "dashboard.health.v1",
  "connection": {
    "openclawReachable": true,
    "status": "connected",
    "lastSuccessAt": "2026-02-26T22:14:38.265Z",
    "lastFailureAt": null,
    "consecutiveFailures": 0,
    "latencyP95Ms": 2647
  },
  "system": {
    "uptimeSec": 15,
    "requests": 10,
    "errors": 0,
    "avgLatencyMs": 668.56,
    "cacheHits": 8,
    "cacheMisses": 6,
    "circuitBreakers": {
      "sessions": {
        "state": "closed",
        "failures": 0,
        "cooldownUntil": null
      },
      "agents": {
        "state": "closed",
        "failures": 0,
        "cooldownUntil": null
      }
    },
    "healthy": true
  },
  "cacheAgeMs": {
    "sessions": 121,
    "agents": 25
  },
  "version": {
    "commit": "4c00e29",
    "branch": "master"
  }
}
```

## GET /api/agents/main
```bash
curl -sS "http://127.0.0.1:8797/api/agents/main" | jq
```
```json
{
  "contractVersion": "agent.detail.v1",
  "id": "main",
  "name": "Plupp",
  "emoji": "😌",
  "model": "openai-codex/gpt-5.3-codex",
  "workspace": "/home/hugog/.openclaw/workspace",
  "isDefault": true,
  "status": "running",
  "currentTask": {
    "sessionId": "aec43fb7-c638-4f5a-ba0a-a0c4a579ab82",
    "kind": "direct",
    "model": "gpt-5.3-codex",
    "updatedAt": "2026-02-26T22:14:35.874Z",
    "lastSeenRelative": "just now",
    "totalTokens": 105423,
    "contextTokens": 272000
  },
  "heartbeat": {
    "lastSeenAt": "2026-02-26T22:14:35.874Z",
    "lastSeenRelative": "just now",
    "stale": false
  },
  "recentTasks": [
    {
      "sessionId": "aec43fb7-c638-4f5a-ba0a-a0c4a579ab82",
      "key": "agent:main:telegram:direct:8618693036",
      "status": "running",
      "kind": "direct",
      "model": "gpt-5.3-codex",
      "updatedAt": "2026-02-26T22:14:35.874Z",
      "lastSeenRelative": "just now",
      "tokens": {
        "total": 105423,
        "context": 272000
      }
    },
    {
      "sessionId": "89828308-8368-418e-80eb-6e525fbe44c8",
      "key": "agent:main:main",
      "status": "running",
      "kind": "direct",
      "model": "gpt-5.3-codex",
      "updatedAt": "2026-02-26T22:14:33.008Z",
      "lastSeenRelative": "just now",
      "tokens": {
        "total": 135327,
        "context": 272000
      }
    },
    {
      "sessionId": "50c0d41d-9f5b-49f3-8104-9e6e3c52ed69",
      "key": "agent:main:telegram:slash:8618693036",
      "status": "inactive",
      "kind": "direct",
      "model": "gpt-5.3-codex",
      "updatedAt": "2026-02-26T14:11:41.385Z",
      "lastSeenRelative": "8h ago",
      "tokens": {
        "total": null,
        "context": 272000
      }
    }
  ],
  "recentLogs": [
    {
      "timestamp": "2026-02-26T22:14:35.874Z",
      "level": "info",
      "message": "Task aec43fb7-c638-4f5a-ba0a-a0c4a579ab82 updated (direct)"
    },
    {
      "timestamp": "2026-02-26T22:14:33.008Z",
      "level": "info",
      "message": "Task 89828308-8368-418e-80eb-6e525fbe44c8 updated (direct)"
    },
    {
      "timestamp": "2026-02-26T14:11:41.385Z",
      "level": "info",
      "message": "Task 50c0d41d-9f5b-49f3-8104-9e6e3c52ed69 updated (direct)"
    }
  ],
  "sessionsCount": 3
}
```

## GET /api/agents
```bash
curl -sS "http://127.0.0.1:8797/api/agents" | jq
```
```json
{
  "items": [
    {
      "id": "main",
      "name": "Plupp",
      "emoji": "😌",
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace",
      "isDefault": true,
      "status": "running",
      "currentTask": {
        "sessionId": "aec43fb7-c638-4f5a-ba0a-a0c4a579ab82",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:14:35.874Z",
        "lastSeenRelative": "just now",
        "totalTokens": 105423,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:14:35.874Z",
        "lastSeenRelative": "just now",
        "stale": false
      }
    },
    {
      "id": "supervisor",
      "name": "supervisor",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-supervisor",
      "isDefault": false,
      "status": "inactive",
      "currentTask": null,
      "heartbeat": {
        "lastSeenAt": null,
        "lastSeenRelative": "unknown",
        "stale": true
      }
    },
    {
      "id": "backend",
      "name": "backend",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-backend",
      "isDefault": false,
      "status": "running",
      "currentTask": {
        "sessionId": "5c28906f-d22e-406e-9e8e-15206a87b363",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:11:50.776Z",
        "lastSeenRelative": "2m ago",
        "totalTokens": null,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:11:50.776Z",
        "lastSeenRelative": "2m ago",
        "stale": false
      }
    },
    {
      "id": "frontend",
      "name": "frontend",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-frontend",
      "isDefault": false,
      "status": "running",
      "currentTask": {
        "sessionId": "5f1a471e-5c28-438c-ab39-6a6b4cf6158d",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:11:50.683Z",
        "lastSeenRelative": "2m ago",
        "totalTokens": null,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:11:50.683Z",
        "lastSeenRelative": "2m ago",
        "stale": false
      }
    },
    {
      "id": "qa",
      "name": "qa",
      "emoji": null,
      "model": "openai-codex/gpt-5.3-codex",
      "workspace": "/home/hugog/.openclaw/workspace-qa",
      "isDefault": false,
      "status": "running",
      "currentTask": {
        "sessionId": "212729eb-516b-4fec-9cdd-fb27fdd14c22",
        "kind": "direct",
        "model": "gpt-5.3-codex",
        "updatedAt": "2026-02-26T22:14:29.214Z",
        "lastSeenRelative": "just now",
        "totalTokens": 37022,
        "contextTokens": 272000
      },
      "heartbeat": {
        "lastSeenAt": "2026-02-26T22:14:29.214Z",
        "lastSeenRelative": "just now",
        "stale": false
      }
    }
  ]
}
```

## GET /api/healthz
```bash
curl -sS "http://127.0.0.1:8797/api/healthz" | jq
```
```json
{
  "ok": true,
  "service": "task-bridge",
  "now": "2026-02-26T22:14:38.311Z",
  "openclawReachable": true,
  "lastSuccessAt": "2026-02-26T22:14:38.265Z",
  "consecutiveFailures": 0,
  "latencyP95Ms": 2647,
  "breakerOpen": false
}
```

