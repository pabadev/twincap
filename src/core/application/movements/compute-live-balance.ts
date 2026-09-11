import type {
  MovementRepository,
  TransferRepository,
  CreditReceivedRepository,
  CreditGrantedRepository,
  SaleRepository,
  PayableRepository,
} from '../../domain/repositories';
import type { BalanceMovement } from '../../domain/movement';
import type { TransactionHandle } from '../../domain/transaction';
import type { LiveParentIds } from './filter-live-linked-movements';
import { filterMovementsWithLiveParents } from './filter-live-linked-movements';
import { assertSafeMinorUnits } from '../../domain/money';

/** Parent repositories needed to resolve a movement's link.refId to a live
 *  parent. `Pick` keeps the contract minimal — callers pass whatever they have
 *  (real repos, fakes, or the use-case's own references). */
export interface LiveBalanceDeps {
  transferRepo: Pick<TransferRepository, 'findById'>;
  creditReceivedRepo: Pick<CreditReceivedRepository, 'findById'>;
  creditGrantedRepo: Pick<CreditGrantedRepository, 'findById'>;
  saleRepo: Pick<SaleRepository, 'findById'>;
  payableRepo: Pick<PayableRepository, 'findById'>;
}

/** Resolve every distinctive `link.refId` across a movement batch to its live
 *  parent, returning the {@link LiveParentIds} snapshot. `accounts` supplies
 *  the live account ids (the movement batch's own accounts). */
export async function resolveLiveParentsForMovements(
  workspaceId: string,
  movements: readonly BalanceMovement[],
  deps: LiveBalanceDeps,
  accounts: Array<{ id: string }>,
  tx?: TransactionHandle,
): Promise<LiveParentIds> {
  // Dedupe refIds so each live parent is fetched at most once.
  const refIds = {
    transfers: new Set<string>(),
    creditsReceived: new Set<string>(),
    creditsGranted: new Set<string>(),
    sales: new Set<string>(),
    payables: new Set<string>(),
  };
  for (const m of movements) {
    if (!m.link) continue;
    switch (m.link.kind) {
      case 'transfer':
        refIds.transfers.add(m.link.refId);
        break;
      case 'creditReceivedPrincipal':
      case 'creditReceivedAbono':
        refIds.creditsReceived.add(m.link.refId);
        break;
      case 'creditGrantedPrincipal':
      case 'creditGrantedAbono':
      case 'creditGrantedAbonoInterest':
      case 'creditGrantedWriteOff':
        refIds.creditsGranted.add(m.link.refId);
        break;
      case 'salePayment':
        refIds.sales.add(m.link.refId);
        break;
      case 'payableInitialPayment':
      case 'payableAbono':
        refIds.payables.add(m.link.refId);
        break;
      default:
        // 'opening' (refId = accountId) and unknown kinds: no parent fetch.
        break;
    }
  }

  const live: LiveParentIds = {
    accounts: new Set(accounts.map((a) => a.id)),
    transfers: new Set<string>(),
    creditsReceived: [],
    creditsGranted: [],
    sales: [],
    payables: new Set<string>(),
  };

  // SERIAL reads only: the MongoDB driver forbids concurrent ops on one
  // ClientSession (MongoServerError 251 → infinite retry loop). The per-kind
  // parent lookups run in sequence, never `Promise.all`.
  for (const id of refIds.transfers) {
    const transfer = await deps.transferRepo.findById(workspaceId, id, tx);
    if (transfer) live.transfers.add(id);
  }
  for (const id of refIds.creditsReceived) {
    const credit = await deps.creditReceivedRepo.findById(workspaceId, id, tx);
    if (credit) {
      live.creditsReceived.push({
        id: credit.id,
        accountId: credit.accountId,
        date: credit.date,
        amount: credit.principal.amount,
      });
    }
  }
  for (const id of refIds.creditsGranted) {
    const credit = await deps.creditGrantedRepo.findById(workspaceId, id, tx);
    if (credit) {
      live.creditsGranted.push({
        id: credit.id,
        accountId: credit.accountId,
        date: credit.date,
        amount: credit.principal.amount,
      });
    }
  }
  for (const id of refIds.sales) {
    const sale = await deps.saleRepo.findById(workspaceId, id, tx);
    if (sale) {
      live.sales.push({
        id: sale.id,
        accountId: sale.accountId,
        date: sale.date,
        // Sale.total is minor units (number), mirroring the dashboard shape.
        amount: sale.total,
      });
    }
  }
  for (const id of refIds.payables) {
    const payable = await deps.payableRepo.findById(workspaceId, id, tx);
    if (payable) live.payables.add(id);
  }

  return live;
}

/**
 * R15.2 — derived account balance with canonical live-parent semantics.
 *
 * Reads the account's movements via the LITE read
 * (`findByAccountIdForBalance`): same session-aware filter + sort, but no
 * category/account resolution — each evaluation stays ≈1 query, which
 * matters on the transfer write-conflict retry path (the old full
 * findByAccountId added 2 dependency-resolution finds per attempt).
 *
 * Category parity with the dashboard read (findByWorkspaceIdForBalance
 * skips movements whose category does not resolve): orphan categories are
 * impossible by construction — `deleteCategory` rejects deletion while any
 * movement references the category via `countByCategoryId`
 * (src/core/application/categories/delete-category.ts:14-17); synthetic
 * categories always resolve. The lite read therefore performs NO category
 * check and still matches the dashboard output.
 *
 * Resolves every `link.refId` to its live parent, and sums only the
 * `signedAmount` of movements whose parent is alive — orphaned movements
 * (parent deleted without cascade) never affect the balance. The account
 * itself is the only pre-seeded live parent, so opening movements (whose
 * `refId` IS the account id) survive the filter.
 *
 * Note (R15.3 §12): `TransferRepository.findById` now accepts the tx handle,
 * so transfer parents join the same snapshot as every other parent lookup —
 * a concurrent transfer delete can no longer flip a balance between the
 * parent read and the signedAmount sum (visible-at-commit consistency).
 */
export async function computeAccountLiveBalance(
  workspaceId: string,
  accountId: string,
  movementRepo: MovementRepository,
  deps: LiveBalanceDeps,
  tx?: TransactionHandle,
): Promise<number> {
  const movements = await movementRepo.findByAccountIdForBalance(workspaceId, accountId, tx);
  const live = await resolveLiveParentsForMovements(
    workspaceId,
    movements,
    deps,
    [{ id: accountId }],
    tx,
  );
  const liveMovements = filterMovementsWithLiveParents(movements, live);
  // R15.3 §18: the aggregated balance (Σ signedAmount) must stay a safe
  // integer — it feeds transfer fund checks inside transactions and derived
  // queries, so an overflow here would corrupt the financial result. Fail
  // fast per accumulation step.
  let balance = 0;
  for (const m of liveMovements) {
    balance += m.signedAmount;
    assertSafeMinorUnits(balance, `Account live balance (${accountId})`);
  }
  return balance;
}