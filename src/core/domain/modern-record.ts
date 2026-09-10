/**
 * R15.1 — modern vs legacy records.
 *
 * Ronda 15 closed 2026-09-09 (git history): aggregates and movements created
 * at/after this instant are MODERN (strict lifecycle — required linked
 * movements must exist, orphan filtering is strict); earlier records are
 * LEGACY (tolerant reconciliation — missing movements are logged and
 * tolerated, value-based parent lookup is allowed to compensate for
 * pre-ObjectId UUID refIds).
 */
export const R15_1_MODERN_CUTOFF: Date = new Date("2026-09-09T00:00:00.000Z");

/** True when the record was created at/after the R15.1 modern cutoff. */
export function isModernRecord(createdAt: Date): boolean {
  return createdAt.getTime() >= R15_1_MODERN_CUTOFF.getTime();
}