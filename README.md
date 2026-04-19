# 🧠 Memory-First System Design Agent

> **A senior AI architect that remembers every decision you've ever made.**

An AI agent powered by **Hindsight long-term memory**, **Claude (Anthropic)**, **Express.js**, and **MySQL**.  
Every time a user submits an app idea, the agent recalls relevant past preferences, generates a full implementation blueprint, then stores new durable memories for the next session.

---
## Linkdin Article 

https://www.linkedin.com/pulse/building-system-design-ai-agent-archmind-goungoppula-hari-prasad-goud-jrvac


## Architecture Overview


```
User Browser (HTML/CSS/JS)
        ↓  POST /api/generate-design
Express Backend (Node.js)
        ↓  recallMemories(userId, idea)
Hindsight Memory Service        ← per-user bank: "user-{userId}"
        ↓  idea + recalled context
Claude (Anthropic API)          ← 4-stage orchestrated prompting
        ↓  structured JSON report
Express
  ├── saveDesignRun()  → MySQL (design_runs, projects)
  └── retainMemories() → Hindsight (new durable memories)
        ↓
Frontend renders:
  ✦ Memory Recalled (hero)
  ✦ Full system design blueprint
  ✦ Memory Learned (hero)
```

---

## Project Structure

```
memory-design-agent/
├── frontend/
│   ├── index.html         Single-page UI
│   ├── styles.css         Dark editorial theme
│   └── app.js             Fetch + render logic
│
├── backend/
│   ├── server.js          Express entry point
│   ├── routes/
│   │   └── design.js      POST /api/generate-design
│   └── services/
│       ├── hindsightMemory.js   Hindsight recall + retain + SQL fallback
│       ├── llmOrchestrator.js   4-stage Claude prompting
│       └── sqlPersistence.js    MySQL pool + helpers
│
├── schema/
│   └── schema.sql         MySQL schema (users, projects, design_runs, memory_cache)
│
├── .env.example           All required environment variables
└── README.md
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.0.0 |
| MySQL | ≥ 8.0 (or MariaDB 10.6+) |
| Anthropic API key | [console.anthropic.com](https://console.anthropic.com) |
| Hindsight (self-hosted) | See below |

---

## Quick Start

### 1. Clone & install

```bash
git clone <your-repo> memory-design-agent
cd memory-design-agent/backend
npm install
```

### 2. Configure environment

```bash
cp ../.env.example .env
# Edit .env with your real keys
```

Required variables:
```
ANTHROPIC_API_KEY=sk-ant-...
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=memory_design_agent
HINDSIGHT_BASE_URL=http://localhost:8000
```

### 3. Set up MySQL

```bash
mysql -u root -p < ../schema/schema.sql
```

This creates:
- `users` — tracks user identities
- `projects` — groups design runs by app context
- `design_runs` — full report + memory JSON per generation
- `hindsight_memory_cache` — SQL fallback when Hindsight is offline

### 4. Start Hindsight (long-term memory)

Hindsight is an open-source memory layer that provides semantic recall and retention.

**Option A — Docker (recommended):**
```bash
# Check Hindsight's GitHub for the latest docker-compose
docker-compose up -d hindsight
```

**Option B — Run locally:**
```bash
pip install hindsight-server
hindsight-server --port 8000
```

**Option C — Use the SQL fallback (no Hindsight installed):**  
If Hindsight is unreachable, the service automatically falls back to keyword-based recall from the `hindsight_memory_cache` SQL table. Memory will still be stored and retrieved — just without semantic search.

### 5. Start the backend

```bash
cd backend
npm run dev       # dev with nodemon
# or
npm start         # production
```

Backend runs at: `http://localhost:3001`

### 6. Open the frontend

```bash
# Option A: just open the file
open frontend/index.html

# Option B: serve locally (recommended to avoid CORS)
npx serve frontend -p 3000
```

---

## API Reference

### `POST /api/generate-design`

```json
Request:
{
  "userId": "demo-user-1",
  "idea": "Build a food delivery app for local restaurants"
}

Response:
{
  "runId": 42,
  "memoryRecalled": [
    { "key": "preferred_backend", "value": "user prefers Express.js", "score": 0.92 }
  ],
  "projectSummary": "...",
  "userRoles": ["Customer", "Driver", "Restaurant Owner"],
  "coreFeatures": [{ "name": "...", "description": "...", "priority": "must-have" }],
  "suggestedImprovements": [...],
  "functionalRequirements": [...],
  "nonFunctionalRequirements": [...],
  "systemModules": [...],
  "architectureFlow": [...],
  "databaseEntities": [...],
  "apiEndpoints": [...],
  "developmentPlan": [...],
  "deploymentPlan": [...],
  "assemblyGuide": [...],
  "memoryLearned": [
    { "key": "preferred_stack", "value": "user chose Express + React Native" }
  ],
  "meta": { "durationMs": 4200, "generatedAt": "2025-01-01T00:00:00Z" }
}
```

### `GET /api/health`

```json
{ "status": "ok", "timestamp": "..." }
```

### `GET /api/history/:userId`

Returns the 10 most recent design runs for a user.

---

## Demo Walkthrough

### Round 1 — First Session

1. Enter `demo-user-1` as your identity
2. Click **✦ Load Example** for a food delivery app idea
3. Click **Generate Design**
4. Observe: **Memory Recalled** section shows "No prior memory" (first run)
5. Observe: **Memory Learned** section shows 5–8 new memories extracted

### Round 2 — Second Session (Memory in Action)

1. Keep the same user ID (`demo-user-1`)
2. Enter: *"Now improve the food delivery app — add real-time GPS tracking and a loyalty rewards system, keeping the same stack and constraints as before"*
3. Click **Generate Design**
4. Observe: **Memory Recalled** now shows your previous preferences (Express backend, MVP-first, etc.)
5. Observe: The generated architecture reuses your chosen stack and doesn't contradict prior decisions

---

## Hindsight Memory Keys (examples stored)

| Key | Example Value |
|---|---|
| `preferred_backend` | user prefers Express.js with Node 18+ |
| `preferred_frontend` | user prefers HTML/CSS/JS (no React) |
| `deployment_preference` | user prefers Railway or Vercel for low cost |
| `build_style` | MVP-first, modular monolith before microservices |
| `project_context` | hackathon-focused, needs to ship in 48h |
| `database_preference` | user chose MySQL for relational data |
| `budget_preference` | low-cost deployment (free tier first) |
| `architecture_style` | user prefers REST over GraphQL |

---

## Customisation

- **Change LLM**: Update `MODEL` in `llmOrchestrator.js`
- **Add more memory keys**: Edit the Stage 4 memory extraction prompt
- **Connect a different frontend**: The backend is CORS-enabled; point any frontend at `POST /api/generate-design`
- **Scale the DB**: Swap `mysql2` for a PlanetScale or RDS connection string — no code changes needed

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express server port |
| `ANTHROPIC_API_KEY` | — | Required for LLM calls |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | — | MySQL password |
| `DB_NAME` | `memory_design_agent` | MySQL database name |
| `HINDSIGHT_BASE_URL` | `http://localhost:8000` | Hindsight service URL |
| `HINDSIGHT_API_KEY` | — | Auth key (optional for local) |
| `MEMORY_RECALL_LIMIT` | `10` | Max memories recalled per request |
| `MEMORY_SCORE_THRESHOLD` | `0.5` | Min relevance score (0–1) |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |

---

## License

MIT
