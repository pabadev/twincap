import { sumSafeMinorUnits } from '../domain/money';

export interface CurrencyPosition {
  currency: string;
  /** Σ account balances (signed) + Σ CreditGranted.pending */
  activos: number;
  /** Σ CreditReceived.pending + Σ Payable.pending */
  pasivos: number;
  /** activos − pasivos */
  net: number;
}

export interface ActivosPasivosResult {
  positions: CurrencyPosition[];
}

/**
 * Compute per-currency financial position (decision D4):
 *
 * Activos = Σ account balances (signed) + Σ CreditGranted.pending
 *   de créditos no castigados — writtenOff excluye el crédito del activo
 *   (representa todo lo de valor que el usuario posee o se le debe;
 *   un crédito dado de baja ya no es cobrable).
 *
 * Pasivos = Σ CreditReceived.pending + Σ Payable.pending
 *   — represents everything the user owes.
 *
 * Grouped by currency. No FX conversion.
 */
export function computeActivosPasivos(input: {
  accounts: Array<{ currency: string; balance: number }>;
  creditsGranted: Array<{
    principal: { currency: string };
    pending: number;
    writtenOff?: boolean;
  }>;
  creditsReceived: Array<{ principal: { currency: string }; pending: number }>;
  payables: Array<{ total: { currency: string }; pending: number }>;
}): ActivosPasivosResult {
  const { accounts, creditsGranted, creditsReceived, payables } = input;

  const currencyMap = new Map<
    string,
    { activos: number; pasivos: number }
  >();

  function ensureCurrency(currency: string) {
    if (!currencyMap.has(currency)) {
      currencyMap.set(currency, { activos: 0, pasivos: 0 });
    }
  }

  for (const account of accounts) {
    ensureCurrency(account.currency);
    const entry = currencyMap.get(account.currency)!;
    entry.activos = sumSafeMinorUnits(
      [entry.activos, account.balance],
      `Financial position activos (${account.currency})`,
    );
  }

  for (const credit of creditsGranted) {
    const ccy = credit.principal.currency;
    if (credit.pending <= 0) continue;
    if (credit.writtenOff) continue;
    ensureCurrency(ccy);
    const entry = currencyMap.get(ccy)!;
    entry.activos = sumSafeMinorUnits(
      [entry.activos, credit.pending],
      `Financial position activos (${ccy})`,
    );
  }

  for (const credit of creditsReceived) {
    const ccy = credit.principal.currency;
    if (credit.pending <= 0) continue;
    ensureCurrency(ccy);
    const entry = currencyMap.get(ccy)!;
    entry.pasivos = sumSafeMinorUnits(
      [entry.pasivos, credit.pending],
      `Financial position pasivos (${ccy})`,
    );
  }

  for (const payable of payables) {
    const ccy = payable.total.currency;
    if (payable.pending <= 0) continue;
    ensureCurrency(ccy);
    const entry = currencyMap.get(ccy)!;
    entry.pasivos = sumSafeMinorUnits(
      [entry.pasivos, payable.pending],
      `Financial position pasivos (${ccy})`,
    );
  }

  const positions: CurrencyPosition[] = [];
  for (const [currency, { activos, pasivos }] of currencyMap) {
    if (activos === 0 && pasivos === 0) continue;
    // activos/pasivos are individually safe integers, but the SUBTRACTION is
    // a derived financial value on the safe range too: guard the net before
    // exposing it (|a − b| ≤ max(|a|, |b|) for same-signed inputs, but a
    // negative activos + large pasivos can still cross ±2^53).
    const net = sumSafeMinorUnits(
      [activos, -pasivos],
      `Financial position net (${currency})`,
    );
    positions.push({ currency, activos, pasivos, net });
  }

  positions.sort((a, b) => {
    if (a.currency === 'COP') return -1;
    if (b.currency === 'COP') return 1;
    return a.currency.localeCompare(b.currency);
  });

  return { positions };
}
