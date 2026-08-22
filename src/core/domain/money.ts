import { type Currency, isCurrency } from "./currency";
import { DomainError } from "./errors";

/** Money-domain error, part of the shared DomainError hierarchy. */
export class MoneyError extends DomainError {}

/**
 * Guards arithmetic between Money values of different currencies.
 * Cross-currency operations are only allowed through an explicit,
 * user-entered FX rate (see transfers) — never implicitly.
 */
export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

/**
 * Money value object: amount in integer minor units of the given currency
 * per ISO 4217 exponent (COP 0; USD/MXN/EUR 2). Immutable; arithmetic is
 * same-currency only.
 */
export class Money {
  readonly amount: number;
  readonly currency: Currency;

  constructor(amount: number, currency: Currency) {
    if (!isCurrency(currency)) {
      throw new MoneyError(`Unknown currency: ${currency}`);
    }
    if (!Number.isSafeInteger(amount)) {
      throw new MoneyError(`Amount must be an integer in minor units, got ${amount}`);
    }
    if (amount <= 0) {
      throw new MoneyError(`Amount must be positive, got ${amount}`);
    }
    this.amount = amount;
    this.currency = currency;
  }

  plus(other: Money): Money {
    assertSameCurrency(this, other);
    return new Money(this.amount + other.amount, this.currency);
  }

  minus(other: Money): Money {
    assertSameCurrency(this, other);
    return new Money(this.amount - other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON(): { amount: number; currency: Currency } {
    return { amount: this.amount, currency: this.currency };
  }
}
