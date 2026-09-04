import { describe, expect, it } from 'vitest';
import { buildSalesCsv, filterSalesForCsv } from './export-csv';
import type { SerializedSale } from '../../../../core/domain/sale';

const labels = {
  date: 'Fecha',
  client: 'Cliente',
  items: 'Artículos',
  total: 'Total',
  paid: 'Pagado',
  pending: 'Pendiente',
  currency: 'Moneda',
  paymentMode: 'Método de pago',
  paidInFull: 'Contado',
  onCredit: 'Crédito',
  noClient: 'Cliente minorista',
};

const refs = {
  clientNames: { 'cli-1': 'María Pérez' },
  itemNames: { 'it-1': 'Café', 'it-2': 'Empanada' },
};

function sale(overrides: Partial<SerializedSale> = {}): SerializedSale {
  return {
    id: 's-1',
    workspaceId: 'ws-1',
    items: [
      {
        itemId: 'it-1',
        quantity: 2,
        unitPrice: { amount: 3000, currency: 'COP' },
        subtotal: 6000,
      },
    ],
    date: new Date('2026-09-01T00:00:00.000Z'),
    paymentMode: 'paid-in-full',
    accountId: 'acc-1',
    clientId: 'cli-1',
    total: 6000,
    deletedAt: undefined,
    stockRestored: false,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    pending: 0,
    abonos: [],
    ...overrides,
  };
}

describe('buildSalesCsv', () => {
  it('emits a BOM-prefixed header row with the resolved labels', () => {
    const csv = buildSalesCsv([], refs, labels);
    expect(csv).toBe(
      '\uFEFFFecha,Cliente,Artículos,Total,Pagado,Pendiente,Moneda,Método de pago',
    );
  });

  it('renders a paid-in-full row with resolved client and item names', () => {
    const csv = buildSalesCsv([sale()], refs, labels);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe(
      '2026-09-01,María Pérez,2× Café,6000,6000,0,COP,Contado',
    );
  });

  it('joins multiple line items as "Qty× Item" comma-separated', () => {
    const s = sale({
      items: [
        { itemId: 'it-1', quantity: 2, unitPrice: { amount: 3000, currency: 'COP' }, subtotal: 6000 },
        { itemId: 'it-2', quantity: 1, unitPrice: { amount: 4000, currency: 'COP' }, subtotal: 4000 },
      ],
      total: 10000,
    });
    const csv = buildSalesCsv([s], refs, labels);
    expect(csv).toContain('2× Café, 1× Empanada');
  });

  it('renders an on-credit row with paid and pending breakdown', () => {
    const s = sale({
      paymentMode: 'on-credit',
      pending: 2000,
      abonos: [
        {
          id: 'ab-1',
          amount: { amount: 4000, currency: 'COP' },
          date: new Date('2026-09-01T00:00:00.000Z'),
          accountId: 'acc-1',
        },
      ],
    });
    const csv = buildSalesCsv([s], refs, labels);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('2026-09-01,María Pérez,2× Café,6000,4000,2000,COP,Crédito');
  });

  it('fixes decimals to the sale currency exponent (unknown client excluded)', () => {
    const s = sale({
      clientId: undefined,
      items: [
        {
          itemId: 'it-1',
          quantity: 1,
          unitPrice: { amount: 12345, currency: 'USD' },
          subtotal: 12345,
        },
      ],
      total: 12345,
    });
    const csv = buildSalesCsv([s], refs, labels);
    const lines = csv.split('\r\n');
    expect(lines[1].startsWith('2026-09-01,Cliente minorista,1× Café,123.45,')).toBe(true);
  });

  it('falls back to item ids for unknown catalog items', () => {
    const s = sale({
      items: [
        {
          itemId: 'it-99',
          quantity: 1,
          unitPrice: { amount: 1000, currency: 'COP' },
          subtotal: 1000,
        },
      ],
      total: 1000,
    });
    const csv = buildSalesCsv([s], refs, labels);
    expect(csv).toContain('1× it-99');
  });

  it('keeps the given row order without re-sorting', () => {
    const a = sale({ id: 'a', date: new Date('2026-09-01T00:00:00.000Z') });
    const b = sale({ id: 'b', date: new Date('2026-09-02T00:00:00.000Z') });
    const csv = buildSalesCsv([b, a], refs, labels);
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('2026-09-02');
    expect(lines[2]).toContain('2026-09-01');
  });
});

describe('filterSalesForCsv', () => {
  it('keeps everything when no filters are set', () => {
    expect(filterSalesForCsv([sale()], {}, refs.clientNames)).toHaveLength(1);
  });

  it('filters by date range with inclusive string comparison', () => {
    const inside = sale({ id: 'in', date: new Date('2026-09-10T00:00:00.000Z') });
    const edge = sale({ id: 'edge', date: new Date('2026-09-01T00:00:00.000Z') });
    const outside = sale({ id: 'out', date: new Date('2026-08-31T00:00:00.000Z') });
    const result = filterSalesForCsv(
      [outside, inside, edge],
      { dateFrom: '2026-09-01', dateTo: '2026-09-10' },
      refs.clientNames,
    );
    expect(result.map((s) => s.id)).toEqual(['in', 'edge']);
  });

  it('filters status paid as pending === 0', () => {
    const paid = sale({ id: 'paid', pending: 0 });
    const onCreditFullyPaid = sale({ id: 'op', paymentMode: 'on-credit', pending: 0 });
    const outstanding = sale({ id: 'out', paymentMode: 'on-credit', pending: 500 });
    const result = filterSalesForCsv(
      [paid, onCreditFullyPaid, outstanding],
      { status: 'paid' },
      refs.clientNames,
    );
    expect(result.map((s) => s.id)).toEqual(['paid', 'op']);
  });

  it('filters status credit as pending > 0', () => {
    const outstanding = sale({ id: 'out', paymentMode: 'on-credit', pending: 500 });
    const paid = sale({ id: 'paid', pending: 0 });
    const result = filterSalesForCsv(
      [outstanding, paid],
      { status: 'credit' },
      refs.clientNames,
    );
    expect(result.map((s) => s.id)).toEqual(['out']);
  });

  it('matches client search case-insensitively on the resolved name', () => {
    const maria = sale({ id: 'maria', clientId: 'cli-1' });
    const walkIn = sale({ id: 'walk', clientId: undefined });
    const result = filterSalesForCsv(
      [maria, walkIn],
      { search: 'maría' },
      refs.clientNames,
    );
    expect(result.map((s) => s.id)).toEqual(['maria']);
  });

  it('excludes walk-in sales from a non-empty search (no client name)', () => {
    const walkIn = sale({ id: 'walk', clientId: undefined });
    const result = filterSalesForCsv([walkIn], { search: 'mar' }, refs.clientNames);
    expect(result).toEqual([]);
  });
});