# Post-UX Round Tasks

## Cluster 10 — Beta round 4

### Phase B

- [x] **B1 — Same-day ordering (finding 5)** — `fix(movements)` commit f97ff6d
  - Multi-leg creation use cases (transfer, credit-granted add-abono with capital+interest split) give subsequent legs +1ms createdAt for deterministic same-day sorting.
  - Movement repository sorts append `_id: -1` as final tiebreaker (6 query sites: findByWorkspaceId, findPaged, findByAccountId, findByAccountIdForBalance, findByWorkspaceIdAndDateRange, findByWorkspaceIdForBalance).
  - Backfill script `scripts/backfill-movement-createdAt.mjs` recovers missing createdAt from ObjectId timestamp (dry-run by default, `--apply` to write). Dry-run executed: 0 movement docs missing createdAt.
  - Tests: transfers.test.ts and credits-granted.test.ts assert tiebreaker contract; movement-repository.test.ts asserts sort signature includes `_id: -1`.

- [x] **B2 — /clients hardening + live diagnosis (finding 1)** — `fix(clients)` commit 6414058
  - Client domain constructor uses null-safe trim for phone/email/note (`?? ""` before trim) to prevent TypeError on legacy docs with explicit null.
  - Clients page replaces `user.workspaceId!` non-null assertion with explicit guard: redirects to /login when workspaceId is absent.
  - **Diagnosis**: queried errorevents collection (2026-09-19 to 2026-09-22) — collection is empty (0 events). No client-related errors to investigate. Connection successful via MONGODB_URI from .env.local.

- [x] **B3 — Documentation** — this file
  - Cluster 10 Phase B tasks tracked with commit hashes and evidence lines.

### Verification

- `pnpm exec tsc --noEmit`: passed (no errors)
- `pnpm lint`: pre-existing warnings only; no new errors in touched files
- `pnpm exec prettier --check`: all touched files formatted correctly
- Targeted vitest: 113 tests passed (transfers, credits-granted, movement-repository)
- Backfill script dry-run: 0 movement docs missing createdAt
