/**
 * Repository interfaces for all domain entities.
 *
 * Design rules (rev.2):
 * - workspaceId-first parameter order: every query is scoped to the owning workspace.
 * - R14-B/R15: transactional writes accept an OPTIONAL trailing TransactionHandle
 *   so multi-document use cases commit atomically (real Mongo transactions).
 *   When the handle is present the write joins the caller's transaction; when
 *   absent the write behaves exactly as before (single-document path).
 * - R15-F4: debt mutating writes also accept an OPTIONAL trailing
 *   `expectedVersion?: number` (CAS on `__v`). When provided, the write aborts
 *   with ConflictError(DEBT_MODIFIED_MSG) if the document was modified
 *   concurrently; when absent, behavior is unchanged.
 * - R15-F5: account concurrency — `AccountRepository.findById` accepts an
 *   OPTIONAL trailing TransactionHandle (snapshot-consistent balance reads
 *   inside a transaction) and `AccountRepository.bumpVersion` provides a CAS
 *   bump of the account `__v` (transfer-origin balance protection).
 * - All ids are plain strings (no ObjectId leak).
 * - ConflictError on unique constraint violations.
 * - IdGenerator is a separate port (ports.ts), not part of repositories.
 */

import type { Account } from "./account";
import type { CatalogItem } from "./catalog";
import type { Category } from "./category";
import type { Client } from "./client";
import type { CreditGranted } from "./credit-granted";
import type { CreditReceived } from "./credit-received";
import type { Membership } from "./membership";
import type { Movement } from "./movement";
import type { Payable } from "./payable";
import type { Sale } from "./sale";
import type { Transfer } from "./transfer";
import type { TransactionHandle } from "./transaction";
import type { User } from "./user";
import type { Workspace } from "./workspace";

// ─── User ────────────────────────────────────────────────────────────

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** @param tx optional transaction handle (R15-F6): the write joins the
   *   caller's transaction (register onboarding). */
  create(user: User, tx?: TransactionHandle): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}

// ─── Account ─────────────────────────────────────────────────────────

export interface AccountRepository {
  /** @param tx optional transaction handle (R15 F5): the read joins the
   *   caller's transaction session (snapshot-consistent balance validation
   *   for transfer origins/destinations). */
  findById(workspaceId: string, id: string, tx?: TransactionHandle): Promise<Account | null>;
  findByWorkspaceId(workspaceId: string): Promise<Account[]>;
  /** @param tx optional transaction handle (R15-F6): the write joins the
   *   caller's transaction (createAccount and register seed). */
  create(account: Account, tx?: TransactionHandle): Promise<Account>;
  update(account: Account): Promise<Account>;
  /** @param tx optional transaction handle (R15-F6): the write joins the
   *   caller's transaction (createAccount rollback path). */
  delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void>;
  /** R15.1-6e: shared-document write that makes the account a transaction
   *  conflict point. createMovement touches the account doc INSIDE its
   *  transaction before inserting, so a concurrent deleteAccount (which deletes
   *  that same doc) cannot interleave between the create's read and its insert:
   *  the race becomes a write-write conflict on the account doc instead of a
   *  write skew, the loser aborts and re-executes on the winner's committed
   *  state — no orphaned movements in any terminal. Plain `updateOne`, no CAS.
   *  @returns true when the account exists and was touched; false when it is
   *  gone (the caller maps false to NotFoundError).
   *  @param tx optional transaction handle; joins the caller's transaction. */
  touch(workspaceId: string, accountId: string, tx?: TransactionHandle): Promise<boolean>;
  /** ACC-4: count references across all collections (movements, transfers, credits, sales).
   *  @param tx optional transaction handle (R15.1-6e): when present, every
   *   count joins the caller's transaction session so the deletion guard runs
   *   on the SAME snapshot as the account read (used by transactional
   *   deleteAccount — the counts run serially on a session, never in
   *   parallel, because the MongoDB driver forbids concurrent ops on one
   *   ClientSession). */
  countReferences(workspaceId: string, accountId: string, tx?: TransactionHandle): Promise<number>;
  /**
   * R15-F5: optimistic-concurrency bump of the account `__v`.
   * `$inc __v` only when the persisted version still equals `expectedVersion`.
   *
   * @returns true when the bump applied (and the version moved to
   *   `expectedVersion + 1`), false when the document was modified
   *   concurrently (or does not exist). The caller decides the failure
   *   semantics: `ConflictError(DEBT_MODIFIED_MSG)` for balance protection.
   * @param tx optional transaction handle; joins the caller's transaction
   *   (used by createTransfer: the CAS is the last write of the transaction).
   */
  bumpVersion(
    workspaceId: string,
    accountId: string,
    expectedVersion: number,
    tx?: TransactionHandle,
  ): Promise<boolean>;
}

// ─── Category ────────────────────────────────────────────────────────

export interface CategoryRepository {
  findById(workspaceId: string, id: string): Promise<Category | null>;
  findByWorkspaceId(workspaceId: string): Promise<Category[]>;
  /** For uniqueness check: name + type scoped to workspace (CAT-2). */
  findByNameAndType(workspaceId: string, name: string, type: string): Promise<Category | null>;
  /** @param tx optional transaction handle (R15-F6): the write joins the
   *   caller's transaction (register seed). */
  create(category: Category, tx?: TransactionHandle): Promise<Category>;
  update(category: Category): Promise<Category>;
  delete(workspaceId: string, id: string): Promise<void>;
}

// ─── Movement ────────────────────────────────────────────────────────

export interface MovementRepository {
  findById(workspaceId: string, id: string): Promise<Movement | null>;
  findByWorkspaceId(workspaceId: string): Promise<Movement[]>;
  /** @param tx optional transaction handle (R15.1-6e): the movement-docs read
   *   joins the caller's transaction session (snapshot-consistent cascade read
   *   in transactional deleteAccount). */
  findByAccountId(workspaceId: string, accountId: string, tx?: TransactionHandle): Promise<Movement[]>;
  /**
   * Cursor-based paginated query across all workspace movements.
   * @param cursor Optional `{ date, createdAt }` of the last item from the previous page.
   * @returns `{ items, nextCursor }` — `nextCursor` is `null` when no more pages.
   */
  findPaged(
    workspaceId: string,
    limit: number,
    cursor?: { date: Date; createdAt: Date },
  ): Promise<{ items: Movement[]; nextCursor: { date: Date; createdAt: Date } | null }>;
  /**
   * Persist a new movement.
   * @param tx optional R14-B transaction handle; all writes join the same transaction.
   */
  create(movement: Movement, tx?: TransactionHandle): Promise<Movement>;
  /**
   * Update an existing movement.
   * @param tx optional transaction handle (R15); the write joins the caller's
   *   transaction when present (used by transactional abono/edit/delete cascades).
   */
  update(movement: Movement, tx?: TransactionHandle): Promise<Movement>;
  /**
   * Delete a single movement.
   * @param tx optional transaction handle (R15); joins the caller's transaction.
   */
  delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void>;
  /** Delete ALL movements that reference a parent id via link.refId (robust
   *  cascade, format-agnostic — covers ObjectId and legacy UUID refIds).
   *  @param tx optional transaction handle (R15); joins the caller's transaction. */
  deleteByRefId(workspaceId: string, refId: string, tx?: TransactionHandle): Promise<number>;
  /** Windowed dashboard read: workspace movements whose civil date is within [from, to) sorted date-desc, createdAt-desc. Same orphan guard + dependency resolution as findByWorkspaceId. */
  findByWorkspaceIdAndDateRange(workspaceId: string, from: Date, to: Date): Promise<Movement[]>;
  /** Full-history minimal-projection read for R7-A account balances (live-parent-filtered). Same orphan guard + dependency resolution as findByWorkspaceId. */
  findByWorkspaceIdForBalance(workspaceId: string): Promise<Movement[]>;
  /** Σ signedAmount grouped by accountId (design rev.2 §2 derived balance).
   *  @param tx optional transaction handle (R15 F5): the read joins the
   *   caller's transaction session (snapshot-consistent balance validation
   *   for transfer origins/destinations). */
  aggregateBalance(workspaceId: string, accountId: string, tx?: TransactionHandle): Promise<number>;
  /** CAT-3: count movements referencing a category (deletion guard). */
  countByCategoryId(workspaceId: string, categoryId: string): Promise<number>;
}

// ─── Transfer ────────────────────────────────────────────────────────

export interface TransferRepository {
  findById(workspaceId: string, id: string): Promise<Transfer | null>;
  findByWorkspaceId(workspaceId: string): Promise<Transfer[]>;
  /**
   * Persist a new transfer.
   * @param tx optional R14-B transaction handle; all writes join the same transaction.
   */
  create(transfer: Transfer, tx?: TransactionHandle): Promise<Transfer>;
  /**
   * Update an existing transfer.
   * @param tx optional transaction handle (R15); joins the caller's transaction
   *   (used by transactional updateTransfer).
   */
  update(transfer: Transfer, tx?: TransactionHandle): Promise<Transfer>;
  /**
   * Delete a transfer.
   * @param tx optional transaction handle (R15); joins the caller's transaction
   *   (used by transactional deleteTransfer).
   */
  delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void>;
  /**
   * Find a transfer by its raw id, scoped to the owning workspace (R14-K §15).
   * The workspace filter makes the raw read tenant-safe: a caller can never
   * retrieve a transfer that belongs to another workspace.
   */
  findByIdRaw(workspaceId: string, id: string): Promise<Transfer | null>;
}

// ─── Credit Received ─────────────────────────────────────────────────

export interface CreditReceivedRepository {
  /** @param tx optional transaction handle (R15 Fase 3): the read joins the
   *   caller's transaction session (snapshot-consistent aggregate validation). */
  findById(workspaceId: string, id: string, tx?: TransactionHandle): Promise<CreditReceived | null>;
  /** @param tx optional transaction handle (R15 Fase 3): the read joins the
   *   caller's transaction session (snapshot-consistent aggregate validation). */
  findByWorkspaceId(workspaceId: string, tx?: TransactionHandle): Promise<CreditReceived[]>;
  /**
   * Persist a new received credit.
   * @param tx optional transaction handle (R15); joins the caller's transaction
   *   (Fase 2 createCreditReceived: credit + principal movement).
   */
  create(credit: CreditReceived, tx?: TransactionHandle): Promise<CreditReceived>;
  /**
   * Replace the full credit document.
   * @param tx optional transaction handle (R15); joins the caller's transaction
   *   (Fase 5 editPrincipal cascade).
   */
  update(credit: CreditReceived, tx?: TransactionHandle, expectedVersion?: number): Promise<CreditReceived>;
  /**
   * Delete a received credit (cascade use cases; transactional deleteCreditReceived
   * needs it inside the transaction, R15.1 Fase 3).
   * @param tx optional transaction handle (R15); joins the caller's transaction.
   */
  delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  addAbono(workspaceId: string, creditId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  editAbono(workspaceId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  deleteAbono(workspaceId: string, creditId: string, abonoId: string, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
}

// ─── Credit Granted ──────────────────────────────────────────────────

export interface CreditGrantedRepository {
  /** @param tx optional transaction handle (R15 Fase 3): the read joins the
   *   caller's transaction session (snapshot-consistent aggregate validation). */
  findById(workspaceId: string, id: string, tx?: TransactionHandle): Promise<CreditGranted | null>;
  /** @param tx optional transaction handle (R15 Fase 3): the read joins the
   *   caller's transaction session (snapshot-consistent aggregate validation). */
  findByWorkspaceId(workspaceId: string, tx?: TransactionHandle): Promise<CreditGranted[]>;
  /**
   * Persist a new granted credit.
   * @param tx optional R14-B transaction handle; all writes join the same transaction.
   */
  create(credit: CreditGranted, tx?: TransactionHandle): Promise<CreditGranted>;
  update(credit: CreditGranted, tx?: TransactionHandle, expectedVersion?: number): Promise<CreditGranted>;
  /**
   * Delete a granted credit (cascade use cases; transactional deleteSale needs
   * it inside the transaction, Fase 6).
   * @param tx optional transaction handle (R15); joins the caller's transaction.
   */
  delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  addAbono(workspaceId: string, creditId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string; capitalAmount?: number; interestAmount?: number; interestMovementId?: string }, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5).
   *  An explicitly `undefined` value is turned into `$unset` so split fields
   *  (e.g. interestMovementId when a portion drops to zero) can be cleared.
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  editAbono(workspaceId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string; capitalAmount: number; interestAmount: number; interestMovementId: string }>, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  deleteAbono(workspaceId: string, creditId: string, abonoId: string, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
  /** R9/D9.4: mark the credit as written off (`$set` on the writtenOff marker).
   *  @param tx optional transaction handle (R15); joins the caller's transaction
   *  (Fase 5 writeOffCreditGranted: movement + marker). */
  markWrittenOff(workspaceId: string, creditId: string, writtenOff: { date: Date; movementId: string }, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
}

// ─── Payable ─────────────────────────────────────────────────────────

export interface PayableRepository {
  /** @param tx optional transaction handle (R15 Fase 3): the read joins the
   *   caller's transaction session (snapshot-consistent aggregate validation). */
  findById(workspaceId: string, id: string, tx?: TransactionHandle): Promise<Payable | null>;
  /** @param tx optional transaction handle (R15 Fase 3): the read joins the
   *   caller's transaction session (snapshot-consistent aggregate validation). */
  findByWorkspaceId(workspaceId: string, tx?: TransactionHandle): Promise<Payable[]>;
  /**
   * Persist a new payable.
   * @param tx optional transaction handle (R15); joins the caller's transaction
   *   (Fase 2 createPayable: payable + initial-payment movement).
   */
  create(payable: Payable, tx?: TransactionHandle): Promise<Payable>;
  /**
   * Replace the full payable document.
   * @param tx optional transaction handle (R15); joins the caller's transaction
   *   (edit-total aggregation writes inside transactional contexts).
   */
  update(payable: Payable, tx?: TransactionHandle, expectedVersion?: number): Promise<Payable>;
  /**
   * Delete a payable (cascade use cases; transactional deletePayable needs it
   * inside the transaction, R15.1 Fase 3).
   * @param tx optional transaction handle (R15); joins the caller's transaction.
   */
  delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  addAbono(workspaceId: string, payableId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  editAbono(workspaceId: string, payableId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  deleteAbono(workspaceId: string, payableId: string, abonoId: string, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
}

// ─── Client ─────────────────────────────────────────────────────────

export interface ClientRepository {
  findById(workspaceId: string, id: string): Promise<Client | null>;
  findByWorkspaceId(workspaceId: string): Promise<Client[]>;
  findByName(workspaceId: string, name: string): Promise<Client | null>;
  create(client: Client): Promise<Client>;
  update(client: Client): Promise<Client>;
  delete(workspaceId: string, id: string): Promise<void>;
}

// ─── Catalog Item ────────────────────────────────────────────────────

export interface CatalogItemRepository {
  /** @param tx optional transaction handle (R15-F6): the read joins the
   *   caller's transaction (deleteSale reads the item INSIDE the tx so the
   *   stock restore is snapshot-consistent). */
  findById(workspaceId: string, id: string, tx?: TransactionHandle): Promise<CatalogItem | null>;
  findByWorkspaceId(workspaceId: string): Promise<CatalogItem[]>;
  create(item: CatalogItem): Promise<CatalogItem>;
  update(item: CatalogItem): Promise<CatalogItem>;
  delete(workspaceId: string, id: string): Promise<void>;
  /**
   * Atomic stock decrement for products (POS-3). Returns false if insufficient stock.
   * @param tx optional R14-B transaction handle; all writes join the same transaction.
   */
  decrementStock(workspaceId: string, itemId: string, quantity: number, tx?: TransactionHandle): Promise<boolean>;
  /** Atomic stock increment for products (stock restore on sale delete).
   *  @param tx optional transaction handle (R15); joins the caller's transaction
   *  (Fase 6 deleteSale: stock restore inside the transaction). */
  incrementStock(workspaceId: string, itemId: string, quantity: number, tx?: TransactionHandle): Promise<void>;
}

// ─── Sale ────────────────────────────────────────────────────────────

export interface SaleRepository {
  /** @param tx optional transaction handle (R15 Fase 3): the read joins the
   *   caller's transaction session (snapshot-consistent aggregate validation). */
  findById(workspaceId: string, id: string, tx?: TransactionHandle): Promise<Sale | null>;
  /** @param tx optional transaction handle (R15 Fase 3): the read joins the
   *   caller's transaction session (snapshot-consistent aggregate validation). */
  findByWorkspaceId(workspaceId: string, tx?: TransactionHandle): Promise<Sale[]>;
  /**
   * Persist a new sale.
   * @param tx optional R14-B transaction handle; all writes join the same transaction.
   */
  create(sale: Sale, tx?: TransactionHandle): Promise<Sale>;
  update(sale: Sale, tx?: TransactionHandle, expectedVersion?: number): Promise<Sale>;
  /**
   * Delete a sale.
   * @param tx optional transaction handle (R15); joins the caller's transaction
   *   (Fase 6 deleteSale cascade).
   */
  delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  addAbono(workspaceId: string, saleId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  editAbono(workspaceId: string, saleId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  deleteAbono(workspaceId: string, saleId: string, abonoId: string, tx?: TransactionHandle, expectedVersion?: number): Promise<void>;
}

// ─── Workspace ──────────────────────────────────────────────────────

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  /** @param tx optional transaction handle (R15-F6): the write joins the
   *   caller's transaction (register onboarding). */
  create(workspace: Workspace, tx?: TransactionHandle): Promise<Workspace>;
  update(workspace: Workspace): Promise<Workspace>;
  delete(id: string): Promise<void>;
}

// ─── Membership ─────────────────────────────────────────────────────

export interface MembershipRepository {
  findById(id: string): Promise<Membership | null>;
  /** Active membership for a user+workspace, if any. */
  findActiveByUserAndWorkspace(userId: string, workspaceId: string): Promise<Membership | null>;
  findByUserId(userId: string): Promise<Membership[]>;
  /** @param tx optional transaction handle (R15-F6): the write joins the
   *   caller's transaction (register onboarding). */
  create(membership: Membership, tx?: TransactionHandle): Promise<Membership>;
  update(membership: Membership): Promise<Membership>;
  delete(id: string): Promise<void>;
}
