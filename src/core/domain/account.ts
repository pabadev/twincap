import type { Currency } from "./currency";
import { ValidationError } from "./errors";

export interface AccountInput {
  id: string;
  userId: string;
  name: string;
  currency: Currency;
  isFixed: boolean;
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
    this.id = input.id;
    this.userId = input.userId;
    this.name = name;
    this.currency = input.currency;
    this.isFixed = input.isFixed;
    this.createdAt = input.createdAt;
  }
}
