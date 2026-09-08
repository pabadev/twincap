/**
 * Repository interfaces for all domain entities.
 *
 * Design rules (rev.2):
 * - workspaceId-first parameter order: every query is scoped to the owning workspace.
 * - R14-B/R15: transactional writes accept an OPTIONAL trailing TransactionHandle
 *   so multi-document use cases commit atomically (real Mongo transactions).
 *   When the handle is present the write joins the caller's transaction; when
 *   absent the write behaves exactly as before (single-document path).
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
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}

// ─── Account ─────────────────────────────────────────────────────────

export interface AccountRepository {
  findById(workspaceId: string, id: string): Promise<Account | null>;
  findByWorkspaceId(workspaceId: string): Promise<Account[]>;
  create(account: Account): Promise<Account>;
  update(account: Account): Promise<Account>;
  delete(workspaceId: string, id: string): Promise<void>;
  /** ACC-4: count references across all collections (movements, transfers, credits, sales). */
  countReferences(workspaceId: string, accountId: string): Promise<number>;
}

// ─── Category ────────────────────────────────────────────────────────

export interface CategoryRepository {
  findById(workspaceId: string, id: string): Promise<Category | null>;
  findByWorkspaceId(workspaceId: string): Promise<Category[]>;
  /** For uniqueness check: name + type scoped to workspace (CAT-2). */
  findByNameAndType(workspaceId: string, name: string, type: string): Promise<Category | null>;
  create(category: Category): Promise<Category>;
  update(category: Category): Promise<Category>;
  delete(workspaceId: string, id: string): Promise<void>;
}

// ─── Movement ────────────────────────────────────────────────────────

export interface MovementRepository {
  findById(workspaceId: string, id: string): Promise<Movement | null>;
  findByWorkspaceId(workspaceId: string): Promise<Movement[]>;
  findByAccountId(workspaceId: string, accountId: string): Promise<Movement[]>;
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
  /** Σ signedAmount grouped by accountId (design rev.2 §2 derived balance). */
  aggregateBalance(workspaceId: string, accountId: string): Promise<number>;
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
  findById(workspaceId: string, id: string): Promise<CreditReceived | null>;
  findByWorkspaceId(workspaceId: string): Promise<CreditReceived[]>;
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
  update(credit: CreditReceived, tx?: TransactionHandle): Promise<CreditReceived>;
  delete(workspaceId: string, id: string): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  addAbono(workspaceId: string, creditId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }, tx?: TransactionHandle): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  editAbono(workspaceId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>, tx?: TransactionHandle): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  deleteAbono(workspaceId: string, creditId: string, abonoId: string, tx?: TransactionHandle): Promise<void>;
}

// ─── Credit Granted ──────────────────────────────────────────────────

export interface CreditGrantedRepository {
  findById(workspaceId: string, id: string): Promise<CreditGranted | null>;
  findByWorkspaceId(workspaceId: string): Promise<CreditGranted[]>;
  /**
   * Persist a new granted credit.
   * @param tx optional R14-B transaction handle; all writes join the same transaction.
   */
  create(credit: CreditGranted, tx?: TransactionHandle): Promise<CreditGranted>;
  update(credit: CreditGranted, tx?: TransactionHandle): Promise<CreditGranted>;
  /**
   * Delete a granted credit (cascade use cases; transactional deleteSale needs
   * it inside the transaction, Fase 6).
   * @param tx optional transaction handle (R15); joins the caller's transaction.
   */
  delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  addAbono(workspaceId: string, creditId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string; capitalAmount?: number; interestAmount?: number; interestMovementId?: string }, tx?: TransactionHandle): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5).
   *  An explicitly `undefined` value is turned into `$unset` so split fields
   *  (e.g. interestMovementId when a portion drops to zero) can be cleared.
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  editAbono(workspaceId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string; capitalAmount: number; interestAmount: number; interestMovementId: string }>, tx?: TransactionHandle): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  deleteAbono(workspaceId: string, creditId: string, abonoId: string, tx?: TransactionHandle): Promise<void>;
  /** R9/D9.4: mark the credit as written off (`$set` on the writtenOff marker).
   *  @param tx optional transaction handle (R15); joins the caller's transaction
   *  (Fase 5 writeOffCreditGranted: movement + marker). */
  markWrittenOff(workspaceId: string, creditId: string, writtenOff: { date: Date; movementId: string }, tx?: TransactionHandle): Promise<void>;
}

// ─── Payable ─────────────────────────────────────────────────────────

export interface PayableRepository {
  findById(workspaceId: string, id: string): Promise<Payable | null>;
  findByWorkspaceId(workspaceId: string): Promise<Payable[]>;
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
  update(payable: Payable, tx?: TransactionHandle): Promise<Payable>;
  delete(workspaceId: string, id: string): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  addAbono(workspaceId: string, payableId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }, tx?: TransactionHandle): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  editAbono(workspaceId: string, payableId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>, tx?: TransactionHandle): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  deleteAbono(workspaceId: string, payableId: string, abonoId: string, tx?: TransactionHandle): Promise<void>;
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
  findById(workspaceId: string, id: string): Promise<CatalogItem | null>;
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
  findById(workspaceId: string, id: string): Promise<Sale | null>;
  findByWorkspaceId(workspaceId: string): Promise<Sale[]>;
  /**
   * Persist a new sale.
   * @param tx optional R14-B transaction handle; all writes join the same transaction.
   */
  create(sale: Sale, tx?: TransactionHandle): Promise<Sale>;
  update(sale: Sale, tx?: TransactionHandle): Promise<Sale>;
  /**
   * Delete a sale.
   * @param tx optional transaction handle (R15); joins the caller's transaction
   *   (Fase 6 deleteSale cascade).
   */
  delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  addAbono(workspaceId: string, saleId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }, tx?: TransactionHandle): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  editAbono(workspaceId: string, saleId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>, tx?: TransactionHandle): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5).
   *  @param tx optional transaction handle (R15); joins the caller's transaction (Fase 3). */
  deleteAbono(workspaceId: string, saleId: string, abonoId: string, tx?: TransactionHandle): Promise<void>;
}

// ─── Workspace ──────────────────────────────────────────────────────

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  create(workspace: Workspace): Promise<Workspace>;
  update(workspace: Workspace): Promise<Workspace>;
  delete(id: string): Promise<void>;
}

// ─── Membership ─────────────────────────────────────────────────────

export interface MembershipRepository {
  findById(id: string): Promise<Membership | null>;
  /** Active membership for a user+workspace, if any. */
  findActiveByUserAndWorkspace(userId: string, workspaceId: string): Promise<Membership | null>;
  findByUserId(userId: string): Promise<Membership[]>;
  create(membership: Membership): Promise<Membership>;
  update(membership: Membership): Promise<Membership>;
  delete(id: string): Promise<void>;
}
