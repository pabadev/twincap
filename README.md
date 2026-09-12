# TwinCap

Personal-finance and small-business management SaaS built on Next.js 16 with a hexagonal (ports & adapters) architecture.

Manage accounts and movements, move money between your own accounts, track credits received and granted, register payables, and run a point-of-sale system with a catalog, clients, and sales.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.3.4 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript 5 (strict) |
| Database | MongoDB (Mongoose 8 ODM) — Atlas M0 replica set |
| Auth | jose (JWE A256GCM sessions), bcryptjs |
| Validation | Zod 4 |
| Email | Resend (transactional; console fallback in development) |
| Icons | lucide-react |
| Testing | Vitest (unit + integration), Playwright (E2E) |
| Deployment | Vercel |

## Architecture

TwinCap follows **hexagonal architecture** with strict layer separation:

```
src/
├── core/
│   ├── domain/                    # Entities and value objects (zero framework imports)
│   │   ├── account.ts, movement.ts, transfer.ts
│   │   ├── credit-received.ts, credit-granted.ts, payable.ts
│   │   ├── sale.ts, catalog.ts, client.ts
│   │   ├── category.ts, currency.ts, money.ts
│   │   ├── workspace.ts, membership.ts, user.ts
│   │   └── errors.ts, repositories.ts
│   └── application/               # Use cases (orchestrate domain + ports)
│       ├── accounts/, movements/, transfers/, categories/
│       ├── credits-received/, credits-granted/, payables/
│       ├── catalog/, sales/, clients/, dashboard/, auth/
│       ├── balance-from-movements.ts, compute-live-balance.ts
│       ├── compute-activos-pasivos.ts, economic-result.ts
│       └── ports.ts               # Repository/service interfaces
│
├── infrastructure/                # Framework adapters
│   ├── models/                    # Mongoose schemas + indexes
│   ├── repositories/              # Repository implementations
│   ├── mappers/                   # Document ↔ entity mappers
│   ├── auth/                      # Password hasher, session manager, rate limiter
│   ├── db/                        # Mongoose connection singleton
│   ├── config/                    # Zod-validated env (fail-fast)
│   └── monitoring/               # Error monitoring + audit trail
│
├── app/                           # Next.js App Router (routes + server actions)
│   ├── (auth)/                    # login, register, forgot/reset password, verify email
│   ├── (main)/                    # Authenticated shell (dashboard, accounts, movements,
│   │                              #   transfers, categories, credits, payables, clients, POS, profile)
│   ├── (legal)/                   # privacy, terms, cookies, data-policy
│   └── (analytics)/               # allowlisted product metrics
│
├── components/                    # UI primitives (components/ui) + feature components
└── i18n/                          # Custom es/en localization
```

**Dependency rule**: `core/domain` has zero imports. `core/application` imports only `domain`. `infrastructure` implements the ports declared in `core/application/ports.ts`. `app` wires everything together but pages never reach into repositories directly.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 11+
- MongoDB Atlas account — the M0 shared tier is a replica set and supports the multi-document transactions TwinCap relies on

### Clone and install

```bash
git clone <repo-url> twincap
cd twincap
pnpm install
```

### Environment setup

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# MongoDB connection string (Atlas M0 shared tier)
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/twincap

# Session encryption secret (jose JWE A256GCM) — base64url-encoded 32-byte key
# Generate one with: openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
AUTH_SECRET=<base64url-encoded-32-bytes>
```

> **Important**: `AUTH_SECRET` must decode to exactly 32 bytes. The app validates this on startup and fails fast with a clear error message if it is missing or has the wrong length.

Production deployments additionally require `RESEND_API_KEY`, `RESEND_FROM`, and `APP_BASE_URL` (otherwise the app fails fast at runtime). Monitoring, feedback, and analytics are opt-in — see `.env.example` for the full list.

### Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run tests

```bash
pnpm test          # Vitest single run (unit + integration)
pnpm test:watch    # watch mode
```

The suite has **1,340+ tests across 120 test files**, covering domain logic, use cases, infrastructure adapters, real MongoDB transactions, concurrency, and idempotency.

End-to-end tests run with Playwright against a local `mongodb-memory-server` seeded through `.env.e2e` (never Atlas):

```bash
pnpm test:e2e:install   # one-time: install the Chromium browser
pnpm test:e2e           # 24 E2E flows across 4 specs
```

## Features

| # | Capability | Description |
|---|-----------|-------------|
| 1 | **User Auth** | Register, login, logout, email verification, and password reset (jose A256GCM sessions, bcryptjs, Resend) |
| 2 | **Accounts** | Create, rename, and delete accounts with opening/initial balance tracking; balances are always derived (no stored balance field) |
| 3 | **Categories** | Income/expense categories with uniqueness and deletion guards |
| 4 | **Movements** | Income and expense movements with category-type matching, system-linked deletion guards, optimistic-concurrency (CAS) edits, and a policy that allows negative balances |
| 5 | **Transfers** | Move funds between your own accounts (same or cross currency) with idempotent replay and CAS; the FX rate is derived from both amounts |
| 6 | **Credits Received** | Track credits you receive with installment (abono) management and cascade deletes |
| 7 | **Credits Granted** | Track credits you grant with capital-first amortization, interest-only income, and an uncollectible write-off flow |
| 8 | **Payables** | Register purchase obligations with total/abono tracking (payable principal is never re-counted as an expense) |
| 9 | **Clients** | Client records with guarded deletion and create/edit flows shared with the POS |
| 10 | **POS** | Product catalog + sales with stock management, line items, paid-in-full or on-credit payment, and abono operations |

### Additional capabilities

- **Dashboard** — server-aggregated snapshot with filters, yearly evolution chart, financial position (assets/liabilities), and recent movements
- **Multi-currency** — COP, USD, MXN, EUR with explicit derived FX (no silent conversion)
- **Workspace isolation** — every record is scoped to a `workspaceId` through the user's membership
- **Idempotency** — client-provided idempotency keys on financial creation actions
- **Concurrency control** — optimistic locking via version (CAS) plus real MongoDB multi-document transactions
- **Audit trail & monitoring** — operation log, error events, and opt-in alerting
- **Analytics** — opt-in product metrics dashboard restricted to an email allowlist
- **Legal & support** — privacy/terms/cookies/data-policy pages, help center, and in-product feedback widget
- **PWA, dark mode, and i18n** — installable app with Spanish/English UI

## Project Structure

```
twincap/
├── src/                          # Application source
│   ├── core/                     # Domain + Application (framework-free)
│   ├── infrastructure/           # Mongoose, auth, config adapters
│   ├── app/                      # Next.js App Router pages + actions
│   ├── components/               # Shared UI + feature components
│   └── i18n/                     # Custom es/en localization
├── e2e/                          # Playwright end-to-end specs
├── messages/                     # es.json / en.json translation catalogs
├── .env.example                  # Environment variable template
├── .env.e2e                      # E2E environment (local mongod only)
├── .env.local                    # Local environment (gitignored)
├── eslint.config.mjs             # ESLint flat config
├── next.config.ts                # Next.js configuration
├── package.json                  # pnpm scripts + dependencies
├── playwright.config.ts          # Playwright E2E configuration
├── pnpm-lock.yaml                # Lockfile
├── postcss.config.mjs            # PostCSS + Tailwind
├── tsconfig.json                 # TypeScript strict config with @/* alias
├── vitest.config.ts              # Vitest test configuration
└── README.md
```

## Deployment

### Vercel

1. Push to GitHub and import in [vercel.com/new](https://vercel.com/new)
2. Set environment variables in the Vercel dashboard:
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `AUTH_SECRET` — a base64url-encoded 32-byte key (see above)
   - `RESEND_API_KEY`, `RESEND_FROM`, `APP_BASE_URL` — required in production
3. Deploy — Vercel detects Next.js automatically

> **Note**: The app validates required environment variables at runtime and fails with a clear error if any are missing.

### MongoDB Atlas

- Use the **Shared Tier (M0)** — it is a replica set, so the multi-document transactions TwinCap uses are supported
- Connection string format: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>`
- Whitelist your Vercel deployment IPs in Atlas Network Access

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the development server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest (single run) |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:e2e` | Run Playwright E2E (local mongod via `.env.e2e`) |
| `pnpm test:e2e:install` | Install the Playwright Chromium browser |
| `pnpm e2e:server` | Build and start the server used by the E2E `webServer` |
| `pnpm format` | Format the codebase with Prettier |
| `pnpm format:check` | Check formatting without writing |
| `pnpm migrate:workspace` | Run the workspace migration script |

## License

Private — not for distribution.
