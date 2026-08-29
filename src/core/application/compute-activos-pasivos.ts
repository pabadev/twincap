export interface CurrencyPosition {
  currency: string;
  /** Σ account aggregateBalance (signed) + Σ CreditGranted.pending */
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
 * Activos = Σ account balances (aggregateBalance) + Σ CreditGranted.pending
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
    currencyMap.get(account.currency)!.activos += account.balance;
  }

  for (const credit of creditsGranted) {
    const ccy = credit.principal.currency;
    if (credit.pending <= 0) continue;
    if (credit.writtenOff) continue;
    ensureCurrency(ccy);
    currencyMap.get(ccy)!.activos += credit.pending;
  }

  for (const credit of creditsReceived) {
    const ccy = credit.principal.currency;
    if (credit.pending <= 0) continue;
    ensureCurrency(ccy);
    currencyMap.get(ccy)!.pasivos += credit.pending;
  }

  for (const payable of payables) {
    const ccy = payable.total.currency;
    if (payable.pending <= 0) continue;
    ensureCurrency(ccy);
    currencyMap.get(ccy)!.pasivos += payable.pending;
  }

  const positions: CurrencyPosition[] = [];
  for (const [currency, { activos, pasivos }] of currencyMap) {
    if (activos === 0 && pasivos === 0) continue;
    positions.push({ currency, activos, pasivos, net: activos - pasivos });
  }

  positions.sort((a, b) => {
    if (a.currency === 'COP') return -1;
    if (b.currency === 'COP') return 1;
    return a.currency.localeCompare(b.currency);
  });

  return { positions };
}
