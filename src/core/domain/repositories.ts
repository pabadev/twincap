/**
 * Repository interfaces for all domain entities.
 *
 * Design rules (rev.2):
 * - workspaceId-first parameter order: every query is scoped to the owning workspace.
 * - NO session/transaction params: Atlas shared tier has no multi-doc tx.
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
  create(movement: Movement): Promise<Movement>;
  update(movement: Movement): Promise<Movement>;
  delete(workspaceId: string, id: string): Promise<void>;
  /** Delete ALL movements that reference a parent id via link.refId (robust
   *  cascade, format-agnostic — covers ObjectId and legacy UUID refIds). */
  deleteByRefId(workspaceId: string, refId: string): Promise<number>;
  /** Σ signedAmount grouped by accountId (design rev.2 §2 derived balance). */
  aggregateBalance(workspaceId: string, accountId: string): Promise<number>;
  /** CAT-3: count movements referencing a category (deletion guard). */
  countByCategoryId(workspaceId: string, categoryId: string): Promise<number>;
}

// ─── Transfer ────────────────────────────────────────────────────────

export interface TransferRepository {
  findById(workspaceId: string, id: string): Promise<Transfer | null>;
  findByWorkspaceId(workspaceId: string): Promise<Transfer[]>;
  create(transfer: Transfer): Promise<Transfer>;
  update(transfer: Transfer): Promise<Transfer>;
  delete(workspaceId: string, id: string): Promise<void>;
  /** Find by raw ObjectId without workspaceId scope (for reconcile orphan check). */
  findByIdRaw(id: string): Promise<Transfer | null>;
}

// ─── Credit Received ─────────────────────────────────────────────────

export interface CreditReceivedRepository {
  findById(workspaceId: string, id: string): Promise<CreditReceived | null>;
  findByWorkspaceId(workspaceId: string): Promise<CreditReceived[]>;
  create(credit: CreditReceived): Promise<CreditReceived>;
  update(credit: CreditReceived): Promise<CreditReceived>;
  delete(workspaceId: string, id: string): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5). */
  addAbono(workspaceId: string, creditId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5). */
  editAbono(workspaceId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5). */
  deleteAbono(workspaceId: string, creditId: string, abonoId: string): Promise<void>;
}

// ─── Credit Granted ──────────────────────────────────────────────────

export interface CreditGrantedRepository {
  findById(workspaceId: string, id: string): Promise<CreditGranted | null>;
  findByWorkspaceId(workspaceId: string): Promise<CreditGranted[]>;
  create(credit: CreditGranted): Promise<CreditGranted>;
  update(credit: CreditGranted): Promise<CreditGranted>;
  delete(workspaceId: string, id: string): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5). */
  addAbono(workspaceId: string, creditId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string; capitalAmount?: number; interestAmount?: number; interestMovementId?: string }): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5).
   *  An explicitly `undefined` value is turned into `$unset` so split fields
   *  (e.g. interestMovementId when a portion drops to zero) can be cleared. */
  editAbono(workspaceId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string; capitalAmount: number; interestAmount: number; interestMovementId: string }>): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5). */
  deleteAbono(workspaceId: string, creditId: string, abonoId: string): Promise<void>;
  /** R9/D9.4: mark the credit as written off (`$set` on the writtenOff marker). */
  markWrittenOff(workspaceId: string, creditId: string, writtenOff: { date: Date; movementId: string }): Promise<void>;
}

// ─── Payable ─────────────────────────────────────────────────────────

export interface PayableRepository {
  findById(workspaceId: string, id: string): Promise<Payable | null>;
  findByWorkspaceId(workspaceId: string): Promise<Payable[]>;
  create(payable: Payable): Promise<Payable>;
  update(payable: Payable): Promise<Payable>;
  delete(workspaceId: string, id: string): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5). */
  addAbono(workspaceId: string, payableId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5). */
  editAbono(workspaceId: string, payableId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5). */
  deleteAbono(workspaceId: string, payableId: string, abonoId: string): Promise<void>;
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
  /** Atomic stock decrement for products (POS-3). Returns false if insufficient stock. */
  decrementStock(workspaceId: string, itemId: string, quantity: number): Promise<boolean>;
  /** Atomic stock increment for products (stock restore on sale delete). */
  incrementStock(workspaceId: string, itemId: string, quantity: number): Promise<void>;
}

// ─── Sale ────────────────────────────────────────────────────────────

export interface SaleRepository {
  findById(workspaceId: string, id: string): Promise<Sale | null>;
  findByWorkspaceId(workspaceId: string): Promise<Sale[]>;
  create(sale: Sale): Promise<Sale>;
  update(sale: Sale): Promise<Sale>;
  delete(workspaceId: string, id: string): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5). */
  addAbono(workspaceId: string, saleId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5). */
  editAbono(workspaceId: string, saleId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5). */
  deleteAbono(workspaceId: string, saleId: string, abonoId: string): Promise<void>;
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
