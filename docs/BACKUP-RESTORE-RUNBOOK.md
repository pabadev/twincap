# TwinCap — Backup & Restore Runbook (R14-Fase O)

## 1. Purpose & status

- **Ronda 14, Fase O** — audit §18 / **P0-c** (Definition of Beta evidence chain).
- Atlas **M0 (free shared tier) has NO automated backups**. This runbook turns the manual
  backup/restore procedure into a documented, repeatable, verifiable process while the
  product stays on M0.
- The tooling is pure mongoose scripts: **no mongodump, no mongosh, no external tools**.

## 2. Prerequisites

- Local **Node ≥ 22** and **pnpm** (repo rule: never npm/yarn).
- `.env.local` with `MONGODB_URI` pointing at the app database (the db name is the last
  path segment of the URI).
- The scripts in `scripts/` (`backup-atlas.mjs`, `restore-atlas.mjs`) — no install step,
  mongoose is already a direct dependency.

## 3. Procedures

### 3.1 Routine backup

Read-only snapshot of every user collection into `backups/<yyyy-mm-dd-hhmmss>/`:

```bash
node --env-file=.env.local scripts/backup-atlas.mjs
```

Optional flags:

```bash
node --env-file=.env.local scripts/backup-atlas.mjs --source-db twincap   # explicit db name
node --env-file=.env.local scripts/backup-atlas.mjs --out backups/custom  # custom output dir
```

Output: one `<collection>.json` (pretty JSON array) per collection + `manifest.json`
(createdAt, sourceDb, uriHost, per-collection counts).

- **Compression:** zip the produced directory (`tar -czf twincap-backup-<ts>.tar.gz backups/<ts>`
  or your OS archive tool) and **store a copy on external/cloud storage** — a backup on the
  same machine is not a backup.
- **Cadence:** weekly, and **before every migration script** run.

> **Decision note — M0 manual fallback vs paid tier.** This runbook is the free fallback
> while on M0. See §5 for the decision record; the choice belongs to the founder.

### 3.2 Restore test (P0-c proof chain)

Restores a backup into a **temporary database** on the same cluster (default name:
`<sourceDb>_restore_test`) and verifies per-collection counts against the manifest:

```bash
node --env-file=.env.local scripts/restore-atlas.mjs --dir backups/2026-09-07-214359
```

- Refuses (non-zero exit) if the target database already exists, unless `--drop` is passed
  (drops **only** the target; a guard aborts if the target name ever equals the source db).
- Verification is a **hard requirement**: every collection in the manifest is counted and
  compared; any mismatch or missing collection → `VERIFICATION FAILED`, non-zero exit.
- Spot checks (informational): `users`, `workspaces`, `movements` counts confirmed > 0
  when the manifest holds data.

**Optional app-level check (the "app usable" evidence).** Point the app at the temp db
without touching `.env.local`, from a separate shell:

```bash
MONGODB_URI="<uri>/<targetDb>" pnpm dev
```

Then: log in with a restored user, confirm the dashboard shows restored financial data
(accounts, movements, credits, payables, POS), and revert by closing that shell / Ctrl+C.
`.env.local` is never modified by this procedure.

### 3.3 Cleanup

Drop the temporary database (restore-test leftovers) — cleanup-only mode:

```bash
node --env-file=.env.local scripts/restore-atlas.mjs --dir backups/<ts> --target-db <targetDb> --drop --skip-restore
```

## 4. Evidence format for Definition of Beta (P0-c)

Fill one row per backup/restore cycle. This table (or a copy) is the P0-c evidence for
"data can be backed up and restored and the app works against the restored data".

| Fecha | Backup dir | Collections (n) | Total docs | Restore PASS/FAIL | App-check PASS/FAIL | Run by | Notes |
|-------|------------|-----------------|------------|-------------------|---------------------|--------|-------|
| 2026-09-07 | `backups/2026-09-07-214359` | 22 | 656 | ✅ PASS (22/22, 656/656) | ✅ **PASS** — fundador (`fjpaba1989@gmail.com`) logueó contra la DB restaurada y accedió a su workspace `6a8922639bc1a626829342b7` (4 cuentas / 117 movimientos / 9 ventas / 13 transferencias / 39 categorías / 4 clientes) | MCP orchestrator + scripts + fundador | DB real `globalmoney` (host `cluster0.06amtxd`); restore a `globalmoney_restore_test`; commit probado: `bea2262`; **tipos BSON verificados idénticos a producción (ObjectId/Date)** |

**⚠️ Corrección de tipos BSON (commit `bea2262`):** los backups anteriores a `214359` (`210056`, `213717`) quedaron **invalidados y borrados** — `JSON.stringify` degradaba `ObjectId`→string y `Date`→string (vía `toJSON()` antes del replacer), por lo que las queries de la app (que castean a `ObjectId`/`Date`) no matcheaban nada: el login "completaba" pero la sesión quedaba sin workspace. El backup actual serializa marcadores EJSON-lite `{$oid}`/`{$date}` ANTES de `stringify` (`toEjsonValue`) y el restore los revive con `JSON.parse` reviver. **Siempre re-verificar tipos tras un restore:** `scripts/_tmp-verify-types.mjs` (patrón, se borra tras usar).

Additional evidence to attach: the printed verification table of the restore run, and the
app version/commit tested (`git rev-parse --short HEAD` or Vercel deploy id).

## 5. Decision record — M0 manual vs paid tier

| Option | Cost | Backups | Notes |
|--------|------|---------|-------|
| **A. Stay on M0 + this runbook** | Free | Manual only | Discipline-dependent; acceptable for beta with few real users |
| **B. Upgrade M10/M20** | Paid (monthly) | Automated continuous backups (PITR on M10+) | Recommended before production-scale real data |

**Decision:** ________________ (founder) &nbsp;&nbsp; **Date:** ________________