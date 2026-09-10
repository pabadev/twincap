import type { LiveParentIds, LinkableParent } from './filter-live-linked-movements';

/**
 * Minimal structural shapes required from each parent collection to assemble
 * a {@link LiveParentIds} snapshot. Accepts any entity exposing these fields
 * (the domain entities satisfy them structurally). Amounts are minor units.
 */
export interface LiveParentCollections {
  accounts: Array<{ id: string }>;
  transfers: Array<{ id: string }>;
  creditsReceived: Array<{ id: string; accountId: string; date: Date; principal: { amount: number } }>;
  creditsGranted: Array<{ id: string; accountId: string; date: Date; principal: { amount: number } }>;
  /** Sale totals are minor units (Sale.total is a number, not Money). */
  sales: Array<{ id: string; accountId: string; date: Date; total: number }>;
  payables: Array<{ id: string }>;
}

/**
 * R15.2 — single source of truth for assembling {@link LiveParentIds} from
 * already-loaded parent collections. Replaces the inline per-caller assembly
 * that previously lived (identically) in the dashboard server action, the
 * dashboard page, and balance reads.
 *
 * Only LIVE parents survive: the loader fetched the CURRENT collections, so
 * whatever is not in them is orphaned state left behind by a parent deletion
 * whose cascade failed — and the derived balance must exclude it.
 */
export function collectLiveParentIds(collections: LiveParentCollections): LiveParentIds {
  const linkable = (
    parents: Array<{ id: string; accountId: string; date: Date; amount: number }>,
  ): LinkableParent[] => parents.map((p) => ({ id: p.id, accountId: p.accountId, date: p.date, amount: p.amount }));

  return {
    accounts: new Set(collections.accounts.map((a) => a.id)),
    transfers: new Set(collections.transfers.map((t) => t.id)),
    creditsReceived: linkable(collections.creditsReceived.map((c) => ({ id: c.id, accountId: c.accountId, date: c.date, amount: c.principal.amount }))),
    creditsGranted: linkable(collections.creditsGranted.map((c) => ({ id: c.id, accountId: c.accountId, date: c.date, amount: c.principal.amount }))),
    sales: linkable(collections.sales.map((s) => ({ id: s.id, accountId: s.accountId, date: s.date, amount: s.total }))),
    payables: new Set(collections.payables.map((p) => p.id)),
  };
}