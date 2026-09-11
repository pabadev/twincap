/**
 * Split of an abono into capital-recovery and interest portions (R9/D9.3).
 *
 * Chronological amortization: each abono recovers principal first. The portion
 * that reduces the outstanding principal is capital; anything above that is
 * realized interest. Amounts are integer minor units of a single currency —
 * the helper stays on plain numbers so inputs with a zero-portion (all
 * capital, or all interest when no principal remains) need no special Money
 * handling. Consumers wrap the outputs in Money when persisting.
 *
 * R15.3 §18: every intermediate computation (capital pending, interest
 * portion, recovered-so-far accumulator) is guarded by
 * `assertSafeMinorUnits` so a numerical overflow can never produce a corrupt
 * capital/interest split.
 */

import { assertSafeMinorUnits } from "../../domain/money";

export interface SplitAbonoResult {
  /** Portion of the abono that recovers principal (same units as input). */
  capitalAmount: number;
  /** Portion of the abono that is realized interest (same units as input). */
  interestAmount: number;
}

/**
 * Compute the capital/interest split for each abono, in chronological order.
 *
 * - capitalPortion = min(abono, principal − capitalRecoveredSoFar)
 * - interestPortion = abono − capitalPortion
 * - capitalRecoveredSoFar = Σ capitalPortion of previous abonos
 *
 * Purely functional: no I/O, no side effects, no external dependencies.
 * An empty abono list yields an empty result.
 *
 * @param principal total principal (minor units of one currency)
 * @param abonos abonos in chronological order, each exposing its total amount
 */
export function splitAbonoCapitalInterest(
  principal: number,
  abonos: ReadonlyArray<{ amount: number }>,
): SplitAbonoResult[] {
  let capitalRecoveredSoFar = 0;

  return abonos.map((abono) => {
    const capitalPending = principal - capitalRecoveredSoFar;
    assertSafeMinorUnits(capitalPending, "Split capital pending");
    const capitalPortion = Math.min(abono.amount, capitalPending);
    const interestPortion = abono.amount - capitalPortion;
    assertSafeMinorUnits(interestPortion, "Split interest portion");

    capitalRecoveredSoFar += capitalPortion;
    assertSafeMinorUnits(capitalRecoveredSoFar, "Split capital recovered so far");

    return {
      capitalAmount: capitalPortion,
      interestAmount: interestPortion,
    };
  });
}
