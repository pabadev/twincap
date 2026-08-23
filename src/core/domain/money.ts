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

  /**
   * Factory for non-negative amounts (zero allowed). Reserved for positions
   * that can legitimately be zero — e.g. a credit born fully paid from a POS
   * sale (H14: initialPayment = total → net debt of 0). Transactional amounts
   * (movements, payments, prices, transfer legs) keep the strict positive
   * invariant of the regular constructor.
   */
  static nonNegative(amount: number, currency: Currency): Money {
    if (!isCurrency(currency)) {
      throw new MoneyError(`Unknown currency: ${currency}`);
    }
    if (!Number.isSafeInteger(amount)) {
      throw new MoneyError(`Amount must be an integer in minor units, got ${amount}`);
    }
    if (amount < 0) {
      throw new MoneyError(`Amount must not be negative, got ${amount}`);
    }
    // Bypass the strict constructor while keeping instances identical in
    // shape and behavior (plus/minus construct fresh Money values).
    const money = Object.create(Money.prototype) as Money;
    const writable = money as { amount: number; currency: Currency };
    writable.amount = amount;
    writable.currency = currency;
    return money;
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
