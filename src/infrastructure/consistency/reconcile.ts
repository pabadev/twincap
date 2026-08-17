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
} from "../../core/domain/repositories";

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
  userId: string,
): Promise<ReconcileAction[]> {
  const transfers = await transferRepo.findByUserId(userId);
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

/** Movement link kinds that reference a parent entity. */
const PARENT_LINK_KINDS = [
  "transfer",
  "creditReceivedPrincipal",
  "creditReceivedAbono",
  "creditGrantedPrincipal",
  "creditGrantedAbono",
  "salePayment",
] as const;

/**
 * Find movements whose link.refId points to a deleted parent.
 * Action: delete_orphan.
 */
export async function findOrphanMovements(
  movementRepo: MovementRepository,
  transferRepo: TransferRepository,
  creditReceivedRepo: CreditReceivedRepository,
  creditGrantedRepo: CreditGrantedRepository,
  saleRepo: SaleRepository,
  userId: string,
): Promise<ReconcileAction[]> {
  const movements = await movementRepo.findByUserId(userId);
  const actions: ReconcileAction[] = [];

  // Pre-load parent IDs per collection for efficient membership checks
  const transferIds = new Set(
    (await transferRepo.findByUserId(userId)).map((t) => t.id),
  );
  const creditReceivedIds = new Set(
    (await creditReceivedRepo.findByUserId(userId)).map((c) => c.id),
  );
  const creditGrantedIds = new Set(
    (await creditGrantedRepo.findByUserId(userId)).map((c) => c.id),
  );
  const saleIds = new Set(
    (await saleRepo.findByUserId(userId)).map((s) => s.id),
  );

  for (const movement of movements) {
    if (!movement.link) continue;
    if (!(PARENT_LINK_KINDS as readonly string[]).includes(movement.link.kind))
      continue;

    let parentExists = false;

    switch (movement.link.kind) {
      case "transfer":
        parentExists = transferIds.has(movement.link.refId);
        break;
      case "creditReceivedPrincipal":
      case "creditReceivedAbono":
        parentExists = creditReceivedIds.has(movement.link.refId);
        break;
      case "creditGrantedPrincipal":
      case "creditGrantedAbono":
        parentExists = creditGrantedIds.has(movement.link.refId);
        break;
      case "salePayment":
        parentExists = saleIds.has(movement.link.refId);
        break;
    }

    if (!parentExists) {
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
  }

  return actions;
}

/**
 * Find sales with deletedAt set but stockRestored = false.
 * Action: restore_stock.
 */
export async function findPendingStockRestores(
  saleRepo: SaleRepository,
  userId: string,
): Promise<ReconcileAction[]> {
  const sales = await saleRepo.findByUserId(userId);
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
