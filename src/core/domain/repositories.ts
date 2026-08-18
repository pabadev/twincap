/**
 * Repository interfaces for all domain entities.
 *
 * Design rules (rev.2):
 * - userId-first parameter order: every query is scoped to the owning user.
 * - NO session/transaction params: Atlas shared tier has no multi-doc tx.
 * - All ids are plain strings (no ObjectId leak).
 * - ConflictError on unique constraint violations.
 * - IdGenerator is a separate port (ports.ts), not part of repositories.
 */

import type { Account } from "./account";
import type { CatalogItem } from "./catalog";
import type { Category } from "./category";
import type { CreditGranted } from "./credit-granted";
import type { CreditReceived } from "./credit-received";
import type { Movement } from "./movement";
import type { Sale } from "./sale";
import type { Transfer } from "./transfer";
import type { User } from "./user";

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
  findById(userId: string, id: string): Promise<Account | null>;
  findByUserId(userId: string): Promise<Account[]>;
  create(account: Account): Promise<Account>;
  update(account: Account): Promise<Account>;
  delete(userId: string, id: string): Promise<void>;
  /** ACC-4: count references across all collections (movements, transfers, credits, sales). */
  countReferences(userId: string, accountId: string): Promise<number>;
}

// ─── Category ────────────────────────────────────────────────────────

export interface CategoryRepository {
  findById(userId: string, id: string): Promise<Category | null>;
  findByUserId(userId: string): Promise<Category[]>;
  /** For uniqueness check: name + type scoped to user (CAT-2). */
  findByNameAndType(userId: string, name: string, type: string): Promise<Category | null>;
  create(category: Category): Promise<Category>;
  update(category: Category): Promise<Category>;
  delete(userId: string, id: string): Promise<void>;
}

// ─── Movement ────────────────────────────────────────────────────────

export interface MovementRepository {
  findById(userId: string, id: string): Promise<Movement | null>;
  findByUserId(userId: string): Promise<Movement[]>;
  findByAccountId(userId: string, accountId: string): Promise<Movement[]>;
  create(movement: Movement): Promise<Movement>;
  update(movement: Movement): Promise<Movement>;
  delete(userId: string, id: string): Promise<void>;
  /** Σ signedAmount grouped by accountId (design rev.2 §2 derived balance). */
  aggregateBalance(userId: string, accountId: string): Promise<number>;
  /** CAT-3: count movements referencing a category (deletion guard). */
  countByCategoryId(userId: string, categoryId: string): Promise<number>;
}

// ─── Transfer ────────────────────────────────────────────────────────

export interface TransferRepository {
  findById(userId: string, id: string): Promise<Transfer | null>;
  findByUserId(userId: string): Promise<Transfer[]>;
  create(transfer: Transfer): Promise<Transfer>;
  update(transfer: Transfer): Promise<Transfer>;
  delete(userId: string, id: string): Promise<void>;
  /** Find by raw ObjectId without userId scope (for reconcile orphan check). */
  findByIdRaw(id: string): Promise<Transfer | null>;
}

// ─── Credit Received ─────────────────────────────────────────────────

export interface CreditReceivedRepository {
  findById(userId: string, id: string): Promise<CreditReceived | null>;
  findByUserId(userId: string): Promise<CreditReceived[]>;
  create(credit: CreditReceived): Promise<CreditReceived>;
  update(credit: CreditReceived): Promise<CreditReceived>;
  delete(userId: string, id: string): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5). */
  addAbono(userId: string, creditId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5). */
  editAbono(userId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5). */
  deleteAbono(userId: string, creditId: string, abonoId: string): Promise<void>;
}

// ─── Credit Granted ──────────────────────────────────────────────────

export interface CreditGrantedRepository {
  findById(userId: string, id: string): Promise<CreditGranted | null>;
  findByUserId(userId: string): Promise<CreditGranted[]>;
  create(credit: CreditGranted): Promise<CreditGranted>;
  update(credit: CreditGranted): Promise<CreditGranted>;
  delete(userId: string, id: string): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5). */
  addAbono(userId: string, creditId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5). */
  editAbono(userId: string, creditId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5). */
  deleteAbono(userId: string, creditId: string, abonoId: string): Promise<void>;
}

// ─── Catalog Item ────────────────────────────────────────────────────

export interface CatalogItemRepository {
  findById(userId: string, id: string): Promise<CatalogItem | null>;
  findByUserId(userId: string): Promise<CatalogItem[]>;
  create(item: CatalogItem): Promise<CatalogItem>;
  update(item: CatalogItem): Promise<CatalogItem>;
  delete(userId: string, id: string): Promise<void>;
  /** Atomic stock decrement for products (POS-3). Returns false if insufficient stock. */
  decrementStock(userId: string, itemId: string, quantity: number): Promise<boolean>;
  /** Atomic stock increment for products (stock restore on sale delete). */
  incrementStock(userId: string, itemId: string, quantity: number): Promise<void>;
}

// ─── Sale ────────────────────────────────────────────────────────────

export interface SaleRepository {
  findById(userId: string, id: string): Promise<Sale | null>;
  findByUserId(userId: string): Promise<Sale[]>;
  create(sale: Sale): Promise<Sale>;
  update(sale: Sale): Promise<Sale>;
  delete(userId: string, id: string): Promise<void>;
  /** Atomic $push — idempotent when movementId is provided (design §5). */
  addAbono(userId: string, saleId: string, abono: { id: string; amount: number; date: Date; accountId: string; movementId?: string }): Promise<void>;
  /** Atomic $set on embedded abono by abono.id (design §5). */
  editAbono(userId: string, saleId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>): Promise<void>;
  /** Atomic $pull on embedded abono by abono.id (design §5). */
  deleteAbono(userId: string, saleId: string, abonoId: string): Promise<void>;
}
