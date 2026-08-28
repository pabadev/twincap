import type { Movement } from '../../domain/movement';

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

function isLinkable(arr: LinkableParent[], id: string): boolean {
  return arr.some((p) => p.id === id);
}

function findByValue(
  arr: LinkableParent[],
  accountId: string,
  dateKey: string,
  amount: number,
  dateKeyOf: (d: Date) => string,
): boolean {
  return arr.some(
    (p) =>
      p.accountId === accountId &&
      dateKeyOf(p.date) === dateKey &&
      p.amount === amount,
  );
}

export function filterMovementsWithLiveParents(
  movements: Movement[],
  live: LiveParentIds,
): Movement[] {
  const dateKeyOf = live.dateKeyOf ?? defaultDateKey;

  return movements.filter((m) => {
    if (!m.link) return true;
    const { kind, refId } = m.link;

    switch (kind) {
      case 'opening':
        return live.accounts.has(refId);
      case 'transfer':
        return live.transfers.has(refId);

      // --- linkable kinds: id lookup first, then value reconciliation ---
      case 'creditReceivedPrincipal':
        return (
          isLinkable(live.creditsReceived, refId) ||
          findByValue(
            live.creditsReceived,
            m.accountId,
            dateKeyOf(m.date),
            m.amount.amount,
            dateKeyOf,
          )
        );
      case 'creditGrantedPrincipal':
        return (
          isLinkable(live.creditsGranted, refId) ||
          findByValue(
            live.creditsGranted,
            m.accountId,
            dateKeyOf(m.date),
            m.amount.amount,
            dateKeyOf,
          )
        );
      case 'salePayment':
        return (
          isLinkable(live.sales, refId) ||
          findByValue(
            live.sales,
            m.accountId,
            dateKeyOf(m.date),
            m.amount.amount,
            dateKeyOf,
          )
        );

      // --- non-linkable kinds: id-only, keep current Set semantics ---
      case 'creditReceivedAbono':
        return isLinkable(live.creditsReceived, refId);
      case 'creditGrantedAbono':
        return isLinkable(live.creditsGranted, refId);
      case 'payableInitialPayment':
      case 'payableAbono':
        return live.payables.has(refId);
      default:
        return true;
    }
  });
}
