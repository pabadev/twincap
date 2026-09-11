import type { BalanceMovement, MovementLinkKind } from '../../domain/movement';
import { MOVEMENT_LINK_KIND_REGISTRY, type MovementLinkKindMeta } from '../../domain/movement';
import { isModernRecord } from '../../domain/modern-record';

/** Default date key: extracts YYYY-MM-DD (UTC) from a Date. */
function defaultDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Identifiable parent for kinds whose movement mirrors the parent's amount
 * (creditGrantedPrincipal mirrors principal, creditReceivedPrincipal mirrors
 * principal, salePayment mirrors total). The extra fields enable value-based
 * reconciliation when a legacy refId (pre-ObjectId UUID) fails id lookup.
 */
export interface LinkableParent {
  id: string;
  accountId: string;
  date: Date;
  /** principal/total of the parent in minor units = amount of the mirror movement. */
  amount: number;
}

/**
 * Ids of live (existing) parent operations per link kind. A movement whose
 * `link.refId` does not resolve to a live parent is an orphan produced by a
 * parent deletion that failed to cascade — we filter it out of every read so
 * it never surfaces in the movements table or the dashboard aggregations.
 *
 * Some legacy documents carry a UUID refId that does not match the current
 * ObjectId. For linkable kinds (creditGrantedPrincipal, creditReceivedPrincipal,
 * salePayment) we fall back to value-based reconciliation: accountId + business
 * date (UTC date key) + mirror amount. Kinds that never carry legacy refIds
 * (opening, transfer, payables, abonos) keep a simple Set<string>.
 */
export interface LiveParentIds {
  accounts: Set<string>;
  transfers: Set<string>;
  creditsReceived: LinkableParent[];
  creditsGranted: LinkableParent[];
  sales: LinkableParent[];
  payables: Set<string>;
  /** Business-date key extractor — defaults to ISO UTC YYYY-MM-DD. */
  dateKeyOf?: (d: Date) => string;
}

/** Snapshot accessor: the per-collection storage shape inside LiveParentIds. */
type ParentSnapshot = Set<string> | LinkableParent[];

/**
 * Maps a registry `parentCollection` to its live snapshot. This is purely
 * infrastructural (how the snapshot is stored); WHICH collection a kind owns
 * is normative and lives in {@link MOVEMENT_LINK_KIND_REGISTRY}. The switch
 * is exhaustive over the registry's parentCollection union — adding a new
 * collection to the registry forces this (and the snapshot assembly in
 * `collectLiveParentIds`) to grow, which the §14 structural test enforces.
 */
function liveParentsFor(
  parentCollection: MovementLinkKindMeta['parentCollection'],
  live: LiveParentIds,
): ParentSnapshot {
  switch (parentCollection) {
    case 'accounts':
      return live.accounts;
    case 'transfers':
      return live.transfers;
    case 'credits-received':
      return live.creditsReceived;
    case 'credits-granted':
      return live.creditsGranted;
    case 'sales':
      return live.sales;
    case 'payables':
      return live.payables;
  }
}

function parentHas(parents: ParentSnapshot, refId: string): boolean {
  return parents instanceof Set
    ? parents.has(refId)
    : parents.some((p) => p.id === refId);
}

/** Number of parents matching accountId + business-date key + mirror amount. */
function countByValue(
  arr: LinkableParent[],
  accountId: string,
  dateKey: string,
  amount: number,
  dateKeyOf: (d: Date) => string,
): number {
  return arr.filter(
    (p) =>
      p.accountId === accountId &&
      dateKeyOf(p.date) === dateKey &&
      p.amount === amount,
  ).length;
}

/**
 * R15.3 §13 — legacy movement classification. THE single decision table used
 * by both the live filter (financial reads) and the reconcile sweep
 * (diagnostics), so "excluded from the balance" and "reported by reconcile"
 * can never diverge.
 *
 * Classification (per §13):
 * - 0 candidates      → `orphan`
 * - 1 candidate       → `reconciled`
 * - >1 candidates     → `ambiguous`  (EXCLUDED conservatively — never picked
 *                                      arbitrarily, never considered live)
 *
 * Plus (§15): a link kind outside {@link MOVEMENT_LINK_KIND_REGISTRY} →
 * `unknown-kind` (EXCLUDED from every financial calculation, never silently
 * treated as valid, always reportable by reconcile).
 *
 * Modern movements (created after the R15.1 cutoff) whose parent cannot be
 * resolved by id are ALWAYS orphans — the value fallback exists only to
 * repair pre-ObjectId UUIDs (R15.1 6d).
 */
export type LegacyMovementClassification =
  | 'manual'
  | 'reconciled'
  | 'orphan'
  | 'ambiguous'
  | 'unknown-kind';

export interface LegacyMovementClassificationResult {
  classification: LegacyMovementClassification;
  /** Present for value-lookup classifications; the number of matching parents. */
  candidatesCount?: number;
}

export function classifyLegacyMovement(
  movement: BalanceMovement,
  live: LiveParentIds,
  dateKeyOf?: (d: Date) => string,
): LegacyMovementClassificationResult {
  const key = dateKeyOf ?? defaultDateKey;
  if (!movement.link) return { classification: 'manual' };

  const meta = MOVEMENT_LINK_KIND_REGISTRY[movement.link.kind];
  if (!meta) return { classification: 'unknown-kind' };

  const parents = liveParentsFor(meta.parentCollection, live);

  if (meta.lookup === 'id') {
    return parentHas(parents, movement.link.refId)
      ? { classification: 'reconciled' }
      : { classification: 'orphan' };
  }

  // lookup === 'value': id lookup first, then legacy value reconciliation.
  if (parentHas(parents, movement.link.refId)) return { classification: 'reconciled' };
  if (isModernRecord(movement.createdAt)) return { classification: 'orphan' };

  const candidatesCount = countByValue(
    parents as LinkableParent[],
    movement.accountId,
    key(movement.date),
    movement.amount.amount,
    key,
  );
  if (candidatesCount === 1) return { classification: 'reconciled', candidatesCount };
  if (candidatesCount > 1) return { classification: 'ambiguous', candidatesCount };
  return { classification: 'orphan', candidatesCount };
}

/**
 * R15.2 corrective — parameter widened from `Movement[]` to a generic over
 * `BalanceMovement` (structural subset), so both the full entity read
 * (dashboard/reconcile: `Movement[]`) and the lite balance read
 * (`BalanceMovement[]`) can pass through the same filter. The filter only
 * reads `link`, `accountId`, `date`, `amount.amount` and `createdAt` —
 * exactly the fields the lite read projects.
 *
 * R15.3 §13/§15 — the filter now uses {@link classifyLegacyMovement} as its
 * single decision table; every non-`reconciled` system movement is excluded:
 * orphans (dead parent), ambiguous legacy movements (never picked
 * arbitrarily), and unknown link kinds (never treated as valid).
 */
export function filterMovementsWithLiveParents<T extends BalanceMovement>(
  movements: T[],
  live: LiveParentIds,
): T[] {
  const dateKeyOf = live.dateKeyOf ?? defaultDateKey;

  return movements.filter((m) => {
    if (!m.link) return true;
    const result = classifyLegacyMovement(m, live, dateKeyOf);
    if (result.classification === 'ambiguous') {
      console.warn('[reconcile] Ambiguous legacy reconciliation', {
        movementId: m.id,
        kind: m.link.kind,
        candidatesCount: result.candidatesCount,
      });
      // §13: >1 candidates → excluded from the balance and every derived
      // financial aggregation. Selecting one arbitrarily would corrupt the
      // result every time the snapshot loads a different candidate set.
      return false;
    }
    return result.classification === 'reconciled';
  });
}