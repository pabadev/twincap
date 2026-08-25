import type { Currency } from "./currency";
import { ValidationError } from "./errors";

/** Personal/Business classification (D3): the account is the single source of truth. */
export const ACCOUNT_SCOPES = ["Personal", "Business"] as const;
export type AccountScope = (typeof ACCOUNT_SCOPES)[number];

export function isAccountScope(value: string): value is AccountScope {
  return (ACCOUNT_SCOPES as readonly string[]).includes(value);
}

export interface AccountInput {
  id: string;
  userId: string;
  name: string;
  currency: Currency;
  isFixed: boolean;
  /** Defaults to 'Personal' when omitted (D3). */
  scope?: AccountScope;
  createdAt: Date;
}

export class Account {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  /** Set at creation and immutable (ACC-2). */
  readonly currency: Currency;
  /** Fixed accounts (Efectivo/Nequi) cannot be deleted (ACC-1). */
  readonly isFixed: boolean;
  /** Personal/Business classification — always set, defaults to 'Personal' (D3). */
  readonly scope: AccountScope;
  readonly createdAt: Date;
  // NOTE: deliberately NO stored balance field — balance is DERIVED from the
  // sum of the account's movement signedAmounts (design rev.2 §2). Do not
  // re-add a stored balance: it would drift from the movements.

  constructor(input: AccountInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Account id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("Account userId must not be empty");
    }
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError("Account name must not be empty");
    }
    if (input.scope !== undefined && !isAccountScope(input.scope)) {
      throw new ValidationError(`Unknown account scope: ${String(input.scope)}`);
    }
    this.id = input.id;
    this.userId = input.userId;
    this.name = name;
    this.currency = input.currency;
    this.isFixed = input.isFixed;
    this.scope = input.scope ?? "Personal";
    this.createdAt = input.createdAt;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      currency: this.currency,
      isFixed: this.isFixed,
      scope: this.scope,
      createdAt: this.createdAt,
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedAccount = ReturnType<Account['toJSON']>;
