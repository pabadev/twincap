# GlobalMoney

Personal finance management application built with Clean Architecture on Next.js 16.

Manage accounts, track movements, handle transfers, manage credits (received and granted), and run a point-of-sale system with a product catalog and sales tracking.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.3.1 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript 5 (strict mode) |
| Database | MongoDB (Mongoose 8 ODM) |
| Auth | jose (JWE A256GCM sessions), bcryptjs |
| Validation | Zod 4 |
| Testing | Vitest |
| Deployment | Vercel |

## Architecture

GlobalMoney follows **Clean Architecture** with strict layer separation:

```
src/
├── core/                          # Pure business logic (zero framework imports)
│   ├── domain/                    # Entities, value objects, repository interfaces
│   │   ├── account.ts
│   │   ├── category.ts
│   │   ├── catalog.ts
│   │   ├── credit-received.ts
│   │   ├── credit-granted.ts
│   │   ├── currency.ts            # Multi-currency support
│   │   ├── errors.ts              # DomainError, NotFoundError, etc.
│   │   ├── money.ts               # Money value object with rounding
│   │   ├── movement.ts            # Signed-amount movements
│   │   ├── repositories.ts        # Repository port interfaces
│   │   ├── sale.ts
│   │   ├── transfer.ts
│   │   └── user.ts
│   └── application/               # Use cases (orchestrate domain + ports)
│       ├── accounts/              # create-account, list-accounts, update-account, delete-account
│       ├── auth/                  # register, login, logout
│       ├── balance.ts             # Account balance aggregation (signed-amount sum)
│       ├── catalog/               # catalog CRUD use cases
│       ├── categories/            # category CRUD use cases
│       ├── credits-granted/       # credit lifecycle + abono management
│       ├── credits-received/      # credit lifecycle + abono management
│       ├── movements/             # movement CRUD with category-type guards
│       ├── ports.ts               # Application ports (PasswordHasher, SessionManager, Clock, IdGenerator)
│       ├── sales/                 # sale lifecycle with stock management + abonos
│       └── transfers/             # transfer use cases with idempotent replay
│
├── infrastructure/                # Framework adapters (Mongoose, jose, bcryptjs)
│   ├── auth/                      # Password hasher, session manager, cookie helpers
│   ├── config/                    # Zod-validated env (fail-fast on startup)
│   ├── consistency/               # Reconcile utility for derived balance sweep
│   ├── db/                        # Mongoose singleton connection
│   ├── mappers/                   # Document ↔ Entity mappers (8 modules)
│   ├── models/                    # Mongoose schemas + indexes (9 models)
│   ├── repositories/              # Repository implementations (8 modules)
│   └── seeding/                   # Idempotent user bootstrap
│
├── app/                           # Next.js App Router (UI + server actions)
│   ├── (auth)/                    # Login / register (public)
│   ├── (main)/                    # Authenticated shell (session guard, nav sidebar)
│   │   ├── dashboard/
│   │   ├── accounts/
│   │   ├── categories/
│   │   ├── movements/
│   │   ├── transfers/
│   │   ├── credits/received/
│   │   ├── credits/granted/
│   │   └── pos/                   # catalog/ + sales/
│   └── layout.tsx                 # Root layout
│
└── components/ui/                 # Shared UI primitives
    ├── button.tsx
    ├── card.tsx
    ├── input.tsx
    ├── modal.tsx
    ├── select.tsx
    └── table.tsx
```

**Dependency rule**: `core/domain` has zero imports. `core/application` imports only `domain`. `infrastructure` implements `domain` ports. `app` depends on everything but never reaches into `core/domain` directly from pages.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- MongoDB Atlas account (shared tier — no multi-document transactions required)

### Clone and install

```bash
git clone <repo-url> twincap
cd twincap
pnpm install
```

### Environment setup

Copy the example and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
# MongoDB connection string (Atlas shared tier)
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/twincap

# Session encryption secret (jose JWE A256GCM) — must be at least 32 bytes
# Generate one with: openssl rand -base64 32
AUTH_SECRET=<generate-a-random-32-byte-string>
```

> **Important**: `AUTH_SECRET` must be at least 32 bytes. The app validates this on startup and will fail fast with a clear error message if it's missing or too short.

### Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run tests

```bash
pnpm test          # single run
pnpm test:watch    # watch mode
```

24 test files, 242 tests covering domain logic, use cases, infrastructure adapters, and consistency checks.

## Features

| # | Capability | Description |
|---|-----------|-------------|
| 1 | **User Auth** | Register, login, logout with JWT sessions (jose A256GCM) and bcryptjs password hashing |
| 2 | **Accounts** | Create, update, delete accounts with opening balance tracking |
| 3 | **Categories** | Categorize movements (income/expense) with uniqueness and deletion guards |
| 4 | **Movements** | Record income and expense movements with category-type matching and system-linked deletion guards |
| 5 | **Transfers** | Move funds between accounts with idempotent replay and cascade |
| 6 | **Credits Received** | Track credits you receive with abono (payment installment) management and cascade |
| 7 | **Credits Granted** | Track credits you grant with abono management and cascade |
| 8 | **POS (Point of Sale)** | Product catalog + sales with stock management, line items, and abono operations |

### Additional capabilities

- **Dashboard** — Welcome view with account balance aggregation
- **Balance aggregation** — Derived balances via signed-amount sum (no stored balance field)
- **Consistency reconcile** — Sweep utility for derived data integrity
- **Idempotent seeding** — User bootstrap runs safely on every startup
- **Dark mode** — Tailwind CSS dark mode support throughout the UI

## Project Structure

```
twincap/
├── src/                          # Application source
│   ├── core/                     # Domain + Application (framework-free)
│   ├── infrastructure/           # Mongoose, auth, config adapters
│   ├── app/                      # Next.js App Router pages + actions
│   └── components/               # Shared UI components
├── .env.example                  # Environment variable template
├── .env.local                    # Local environment (gitignored)
├── eslint.config.mjs             # ESLint flat config
├── next.config.ts                # Next.js configuration
├── package.json                  # pnpm scripts + dependencies
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
   - `AUTH_SECRET` — a random string ≥32 bytes (generate with `openssl rand -base64 32`)
3. Deploy — Vercel detects Next.js automatically

> **Note**: `AUTH_SECRET` must be set in the Vercel environment variables. The app validates it at runtime (lazy validation) and will fail with a clear error on first request if missing.

### MongoDB Atlas

- Use the **Shared Tier (M0)** — no multi-document transactions needed
- Connection string format: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>`
- Whitelist your Vercel deployment IPs in Atlas Network Access

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest (single run) |
| `pnpm test:watch` | Run Vitest in watch mode |

## License

Private — not for distribution.
