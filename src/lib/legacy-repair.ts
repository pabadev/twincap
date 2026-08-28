/**
 * R5-F legacy data repair planning (pure, testable).
 *
 * Detects the five legacy problems identified by the R5 audit and derives
 * the concrete repair actions for them. The pure functions here never touch
 * repositories; `scripts/reconcile-legacy.mjs` runs the produced plan against
 * MongoDB and parses the loaded documents into the snapshots defined below.
 *
 * Because the old-model data stored sales/credits/transfers with UUID-style
 * string ids and the current model uses Mongo ObjectId `_id`s, many
 * `movements.link.refId` values still point to the OLD UUID instead of the
 * current ObjectId of their parent document. The repair contract therefore
 * includes relinking stale refIds to their current parent ids, locating
 * transfer legs by VALUE (account/date/amount) rather than by stored refId,
 * and only treating credits whose sale is genuinely gone as orphans.
 */

/** A sale in a form the pure planner can reason about. */
export interface LegacySaleSnapshot {
  /** ObjectId string. */
  id: string;
  userId: string;
  paymentMode: string;
  /** Total in minor units. */
  total: number;
  /** Sum of embedded abonos amounts in minor units. */
  abonosSum: number;
  accountId: string;
  date: Date;
  clientId?: string | null;
  deletedAt?: Date | null;
}

/** A credit (creditgranteds) in planner form. */
export interface LegacyCreditSnapshot {
  /** ObjectId string. */
  id: string;
  /** ObjectId string of the parent sale when known; the OLD UUID otherwise. */
  saleId?: string | null;
  accountId: string;
  date: Date;
  principal: number;
}

/** A transfer in planner form. Transfers have NO accountId. */
export interface LegacyTransferSnapshot {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: number;
  destinationAmount: number;
  date: Date;
  movementIds?: { expenseId?: string | null; incomeId?: string | null } | null;
}

/**
 * A transfer movement leg, resolved BY VALUE in the script. transferId is
 * already the current transfer ObjectId even when the stored refId is an old
 * UUID.
 */
export interface LegacyTransferLegSnapshot {
  /** The movement's own id (ObjectId string). */
  movementId: string;
  /** The current transfer ObjectId string this leg belongs to. */
  transferId: string;
  type: "income" | "expense";
}

/** A movement whose link.refId points to an OLD UUID that matches nothing. */
export interface LegacyStaleRefMovementSnapshot {
  /** ObjectId string. */
  id: string;
  kind: "salePayment" | "creditGrantedPrincipal" | "creditReceivedPrincipal" | "transfer";
  /** The old UUID stored in link.refId. */
  refId: string;
  accountId: string;
  date: Date;
  amount: number;
}

/** Create a CreditGranted that owns the current pending debt of a legacy sale. */
export interface CreateSaleCreditAction {
  type: "create_sale_credit";
  /** ObjectId string of the sale. */
  saleId: string;
  userId: string;
  /** Current pending debt = total − Σ embedded abonos. */
  principal: number;
  accountId: string;
  date: Date;
  clientId?: string | null;
  description: string;
}

/** Link an existing credit to its sale (saleId was stale/empty). */
export interface LinkSaleCreditAction {
  type: "link_sale_credit";
  creditId: string;
  /** Current ObjectId string of the sale. */
  saleId: string;
  description: string;
}

/** Delete a TRUE orphan credit: saleId points to no sale AND nothing matches. */
export interface DeleteOrphanCreditAction {
  type: "delete_orphan_credit";
  creditId: string;
  saleId: string;
  description: string;
}

/** Persist the two movement legs of a legacy transfer. */
export interface LinkTransferMovementsAction {
  type: "link_transfer_movements";
  transferId: string;
  expenseId?: string;
  incomeId?: string;
  description: string;
}

/** Move a movement refId from the OLD UUID to the current parent ObjectId. */
export interface RelinkMovementRefIdAction {
  type: "relink_movement_ref_id";
  movementId: string;
  movementKind: string;
  oldRefId: string;
  newParentId: string;
  description: string;
}

/** Delete a movement with no possible parent (deleted sale/transfer residue). */
export interface DeleteOrphanMovementAction {
  type: "delete_orphan_movement";
  movementId: string;
  movementKind: string;
  refId: string;
  description: string;
}

/** Purge a sale left over from the old soft-delete model (full cascade). */
export interface PurgeSoftDeletedSaleAction {
  type: "purge_soft_deleted_sale";
  saleId: string;
  description: string;
}

export type LegacyRepairAction =
  | CreateSaleCreditAction
  | LinkSaleCreditAction
  | DeleteOrphanCreditAction
  | LinkTransferMovementsAction
  | RelinkMovementRefIdAction
  | DeleteOrphanMovementAction
  | PurgeSoftDeletedSaleAction;

/** Result of a parent look-up used to classify a stale movement. */
export type ParentResolution =
  | { status: "unique"; parentId: string }
  | { status: "none" }
  | { status: "ambiguous" };

/** Resolves candidate parents for stale movements by value. */
export interface StaleParentResolver {
  salePayment(accountId: string, date: Date, amount: number): ParentResolution;
  creditPrincipal(accountId: string, date: Date, amount: number): ParentResolution;
}

/**
 * Derive the full plan of repairs in a stable order:
 *   1. create/link sale credits
 *   2. orphan credits (stale saleId relink vs delete)
 *   3. transfer movement links
 *   4. stale refId relinks / orphan movement deletes
 *   5. soft-deleted sale purges
 */
export function buildLegacyRepairPlan(
  sales: LegacySaleSnapshot[],
  credits: LegacyCreditSnapshot[],
  transfers: LegacyTransferSnapshot[],
  transferLegs: LegacyTransferLegSnapshot[],
  staleMovements: LegacyStaleRefMovementSnapshot[],
  parentResolver: StaleParentResolver,
): LegacyRepairAction[] {
  return [
    ...planSaleCreditRepairs(sales, credits),
    ...planOrphanCreditRepairs(sales, credits),
    ...planTransferMovementLinks(transfers, transferLegs),
    ...planRelinkOrDeleteMovements(staleMovements, parentResolver),
    ...planSoftDeletedSalePurges(sales),
  ];
}

/** Compare two dates on the same business day (within 1 day). */
function sameBusinessDate(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= 24 * 60 * 60 * 1000;
}

/**
 * Every non-deleted on-credit sale must own a CreditGranted carrying its debt.
 * If an existing credit matches the sale by value and is NOT already owned by
 * another live sale (empty saleId OR stale/non-live saleId), LINK it; if only
 * the sale exists, CREATE one; if several candidates match, the mapping is
 * ambiguous so no action is produced.
 */
export function planSaleCreditRepairs(
  sales: LegacySaleSnapshot[],
  credits: LegacyCreditSnapshot[],
): (CreateSaleCreditAction | LinkSaleCreditAction)[] {
  const liveSaleIds = new Set(sales.filter((s) => !s.deletedAt).map((s) => s.id));
  const actions: (CreateSaleCreditAction | LinkSaleCreditAction)[] = [];

  for (const s of sales) {
    if (s.paymentMode !== "on-credit" || s.deletedAt) continue;
    if (credits.some((c) => c.saleId === s.id)) continue;

    const candidates = credits.filter(
      (c) =>
        (!c.saleId || !liveSaleIds.has(c.saleId)) &&
        c.accountId === s.accountId &&
        sameBusinessDate(c.date, s.date) &&
        c.principal <= s.total,
    );

    if (candidates.length === 1) {
      actions.push({
        type: "link_sale_credit",
        creditId: candidates[0].id,
        saleId: s.id,
        description:
          `Sale ${s.id} (on-credit) matches existing credit ${candidates[0].id} ` +
          `(empty or stale saleId) by account/date/principal; linking credit to sale`,
      });
    } else if (candidates.length === 0) {
      const principal = Math.max(0, s.total - s.abonosSum);
      actions.push({
        type: "create_sale_credit",
        saleId: s.id,
        userId: s.userId,
        principal,
        accountId: s.accountId,
        date: s.date,
        clientId: s.clientId,
        description:
          `Sale ${s.id} (on-credit, total ${s.total}, paid ${s.abonosSum}) ` +
          `has no linked CreditGranted; creating one owning pending ${principal}`,
      });
    }
    // candidates.length > 1 → ambiguous → no action.
  }

  return actions;
}

/**
 * Credits with a non-empty saleId that is NOT a live sale id. If at least one
 * live sale matches by value, the credit is alive and will be relinked by
 * `planSaleCreditRepairs` (which claims it per sale); emit nothing here. Only
 * when NO live sale matches by value is the credit a TRUE orphan that must be
 * deleted.
 */
export function planOrphanCreditRepairs(
  sales: LegacySaleSnapshot[],
  credits: LegacyCreditSnapshot[],
): DeleteOrphanCreditAction[] {
  const liveSales = sales.filter((s) => !s.deletedAt);
  const liveSaleIds = new Set(liveSales.map((s) => s.id));
  const actions: DeleteOrphanCreditAction[] = [];

  for (const c of credits) {
    if (!c.saleId) continue;
    if (liveSaleIds.has(c.saleId)) continue;

    const matches = liveSales.filter(
      (s) =>
        s.accountId === c.accountId &&
        sameBusinessDate(s.date, c.date) &&
        c.principal === s.total,
    );

    if (matches.length === 0) {
      actions.push({
        type: "delete_orphan_credit",
        creditId: c.id,
        saleId: c.saleId,
        description:
          `Credit ${c.id} was born from sale ${c.saleId} which no longer ` +
          `exists and no live sale matches; deleting the orphan credit and its movements`,
      });
    }
    // Otherwise (one or several live matches) the credit is alive and gets
    // relinked by planSaleCreditRepairs — ambiguity must not delete anything.
  }

  return actions;
}

/**
 * Transfers must persist movementIds so deleteTransfer can reverse both legs.
 * Legs are located BY VALUE in the script (account/date/amount), so their
 * transferId is already the current ObjectId even when the stored refId is an
 * old UUID.
 */
export function planTransferMovementLinks(
  transfers: LegacyTransferSnapshot[],
  transferLegs: LegacyTransferLegSnapshot[],
): LinkTransferMovementsAction[] {
  const actions: LinkTransferMovementsAction[] = [];

  for (const transfer of transfers) {
    const hasExpense = Boolean(transfer.movementIds?.expenseId);
    const hasIncome = Boolean(transfer.movementIds?.incomeId);
    if (hasExpense && hasIncome) continue;

    const legs = transferLegs.filter((l) => l.transferId === transfer.id);
    const expenseLeg = legs.find((l) => l.type === "expense");
    const incomeLeg = legs.find((l) => l.type === "income");

    const missing: string[] = [];
    if (!hasExpense && !expenseLeg) missing.push("expense");
    if (!hasIncome && !incomeLeg) missing.push("income");

    actions.push({
      type: "link_transfer_movements",
      transferId: transfer.id,
      ...(!hasExpense && expenseLeg ? { expenseId: expenseLeg.movementId } : {}),
      ...(!hasIncome && incomeLeg ? { incomeId: incomeLeg.movementId } : {}),
      description:
        missing.length > 0
          ? `Transfer ${transfer.id} missing movement leg(s): ${missing.join(", ")}`
          : `Transfer ${transfer.id} has no persisted movementIds; linking movement legs`,
    });
  }

  return actions;
}

/**
 * Movements whose link.refId points to an old UUID (or whose parent is gone).
 * A unique value-matching parent relinks the refId to the current ObjectId; no
 * parent means the parent doc was deleted (orphan residue) so the movement is
 * deleted; ambiguity is skipped. Transfer-kind movements have no live parent
 * that can claim them by value once the script excluded the linked legs, so
 * they always resolve to "none" → delete. Any unknown kind is likewise
 * treated as a delete (defensive).
 */
export function planRelinkOrDeleteMovements(
  staleMovements: LegacyStaleRefMovementSnapshot[],
  parentResolver: StaleParentResolver,
): (RelinkMovementRefIdAction | DeleteOrphanMovementAction)[] {
  const actions: (RelinkMovementRefIdAction | DeleteOrphanMovementAction)[] = [];

  for (const m of staleMovements) {
    let resolution: ParentResolution;
    if (m.kind === "salePayment") {
      resolution = parentResolver.salePayment(m.accountId, m.date, m.amount);
    } else if (
      m.kind === "creditGrantedPrincipal" ||
      m.kind === "creditReceivedPrincipal"
    ) {
      resolution = parentResolver.creditPrincipal(m.accountId, m.date, m.amount);
    } else {
      resolution = { status: "none" };
    }

    if (resolution.status === "unique") {
      actions.push({
        type: "relink_movement_ref_id",
        movementId: m.id,
        movementKind: m.kind,
        oldRefId: m.refId,
        newParentId: resolution.parentId,
        description:
          `Movement ${m.id} (${m.kind}) refId ${m.refId} is stale; relinking to ` +
          `current parent ${resolution.parentId}`,
      });
    } else if (resolution.status === "none") {
      actions.push({
        type: "delete_orphan_movement",
        movementId: m.id,
        movementKind: m.kind,
        refId: m.refId,
        description:
          `Movement ${m.id} (${m.kind}) has no possible parent (refId ${m.refId} ` +
          `matches nothing); deleting orphan movement`,
      });
    }
    // ambiguous → skip.
  }

  return actions;
}

/** Old soft-delete model left docs with deletedAt — purge them (hard cascade). */
export function planSoftDeletedSalePurges(
  sales: LegacySaleSnapshot[],
): PurgeSoftDeletedSaleAction[] {
  return sales
    .filter((s) => Boolean(s.deletedAt))
    .map((s) => ({
      type: "purge_soft_deleted_sale" as const,
      saleId: s.id,
      description:
        `Sale ${s.id} still carries the legacy soft-delete vestige; ` +
        `purging via full cascade (stock restore, movements, linked credit)`,
    }));
}
