/**
 * Consistency sweep — DIAGNOSIS ONLY (design §5, R15.3 §21).
 *
 * Every detection function accepts repository interfaces (testable with
 * fakes). The sweep DETECTES anomalies (orphan/ambiguous/unknown movements,
 * incomplete links, pending stock restores) and reports them as actions; it
 * NEVER mutates data. There is no "apply" path: repairing financial data
 * requires transactional guarantees that are out of scope, so the contract
 * is honest — diagnostics, not repairs.
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
import {
  collectLiveParentIds,
  classifyLegacyMovement,
} from "../../core/application/movements";

export interface ReconcileAction {
  type: "complete_parent" | "delete_orphan" | "restore_stock" | "flag";
  description: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
}

/**
 * Result of a diagnosis run. `mode` is always 'diagnose': the sweep reports
 * anomalies, it does not apply fixes (R15.3 §21 — no fake repair contract).
 */
export interface ReconcileDiagnosis {
  mode: "diagnose";
  actions: ReconcileAction[];
  applied: 0;
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
 * Find movements whose link does not resolve to a live parent, were created
 * with a link kind outside the registry, or are ambiguous legacy movements.
 *
 * R15.2: the sweep reuses the canonical live-parent machinery
 * (`collectLiveParentIds` + {@link classifyLegacyMovement}, the same
 * R6-P1/R7-A orphan semantics every read uses). Legacy movements whose UUID
 * refId fails the id lookup are value-reconciled exactly like in reads, so
 * the sweep never flags what the app still considers live.
 *
 * R15.3 §13/§15 — the sweep reports the three diagnostic classes:
 *   - orphan       → delete_orphan   (parent provably deleted, cascade failed)
 *   - ambiguous    → flag            (>1 legacy candidates — NEVER deleted,
 *                                     only excluded + surfaced for review)
 *   - unknown kind → flag            (kind outside the registry — never
 *                                     treated as valid, never silently hidden)
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

  for (const movement of movements) {
    if (!movement.link) continue; // manual movements are always live

    const result = classifyLegacyMovement(movement, live);

    if (result.classification === "reconciled") continue;

    if (result.classification === "unknown-kind") {
      // Fail-closed: an unknown kind is never a valid movement (it cannot be
      // resolved to any parent) and never silently hidden — it is surfaced
      // with a flag, NOT a delete (we know nothing about its parent).
      actions.push({
        type: "flag",
        description:
          `Movement ${movement.id} has UNKNOWN link kind "${String(movement.link.kind)}" — ` +
          "excluded from financial calculations, inspect manually (R15.3 §15)",
        entity: "Movement",
        entityId: movement.id,
        details: { link: movement.link },
      });
      continue;
    }

    if (result.classification === "ambiguous") {
      // >1 legacy candidates: the real parent cannot be known. The movement
      // is excluded from every financial calculation but its data is intact —
      // flagging (not deleting) keeps the anomaly visible for review (§13).
      actions.push({
        type: "flag",
        description:
          `Movement ${movement.id} is AMBIGUOUS (${result.candidatesCount} legacy ` +
          `candidates for ${movement.link.kind}) — excluded from financial ` +
          "calculations, inspect manually (R15.3 §13)",
        entity: "Movement",
        entityId: movement.id,
        details: {
          link: movement.link,
          candidatesCount: result.candidatesCount,
        },
      });
      continue;
    }

    // orphan — a linked movement whose parent is provably gone.
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
 * Run a diagnosis over the detected actions.
 *
 * R15.3 §21 — honest contract: this NEVER applies repairs. The reconcile
 * utility is a diagnostic/detection tool; repairing financial data requires
 * transactional guarantees that are not implemented, so no path pretends
 * otherwise. `applied` is always 0 by construction.
 */
export async function runReconcileDiagnosis(
  actions: ReconcileAction[],
): Promise<ReconcileDiagnosis> {
  return { mode: "diagnose", actions, applied: 0 };
}