import { type Currency, isCurrency, exponentOf } from "./currency";
import { DomainError, ValidationError } from "./errors";

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
    const result = this.amount + other.amount;
    assertArithmeticResult("plus", result);
    return new Money(result, this.currency);
  }

  minus(other: Money): Money {
    assertSameCurrency(this, other);
    const result = this.amount - other.amount;
    assertArithmeticResult("minus", result);
    return new Money(result, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON(): { amount: number; currency: Currency } {
    return { amount: this.amount, currency: this.currency };
  }
}

/**
 * Re-validate the result of a Money arithmetic operation before it can enter
 * the constructor lineage (R15.2 D5). The constructor already rejects
 * non-safe-integer and non-positive amounts, but `plus`/`minus` re-check
 * FIRST so the operation itself reports the failure with an explicit message
 * instead of letting an out-of-range intermediate value leak through.
 */
function assertArithmeticResult(op: string, result: number): void {
  if (!Number.isSafeInteger(result)) {
    throw new MoneyError(
      `Amount must be an integer in minor units after ${op}, got ${result}`,
    );
  }
  if (result <= 0) {
    throw new MoneyError(`Amount must be positive after ${op}, got ${result}`);
  }
}

/**
 * Guards an INTERMEDIATE minor-units computation BEFORE its result can be
 * used any further (R15.3 §18). Operations outside Money — quantity ×
 * unitPrice, installmentValue × installments, Σ abonos, aggregated balance
 * sums — can overflow the safe-integer range before the value re-enters a
 * Money constructor, silently corrupting derived amounts. Fail fast here
 * instead.
 *
 * The contract is INTEGER-SAFETY only (minor units are always integers):
 * negativity is not this helper's concern — positive invariants are enforced
 * by Money/aggregate constructors where the value is consumed.
 *
 * @throws MoneyError when the value is not a safe integer
 */
export function assertSafeMinorUnits(value: number, context: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(
      `\`${context}\` produced an unsafe minor-units value: ${value}`,
    );
  }
}

/**
 * Derives the effective exchange rate from two monetary amounts.
 *
 * CONVENTION (R15.3 §11 — the single, formal definition): the rate answers
 * "how many MAJOR units of the SOURCE currency does one MAJOR unit of the
 * DESTINATION currency cost" —
 *
 *   effectiveExchangeRate = sourceMajor / destinationMajor
 *                         = (source.amount / 10^exp(source))
 *                           / (destination.amount / 10^exp(destination))
 *
 * Exponents come from ISO 4217 via `exponentOf` (COP 0; USD/MXN/EUR 2).
 * Doc example: 190.000 COP → 50 USD is 190000/1 ÷ 5000/100 = 3800 COP/USD,
 * NOT the old minor-unit ratio 0,0263158 nor 38.
 *
 * The rate is DERIVED — the two integer minor-unit amounts are the source of
 * truth, never the user. It exists for display and derived queries ONLY; it
 * is NEVER used as the source of truth for calculations.
 *
 * Same-currency amounts always yield 1 (TRA-2: destination === source).
 *
 * @throws ValidationError when either amount is zero or the destination's
 *         major-unit value is zero (division by zero guard)
 */
export function deriveExchangeRate(source: Money, destination: Money): number {
  if (source.amount === 0) {
    throw new ValidationError("Source amount cannot be zero");
  }
  if (destination.amount === 0) {
    throw new ValidationError(
      "Destination amount cannot be zero for cross-currency transfer",
    );
  }
  if (source.currency === destination.currency) {
    return 1; // Same currency: rate is always 1
  }
  const sourceMajor = source.amount / 10 ** exponentOf(source.currency);
  const destinationMajor = destination.amount / 10 ** exponentOf(destination.currency);
  if (destinationMajor === 0) {
    throw new ValidationError(
      "Destination major amount cannot be zero for cross-currency transfer",
    );
  }
  // Cross-currency: derived ratio in major units per the §11 convention.
  // Stored as a float for display purposes only — the two integer amounts
  // remain the source of truth for every derived query.
  return sourceMajor / destinationMajor;
}
