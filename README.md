# HR RAG Dashboard — AI-Powered Candidate Risk Tracking

A comprehensive **Next.js 14** application for automating RAG (Red/Amber/Green) status tracking of offered candidates, with AI-powered insights, automated scoring, real-time dashboards, and full audit trails.

## Features

### Core Capabilities
- **Automated RAG Scoring** — 7 weighted parameters with fully automated computation
- **AI-Powered Insights** — Rule-based + OpenAI GPT-4 risk prediction and recommendations
- **Dual Dashboards** — Business/DU Head view (read-only) and TA Specialist view (editable)
- **Real-time Alerts** — Automated reminders for resignation proof, connects, KYC, LWD, and more
- **Full Audit Trail** — Complete history of score changes, RAG transitions, remarks, and reminders
- **Role-Based Access** — TA Specialist vs Business Head with appropriate permissions

### RAG Scoring Parameters
| Parameter | Weight | Timeline |
|---|---|---|
| Resignation proof | ±10% | Within 48 hours of offer |
| Pre-joining Connect 1 | ±10% | At 33% of DOJ duration |
| Pre-joining Connect 2 | ±10% | At 66% of DOJ duration |
| KYC Completion | ±5% | 2 weeks before DOJ |
| LWD Confirmation | ±5% | 1 week before DOJ |
| Counter Offer | ±5% | Dynamic (every 20% of remaining days) |
| Job Portal Activity | ±5% | Dynamic (every 20% of remaining days) |

### RAG Color Rules
- **Green (≥60%)** — High joining probability
- **Amber (50-59%)** — Needs attention
- **Red (<50%)** — High risk of drop
- **Grey** — RAG not yet activated (buffer period)

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** SQLite via Prisma ORM (easily swappable to PostgreSQL)
- **Auth:** NextAuth.js v4 with JWT sessions + bcrypt password hashing
- **Validation:** Zod schemas for env vars and API input
- **Styling:** TailwindCSS with custom design system
- **Charts:** Recharts
- **Icons:** Lucide React
- **AI:** OpenAI GPT-4 (optional, falls back to rule-based insights)
- **Deployment:** Docker + docker-compose ready

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
```bash
npx prisma db push
```

### 3. Seed Demo Data
```bash
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Open in Browser
Navigate to [http://localhost:3000](http://localhost:3000)

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=""                    # Optional - enables enhanced AI insights
NEXTAUTH_SECRET="your-secret-here"   # Required - min 8 chars, generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"  # Required - your app URL
LOG_LEVEL="info"                      # Optional - debug, info, warn, error
```

Environment variables are validated at startup using Zod. Missing or invalid values will log errors (and throw in production).

## Project Structure

```
hr-rag-dashboard/
├── prisma/
│   ├── schema.prisma          # Database schema (10 models)
│   └── seed.ts                # Demo data with 8 candidates (bcrypt hashed passwords)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Login with NextAuth credentials
│   │   ├── error.tsx          # Global error boundary
│   │   ├── not-found.tsx      # 404 page
│   │   ├── loading.tsx        # Global loading spinner
│   │   ├── layout.tsx         # Root layout with SessionProvider
│   │   ├── dashboard/
│   │   │   ├── page.tsx       # Main dashboard (Business + TA views)
│   │   │   └── loading.tsx    # Dashboard skeleton loader
│   │   ├── candidates/
│   │   │   └── [id]/page.tsx  # Candidate detail with score timeline
│   │   └── api/
│   │       ├── auth/[...nextauth]/ # NextAuth API route
│   │       ├── health/        # Health check endpoint
│   │       ├── candidates/    # CRUD + interactions (validated + auth-protected)
│   │       ├── rag/compute/   # Batch RAG recomputation
│   │       ├── alerts/        # Alert management
│   │       ├── audit/         # Audit log retrieval
│   │       ├── dashboard/     # Dashboard statistics
│   │       └── ai/insights/   # AI-powered insights
│   ├── components/
│   │   ├── header.tsx         # App header with NextAuth signOut
│   │   └── providers.tsx      # SessionProvider wrapper
│   ├── lib/
│   │   ├── auth.ts            # NextAuth config (credentials + JWT)
│   │   ├── api-auth.ts        # Server-side auth helpers
│   │   ├── env.ts             # Zod environment validation
│   │   ├── validations.ts     # Zod schemas for API input
│   │   ├── rate-limit.ts      # In-memory rate limiting utility
│   │   ├── logger.ts          # Structured logging (JSON in prod)
│   │   ├── rag-engine.ts      # Core RAG scoring logic
│   │   ├── alert-engine.ts    # Alert generation logic
│   │   ├── ai-insights.ts     # AI insights (local + OpenAI)
│   │   ├── prisma.ts          # Database client
│   │   └── utils.ts           # Utility functions
│   ├── middleware.ts           # Route protection (NextAuth middleware)
│   └── types/
│       ├── index.ts           # TypeScript type definitions
│       └── next-auth.d.ts     # NextAuth type augmentation
├── .env.example               # Environment variable template
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Docker Compose with PostgreSQL
├── .dockerignore
├── next.config.js             # Security headers, standalone output
├── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Health check (database connectivity, uptime) |
| POST | `/api/auth/[...nextauth]` | No | NextAuth authentication endpoints |
| GET | `/api/candidates` | Yes | List candidates (Zod-validated query params) |
| POST | `/api/candidates` | Yes | Create new candidate (Zod-validated body) |
| GET | `/api/candidates/:id` | Yes | Get candidate details |
| PATCH | `/api/candidates/:id` | Yes | Update candidate (auto-recomputes RAG) |
| POST | `/api/candidates/:id/interactions` | Yes | Log interaction (with sentiment analysis) |
| POST | `/api/rag/compute` | Yes | Batch recompute all RAG scores |
| GET | `/api/alerts` | Yes | List alerts (Zod-validated query params) |
| PATCH | `/api/alerts` | Yes | Update alert status (Zod-validated body) |
| GET | `/api/dashboard/stats` | Yes | Dashboard statistics |
| GET | `/api/ai/insights` | Yes | AI-generated insights |
| GET | `/api/audit` | Yes | Audit trail logs (Zod-validated query params) |

All authenticated endpoints return `401 Unauthorized` if no valid session is present. Validation errors return `400` with structured error details.

## Usage

### Login
Log in with realistic HR credentials on the login page:

#### TA Specialists (Full Access)
- **Ka** — `ka@techcorp.com` — Technology sector
- **Go** — `go@techcorp.com` — BFSI sector

#### Business Heads (Read-Only)
- **Prem** — `prem@techcorp.com` — Technology sector
- **Paul** — `paul@techcorp.com` — BFSI sector

#### System Administrator
- **Admin** — `admin@techcorp.com` — Full system access

*See [USER_GUIDE.md](./USER_GUIDE.md) for complete user guide and feature documentation.*

### Dashboard Tabs
1. **Overview** — KPI cards, RAG pie chart, trend lines, sector breakdown, top risks
2. **Candidates** — Searchable/filterable table with inline status indicators
3. **Alerts** — Pending action items with priority indicators
4. **AI Insights** — Risk predictions, patterns, and recommendations
5. **Audit Trail** — Complete history of all system actions

### Candidate Detail
Click any candidate to see:
- Score parameter breakdown (7 weighted parameters)
- Score timeline chart with reference lines
- Interaction history with sentiment analysis
- RAG transition history
- Active alerts

## Extending

### Switch to PostgreSQL
Update `.env`:
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/hr_rag"
```
Update `prisma/schema.prisma` provider to `"postgresql"`, then run `npx prisma db push`.

### Enable AI Insights
Set your OpenAI API key in `.env`:
```env
OPENAI_API_KEY="sk-..."
```
The system will automatically use GPT-4 for enhanced insights alongside rule-based analysis.

### SR Integration
The candidate creation API (`POST /api/candidates`) is ready to receive data from your SR system. Set up a webhook or scheduled sync to push candidate data.

## Production Deployment

### Docker (Recommended)
```bash
# Build and start with PostgreSQL
docker-compose up -d

# Run migrations and seed
docker-compose exec app npx prisma db push
docker-compose exec app npx tsx prisma/seed.ts
```

The app will be available at `http://localhost:3000` with a PostgreSQL database.

### Manual Deployment
```bash
# Install dependencies
npm ci

# Set production environment variables
cp .env.example .env
# Edit .env with production values

# Build
npm run build

# Start
npm start
```

### Available Scripts
| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client + production build |
| `npm start` | Start production server |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:setup` | Push schema + seed database |
| `npm run db:migrate` | Run Prisma migrations (production) |
| `npm run db:migrate:dev` | Create + run migrations (development) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:reset` | Reset database (destructive) |

## Production Readiness

### Security
- **Authentication** — NextAuth.js with JWT sessions (8h expiry), bcrypt-hashed passwords
- **Route Protection** — Middleware guards `/dashboard`, `/candidates`, and `/api/*` routes
- **API Validation** — All endpoints validate input with Zod schemas; structured error responses
- **Security Headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **No Powered-By Header** — `X-Powered-By` header disabled

### Reliability
- **Health Check** — `GET /api/health` returns database status, latency, uptime, version
- **Error Boundaries** — Global `error.tsx` catches React errors with retry capability
- **404 Page** — Custom not-found page with navigation
- **Loading States** — Global and dashboard-specific skeleton loaders
- **Structured Logging** — JSON logs in production, human-readable in development
- **Rate Limiting** — In-memory rate limiter utility (ready for integration)

### Environment
- **Env Validation** — Zod schema validates all environment variables at startup
- **Strict TypeScript** — Full strict mode with no implicit any
- **Standalone Output** — Optimized Docker builds with `output: 'standalone'`
