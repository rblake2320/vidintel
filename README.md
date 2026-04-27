# VidIntel

Convert any YouTube URL or raw transcript into structured, fluff-free training output using AI — in under 60 seconds.

**Four output formats:** Bullet Plan · Training SOP · Study Guide · Key Concepts

---

## Architecture

```
Vercel (Next.js 15)  →  Railway (FastAPI)  →  Redis (Celery queue)
                                ↓
                         Celery Worker  →  Anthropic Claude
                                ↓
                         Supabase (PostgreSQL)
```

| Service | Host | Notes |
|---------|------|-------|
| Frontend | Vercel | Next.js 15 App Router, TypeScript, Tailwind |
| Backend API | Railway | FastAPI + Gunicorn/Uvicorn |
| Background worker | Railway | Celery worker (same Docker image) |
| Redis | Railway | Job queue + rate limiting |
| Database | Supabase | PostgreSQL + Auth |

---

## Local Development

### Prerequisites
- Python 3.12
- Node.js 20+
- Docker Desktop

### Backend

```bash
cd backend
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET

# Start Postgres + Redis via Docker
docker-compose up -d postgres redis

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000

# Start Celery worker (separate terminal)
celery -A app.tasks.celery_tasks.celery_app worker --loglevel=info
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev   # http://localhost:3000
```

### Full stack with Docker Compose

```bash
cd backend
docker-compose up   # API + Celery worker + Redis + Postgres
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `APP_ENV` | `development` or `production` |
| `SECRET_KEY` | Random 256-bit base64 string |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret (Settings → API) |
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host/db` |
| `REDIS_URL` | `redis://localhost:6379/0` |
| `ANTHROPIC_API_KEY` | Claude API key (primary LLM) |
| `OPENAI_API_KEY` | OpenAI key (Whisper fallback only) |
| `SENTRY_DSN` | Sentry DSN (optional) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Service health check |
| POST | `/api/process` | JWT | Submit a processing job |
| GET | `/api/jobs/{id}` | JWT | Poll job status + output |
| GET | `/api/jobs/{id}/download/md` | JWT | Download output as Markdown |
| GET | `/api/jobs/{id}/download/pdf` | JWT | Download output as PDF |
| GET | `/api/sessions` | JWT | List user's session history |
| DELETE | `/api/sessions/{id}` | JWT | Delete a session |

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

Tests mock all LLM and transcript API calls — no real API keys needed.

---

## Deployment

### Backend → Railway

1. Create a Railway project with three services: API, Worker, Redis
2. Set all environment variables from the table above
3. Connect GitHub repo; Railway auto-deploys on push to `main`

### Frontend → Vercel

1. Import the `frontend/` directory as a Vercel project
2. Set `NEXT_PUBLIC_*` environment variables
3. Deploy

### GitHub Secrets required for CI/CD

| Secret | Used by |
|--------|---------|
| `RAILWAY_TOKEN` | `deploy.yml` |
| `VERCEL_TOKEN` | `deploy.yml` |
| `VERCEL_ORG_ID` | `deploy.yml` |
| `VERCEL_PROJECT_ID` | `deploy.yml` |

---

## Pre-Deploy Checklist

- [ ] Supabase project created; RLS enabled on `sessions` and `jobs` tables
- [ ] Alembic migrations run against production DB: `alembic upgrade head`
- [ ] All env vars set in Railway and Vercel dashboards
- [ ] GitHub secrets set
- [ ] Sentry DSN configured (optional but recommended)
- [ ] Smoke test: create account → process 3 videos → download outputs → verify history
