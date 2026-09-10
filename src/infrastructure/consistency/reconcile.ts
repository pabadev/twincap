/**
 * Consistency sweep + repair utility (design §5).
 *
 * Each detection function accepts repository interfaces (testable with fakes).
 * executeReconcile applies or dry-runs the detected actions.
 */

import type {
  TransferRepository,
  MovementRepository,
  CreditReceivedRepository,
  CreditGrantedRepository,
  SaleRepository,
  AccountRepository,
  PayableRepository,
} from "../../core/domain/repositories";
import { isMovementLinkKind } from "../../core/domain/movement";
import {
  collectLiveParentIds,
  filterMovementsWithLiveParents,
} from "../../core/application/movements";

export interface ReconcileAction {
  type: "complete_parent" | "delete_orphan" | "restore_stock" | "flag";
  description: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
}

export interface ReconcileResult {
  dryRun: boolean;
  actions: ReconcileAction[];
  applied: number;
}

/**
 * Find transfers whose movementIds.expenseId or movementIds.incomeId is missing.
 * Action: complete_parent (flag for re-completion).
 */
export async function findIncompleteTransfers(
  transferRepo: TransferRepository,
  workspaceId: string,
): Promise<ReconcileAction[]> {
  const transfers = await transferRepo.findByWorkspaceId(workspaceId);
  const actions: ReconcileAction[] = [];

  for (const transfer of transfers) {
    const hasBothMovementIds =
      transfer.movementIds &&
      transfer.movementIds.expenseId &&
      transfer.movementIds.incomeId;

    if (!hasBothMovementIds) {
      actions.push({
        type: "complete_parent",
        description: `Transfer ${transfer.id} is missing linked movement(s)`,
        entity: "Transfer",
        entityId: transfer.id,
        details: {
          movementIds: transfer.movementIds ?? null,
        },
      });
    }
  }

  return actions;
}

/**
 * Find movements whose link.refId points to a deleted parent.
 * Action: delete_orphan.
 *
 * R15.2: the sweep reuses the canonical live-parent machinery
 * (`collectLiveParentIds` + `filterMovementsWithLiveParents`, the same
 * R6-P1/R7-A orphan semantics every read uses). Legacy movements whose UUID
 * refId fails the id lookup are value-reconciled exactly like in reads, so
 * the sweep never flags what the app still considers live.
 */
export async function findOrphanMovements(
  movementRepo: MovementRepository,
  transferRepo: TransferRepository,
  creditReceivedRepo: CreditReceivedRepository,
  creditGrantedRepo: CreditGrantedRepository,
  saleRepo: SaleRepository,
  accountRepo: AccountRepository,
  payableRepo: PayableRepository,
  workspaceId: string,
): Promise<ReconcileAction[]> {
  const movements = await movementRepo.findByWorkspaceId(workspaceId);
  const actions: ReconcileAction[] = [];

  // Current parent collections = the live set. Anything a movement links to
  // that is not in them is orphaned state left behind by a failed cascade.
  const live = collectLiveParentIds({
    accounts: await accountRepo.findByWorkspaceId(workspaceId),
    transfers: await transferRepo.findByWorkspaceId(workspaceId),
    creditsReceived: await creditReceivedRepo.findByWorkspaceId(workspaceId),
    creditsGranted: await creditGrantedRepo.findByWorkspaceId(workspaceId),
    sales: await saleRepo.findByWorkspaceId(workspaceId),
    payables: await payableRepo.findByWorkspaceId(workspaceId),
  });

  const liveMovementIds = new Set(
    filterMovementsWithLiveParents(movements, live).map((m) => m.id),
  );

  for (const movement of movements) {
    if (!movement.link) continue;
    // Unknown kinds are skipped (fail-open for detection): only the kinds the
    // domain knows how to resolve participate in the sweep.
    if (!isMovementLinkKind(movement.link.kind)) continue;

    if (liveMovementIds.has(movement.id)) continue;

    actions.push({
      type: "delete_orphan",
      description: `Movement ${movement.id} links to deleted ${movement.link.kind} parent ${movement.link.refId}`,
      entity: "Movement",
      entityId: movement.id,
      details: {
        link: movement.link,
      },
    });
  }

  return actions;
}

/**
 * Find sales with deletedAt set but stockRestored = false.
 * Action: restore_stock.
 */
export async function findPendingStockRestores(
  saleRepo: SaleRepository,
  workspaceId: string,
): Promise<ReconcileAction[]> {
  const sales = await saleRepo.findByWorkspaceId(workspaceId);
  const actions: ReconcileAction[] = [];

  for (const sale of sales) {
    if (sale.deletedAt && !sale.stockRestored) {
      actions.push({
        type: "restore_stock",
        description: `Sale ${sale.id} is soft-deleted but stock not restored`,
        entity: "Sale",
        entityId: sale.id,
      });
    }
  }

  return actions;
}

/**
 * Execute reconcile actions.
 * If dryRun: return actions without applying.
 * If not dryRun: apply each action and return result.
 */
export async function executeReconcile(
  actions: ReconcileAction[],
  dryRun: boolean,
): Promise<ReconcileResult> {
  if (dryRun) {
    return { dryRun: true, actions, applied: 0 };
  }

  // In production, each action type would dispatch to the appropriate repo
  // method (e.g., deleteOrphanMovements, restoreStock, etc.).
  // For now, the apply phase is a no-op placeholder — the reconcile utility
  // provides detection; application is wired by the application layer.
  return { dryRun: false, actions, applied: 0 };
}
