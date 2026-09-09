import type { Currency } from "./currency";
import { ValidationError } from "./errors";

export interface AccountInput {
  id: string;
  workspaceId: string;
  name: string;
  currency: Currency;
  isFixed: boolean;
  createdAt: Date;
  /**
   * Optimistic-concurrency version (F5). Mirrors the persisted `__v` so the
   * application layer can CAS-bump it inside a transaction (balance protection
   * for transfer origins). Defaults to 0 for hand-built accounts in tests.
   */
  version?: number;
}

export class Account {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  /** Set at creation and immutable (ACC-2). */
  readonly currency: Currency;
  /** Fixed accounts (Efectivo/Nequi) cannot be deleted (ACC-1). */
  readonly isFixed: boolean;
  readonly createdAt: Date;
  /** Optimistic-concurrency version; mirrors the persisted `__v` (F5). */
  readonly version: number;
  // NOTE: deliberately NO stored balance field — balance is DERIVED from the
  // sum of the account's movement signedAmounts (design rev.2 §2). Do not
  // re-add a stored balance: it would drift from the movements.

  constructor(input: AccountInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Account id must not be empty");
    }
    if (input.workspaceId.length === 0) {
      throw new ValidationError("Account workspaceId must not be empty");
    }
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError("Account name must not be empty");
    }
    this.id = input.id;
    this.workspaceId = input.workspaceId;
    this.name = name;
    this.currency = input.currency;
    this.isFixed = input.isFixed;
    this.createdAt = input.createdAt;
    this.version = input.version ?? 0;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      name: this.name,
      currency: this.currency,
      isFixed: this.isFixed,
      createdAt: this.createdAt,
      version: this.version,
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedAccount = ReturnType<Account['toJSON']>;
