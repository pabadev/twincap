import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  deriveSystemNote,
  systemNoteTemplateKey,
  SYSTEM_NOTES_NAMESPACE,
  type TranslateFn,
} from './system-note';
import { interpolate } from '../i18n/interpolate';

function makeT(locale: 'es' | 'en'): TranslateFn {
  const filePath = fileURLToPath(new URL(`../../messages/${locale}.json`, import.meta.url));
  const catalog = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<
    string,
    Record<string, string>
  >;
  return (key, params) => {
    const value = catalog[SYSTEM_NOTES_NAMESPACE]?.[key];
    if (value === undefined) return key;
    return params ? interpolate(value, params) : value;
  };
}

const tEs = makeT('es');
const tEn = makeT('en');

function movement(partial: {
  note?: string;
  kind?: string;
  refId?: string;
  accountId?: string;
}) {
  return {
    note: partial.note,
    accountId: partial.accountId,
    link:
      partial.kind === undefined
        ? undefined
        : { kind: partial.kind, refId: partial.refId ?? 'ref-1', opId: 'op-1' },
  };
}

describe('systemNoteTemplateKey', () => {
  it('maps all nine known link kinds', () => {
    const kinds = [
      'opening',
      'transfer',
      'creditReceivedPrincipal',
      'creditReceivedAbono',
      'creditGrantedPrincipal',
      'creditGrantedAbono',
      'salePayment',
      'payableInitialPayment',
      'payableAbono',
    ];
    for (const kind of kinds) {
      expect(systemNoteTemplateKey(kind)).toBe(kind);
    }
  });

  it('returns null for unknown kinds', () => {
    expect(systemNoteTemplateKey('futureKind')).toBeNull();
    expect(systemNoteTemplateKey('')).toBeNull();
  });
});

describe('deriveSystemNote', () => {
  it('returns undefined for non-system movements', () => {
    expect(deriveSystemNote(movement({}), tEs)).toBeUndefined();
    expect(deriveSystemNote({ note: 'manual', link: undefined }, tEs)).toBeUndefined();
  });

  it('derives localized text for every counterparty kind (with parent label)', () => {
    const cases: Array<{ kind: string; label: string; es: string; en: string }> = [
      {
        kind: 'creditReceivedPrincipal',
        label: 'Proveedora XYZ',
        es: 'Crédito recibido de Proveedora XYZ',
        en: 'Credit received from Proveedora XYZ',
      },
      {
        kind: 'creditReceivedAbono',
        label: 'Proveedora XYZ',
        es: 'Abono del crédito de Proveedora XYZ',
        en: 'Abono for credit from Proveedora XYZ',
      },
      {
        kind: 'creditGrantedPrincipal',
        label: 'Juan Pérez',
        es: 'Crédito otorgado a Juan Pérez',
        en: 'Credit granted to Juan Pérez',
      },
      {
        kind: 'creditGrantedAbono',
        label: 'Juan Pérez',
        es: 'Abono del crédito otorgado a Juan Pérez',
        en: 'Abono for granted credit of Juan Pérez',
      },
      {
        kind: 'salePayment',
        label: 'María',
        es: 'Pago de venta de María',
        en: 'Sale payment from María',
      },
      {
        kind: 'payableInitialPayment',
        label: 'Distribuidora',
        es: 'Pago inicial de la compra a Distribuidora',
        en: 'Initial payment for purchase from Distribuidora',
      },
      {
        kind: 'payableAbono',
        label: 'Distribuidora',
        es: 'Abono de la compra a Distribuidora',
        en: 'Abono for purchase from Distribuidora',
      },
    ];
    for (const c of cases) {
      const m = movement({ kind: c.kind });
      expect(deriveSystemNote(m, tEs, { 'ref-1': c.label })).toBe(c.es);
      expect(deriveSystemNote(m, tEn, { 'ref-1': c.label })).toBe(c.en);
    }
  });

  it('falls back to the Plain template when the parent label is missing (orphan)', () => {
    const cases: Record<string, { es: string; en: string }> = {
      creditReceivedPrincipal: { es: 'Crédito recibido', en: 'Credit received' },
      creditReceivedAbono: { es: 'Abono de crédito recibido', en: 'Credit abono' },
      creditGrantedPrincipal: { es: 'Crédito otorgado', en: 'Credit granted' },
      creditGrantedAbono: { es: 'Abono de crédito otorgado', en: 'Granted credit abono' },
      salePayment: { es: 'Pago de venta', en: 'Sale payment' },
      payableInitialPayment: { es: 'Pago inicial de compra', en: 'Purchase initial payment' },
      payableAbono: { es: 'Abono de cuenta por pagar', en: 'Payable abono' },
    };
    for (const [kind, expected] of Object.entries(cases)) {
      const m = movement({ kind }); // no refLabels → orphan
      expect(deriveSystemNote(m, tEs)).toBe(expected.es);
      expect(deriveSystemNote(m, tEn)).toBe(expected.en);
    }
  });

  it('ignores blank labels and uses the Plain variant', () => {
    const m = movement({ kind: 'payableAbono', refId: 'p1' });
    expect(deriveSystemNote(m, tEs, { p1: '   ' })).toBe('Abono de cuenta por pagar');
  });

  it('uses fixed templates for opening and transfer kinds', () => {
    expect(deriveSystemNote(movement({ kind: 'opening' }), tEs)).toBe(
      'Saldo inicial de la cuenta',
    );
    expect(deriveSystemNote(movement({ kind: 'opening' }), tEn)).toBe(
      'Account opening balance',
    );
    expect(deriveSystemNote(movement({ kind: 'transfer' }), tEs)).toBe(
      'Transferencia entre cuentas propias',
    );
    expect(deriveSystemNote(movement({ kind: 'transfer' }), tEn)).toBe(
      'Internal transfer between own accounts',
    );
  });

  it('prefers the derived template over persisted legacy auto-notes (historical rows)', () => {
    const historical = [
      { kind: 'opening', persisted: 'Opening balance' },
      { kind: 'creditReceivedPrincipal', persisted: 'Credit received from Old Vendor' },
      { kind: 'salePayment', persisted: 'Sale payment' },
      { kind: 'payableAbono', persisted: 'Abono for purchase from Old Vendor' },
    ];
    for (const h of historical) {
      const m = movement({ kind: h.kind, note: h.persisted });
      const derived = deriveSystemNote(m, tEs);
      expect(derived).toBeDefined();
      expect(derived).not.toContain('Opening balance');
      expect(derived).not.toContain('Old Vendor');
      expect(derived).not.toBe(h.persisted);
    }
  });

  it('shows user-typed transfer notes verbatim instead of the template', () => {
    const m = movement({ kind: 'transfer', note: 'Ahorros de diciembre' });
    expect(deriveSystemNote(m, tEs)).toBeUndefined();
  });

  it("treats the legacy literal 'Transfer' as auto text, not user data", () => {
    const m = movement({ kind: 'transfer', note: 'Transfer' });
    expect(deriveSystemNote(m, tEs)).toBe('Transferencia entre cuentas propias');
    const mSpaced = movement({ kind: 'transfer', note: '  transfer  ' });
    expect(deriveSystemNote(mSpaced, tEn)).toBe('Internal transfer between own accounts');
  });

  it('returns undefined for unknown kinds so callers can fall back', () => {
    const m = movement({ kind: 'mysteryKind', note: 'Legacy text' });
    expect(deriveSystemNote(m, tEs)).toBeUndefined();
  });
});
