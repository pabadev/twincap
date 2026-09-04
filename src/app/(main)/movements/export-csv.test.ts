import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildMovementsCsv, filterMovementsForCsv } from './export-csv';
import type { SerializedMovement } from '../../../core/domain/movement';

// ─── Server-action wiring (light) — every infrastructure edge mocked ──────
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoMovementRepository } = vi.hoisted(() => ({
  MongoMovementRepository: vi.fn(),
}));
const { MongoAccountRepository } = vi.hoisted(() => ({
  MongoAccountRepository: vi.fn(),
}));
const { MongoCategoryRepository } = vi.hoisted(() => ({
  MongoCategoryRepository: vi.fn(),
}));
const { getT, getLocale } = vi.hoisted(() => ({
  getT: vi.fn(),
  getLocale: vi.fn(),
}));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../infrastructure/repositories/movement-repository', () => ({
  MongoMovementRepository,
}));
vi.mock('../../../infrastructure/repositories/account-repository', () => ({
  MongoAccountRepository,
}));
vi.mock('../../../infrastructure/repositories/category-repository', () => ({
  MongoCategoryRepository,
}));
vi.mock('../../../i18n/server', () => ({ getT, getLocale }));

const { exportMovementsCsvAction } = await import('./actions');

const labels = {
  income: 'Ingreso',
  expense: 'Gasto',
  date: 'Fecha',
  type: 'Tipo',
  account: 'Cuenta',
  category: 'Categoría',
  amount: 'Monto',
  currency: 'Moneda',
  note: 'Nota',
  noCategory: 'Sin categoría',
};

const refs = {
  accountNames: { 'acc-1': 'Efectivo', 'acc-2': 'Nequi' },
  categoryNames: { 'cat-1': 'Comida' },
};

function movement(overrides: Partial<SerializedMovement> = {}): SerializedMovement {
  return {
    id: 'm-1',
    workspaceId: 'ws-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    type: 'expense',
    amount: { amount: 15000, currency: 'COP' },
    signedAmount: -15000,
    date: new Date('2026-09-01T00:00:00.000Z'),
    note: 'Almuerzo',
    context: 'Personal',
    link: undefined,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('buildMovementsCsv', () => {
  it('emits a BOM-prefixed header row with the resolved labels', () => {
    const csv = buildMovementsCsv([], refs, labels);
    expect(csv).toBe('\uFEFFFecha,Tipo,Cuenta,Categoría,Monto,Moneda,Nota');
  });

  it('renders an expense row with a negative amount and resolved names', () => {
    const csv = buildMovementsCsv([movement()], refs, labels);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('2026-09-01,Gasto,Efectivo,Comida,-15000,COP,Almuerzo');
  });

  it('renders an income row with a positive amount', () => {
    const m = movement({
      type: 'income',
      signedAmount: 100000,
      amount: { amount: 100000, currency: 'COP' },
    });
    const csv = buildMovementsCsv([m], refs, labels);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('2026-09-01,Ingreso,Efectivo,Comida,100000,COP,Almuerzo');
  });

  it('fixes expense decimals to the currency exponent (USD)', () => {
    const m = movement({
      amount: { amount: 12345, currency: 'USD' },
      signedAmount: -12345,
    });
    const csv = buildMovementsCsv([m], refs, labels);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('2026-09-01,Gasto,Efectivo,Comida,-123.45,USD,Almuerzo');
  });

  it('falls back to the noCategory label when the category is unknown', () => {
    const m = movement({ categoryId: 'cat-99' });
    const csv = buildMovementsCsv([m], refs, labels);
    expect(csv).toContain(',Sin categoría,');
  });

  it('falls back to the account id when the account name is unknown', () => {
    const m = movement({ accountId: 'acc-99' });
    const csv = buildMovementsCsv([m], refs, labels);
    expect(csv).toContain(',acc-99,');
  });

  it('emits an empty note cell when note is undefined', () => {
    const m = movement({ note: undefined });
    const csv = buildMovementsCsv([m], refs, labels);
    const lines = csv.split('\r\n');
    expect(lines[1].endsWith(',Almuerzo')).toBe(false);
    expect(lines[1].endsWith(',')).toBe(true);
  });

  it('keeps the given row order without re-sorting', () => {
    const a = movement({
      id: 'a',
      date: new Date('2026-09-01T00:00:00.000Z'),
      note: 'A',
    });
    const b = movement({
      id: 'b',
      date: new Date('2026-09-02T00:00:00.000Z'),
      note: 'B',
    });
    const csv = buildMovementsCsv([b, a], refs, labels);
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('2026-09-02');
    expect(lines[2]).toContain('2026-09-01');
  });
});

describe('filterMovementsForCsv', () => {
  it('keeps everything when no filters are set', () => {
    const result = filterMovementsForCsv([movement()], {});
    expect(result).toHaveLength(1);
  });

  it('filters by account id and skips the "all" sentinel', () => {
    const keep = movement({ id: 'keep', accountId: 'acc-1' });
    const drop = movement({ id: 'drop', accountId: 'acc-2' });
    expect(filterMovementsForCsv([keep, drop], { accountId: 'acc-1' })).toEqual([keep]);
    expect(filterMovementsForCsv([keep, drop], { accountId: 'all' })).toEqual([keep, drop]);
  });

  it('filters by scope', () => {
    const personal = movement({ id: 'p', context: 'Personal' });
    const business = movement({ id: 'b', context: 'Business' });
    expect(filterMovementsForCsv([personal, business], { scope: 'Personal' })).toEqual([personal]);
  });

  it('ignores the scope filter while a concrete account is selected (mirrors list UI)', () => {
    const personal = movement({ id: 'p', accountId: 'acc-1', context: 'Personal' });
    const business = movement({ id: 'b', accountId: 'acc-1', context: 'Business' });
    const result = filterMovementsForCsv([personal, business], {
      accountId: 'acc-1',
      scope: 'Personal',
    });
    expect(result).toEqual([personal, business]);
  });

  it('filters by type', () => {
    const income = movement({ id: 'i', type: 'income', signedAmount: 100 });
    const expense = movement({ id: 'e', type: 'expense', signedAmount: -100 });
    expect(filterMovementsForCsv([income, expense], { type: 'income' })).toEqual([income]);
    expect(filterMovementsForCsv([income, expense], { type: 'all' })).toEqual([income, expense]);
  });
});

describe('exportMovementsCsvAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'ws-1' });
    connectDb.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await exportMovementsCsvAction({});

    expect(result).toEqual({ ok: false, error: 'error.unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoMovementRepository).not.toHaveBeenCalled();
  });
});