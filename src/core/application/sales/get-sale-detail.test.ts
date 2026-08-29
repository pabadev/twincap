import { describe, it, expect, vi } from 'vitest';
import { getSaleDetail } from './get-sale-detail';
import { Sale } from '../../domain/sale';
import { CreditGranted } from '../../domain/credit-granted';
import { Client } from '../../domain/client';
import { CatalogItem } from '../../domain/catalog';
import { Account } from '../../domain/account';
import { Money } from '../../domain/money';
import { NotFoundError } from '../../domain/errors';
import type { SaleRepository } from '../../domain/repositories';

// ─── Fake factories ────────────────────────────────────────────────

function fakeSaleRepo(sale: Sale | null): SaleRepository & { created: Sale[] } {
  return {
    created: [],
    findById: vi.fn().mockResolvedValue(sale),
    findByUserId: vi.fn().mockResolvedValue(sale ? [sale] : []),
    create: vi.fn().mockImplementation(async (s: Sale) => s),
    update: vi.fn().mockImplementation(async (s: Sale) => s),
    delete: vi.fn().mockResolvedValue(undefined),
    addAbono: vi.fn().mockResolvedValue(undefined),
    editAbono: vi.fn().mockResolvedValue(undefined),
    deleteAbono: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeClientRepo(client: Client | null) {
  return {
    findById: vi.fn().mockResolvedValue(client),
    findByUserId: vi.fn().mockResolvedValue(client ? [client] : []),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (c: Client) => c),
    update: vi.fn().mockImplementation(async (c: Client) => c),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeCatalogRepo(items: CatalogItem[]) {
  return {
    findById: vi.fn().mockResolvedValue(items[0] ?? null),
    findByUserId: vi.fn().mockResolvedValue(items),
    create: vi.fn().mockImplementation(async (i: CatalogItem) => i),
    update: vi.fn().mockImplementation(async (i: CatalogItem) => i),
    delete: vi.fn().mockResolvedValue(undefined),
    decrementStock: vi.fn().mockResolvedValue(true),
    incrementStock: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeAccountRepo(account: Account | null) {
  return {
    findById: vi.fn().mockResolvedValue(account),
    findByUserId: vi.fn().mockResolvedValue(account ? [account] : []),
    create: vi.fn().mockImplementation(async (a: Account) => a),
    update: vi.fn().mockImplementation(async (a: Account) => a),
    delete: vi.fn().mockResolvedValue(undefined),
    countReferences: vi.fn().mockResolvedValue(0),
  };
}

function fakeCreditGrantedRepo(credits: CreditGranted[]) {
  return {
    findById: vi.fn().mockResolvedValue(credits[0] ?? null),
    findByUserId: vi.fn().mockResolvedValue(credits),
    create: vi.fn().mockImplementation(async (c: CreditGranted) => c),
    update: vi.fn().mockImplementation(async (c: CreditGranted) => c),
    delete: vi.fn().mockResolvedValue(undefined),
    addAbono: vi.fn().mockResolvedValue(undefined),
    editAbono: vi.fn().mockResolvedValue(undefined),
    deleteAbono: vi.fn().mockResolvedValue(undefined),
    markWrittenOff: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Fixtures ──────────────────────────────────────────────────────

const DATE = new Date('2025-06-01');

function makeSale(
  overrides: Partial<ConstructorParameters<typeof Sale>[0]> = {},
  abonos: ConstructorParameters<typeof Sale>[1] = [],
): Sale {
  return new Sale(
    {
      id: 'sale-1',
      userId: 'user-1',
      items: [{ itemId: 'item-1', quantity: 2, unitPrice: new Money(50000, 'COP') }],
      date: DATE,
      paymentMode: 'on-credit',
      accountId: 'acc-1',
      clientId: 'client-1',
      createdAt: new Date(),
      ...overrides,
    },
    abonos,
  );
}

function makeClient(): Client {
  return new Client({
    id: 'client-1',
    userId: 'user-1',
    name: 'Juan Pérez',
    phone: '',
    email: '',
    note: '',
    createdAt: new Date(),
  });
}

function makeCatalogItem(): CatalogItem {
  return new CatalogItem({
    id: 'item-1',
    userId: 'user-1',
    name: 'Perfume A',
    unitPrice: new Money(50000, 'COP'),
    type: 'product',
    stock: 10,
    createdAt: new Date(),
  });
}

function makeAccount(): Account {
  return new Account({
    id: 'acc-1',
    userId: 'user-1',
    name: 'Efectivo',
    currency: 'COP',
    isFixed: true,
    createdAt: new Date(),
  });
}

function makeLinkedCredit(
  overrides: Partial<ConstructorParameters<typeof CreditGranted>[0]> = {},
  abonos: ConstructorParameters<typeof CreditGranted>[1] = [],
): CreditGranted {
  return new CreditGranted(
    {
      id: 'cg-1',
      userId: 'user-1',
      counterparty: 'Juan Pérez',
      principal: new Money(80000, 'COP'),
      accountId: 'acc-1',
      date: DATE,
      saleId: 'sale-1',
      createdAt: new Date(),
      ...overrides,
    },
    abonos,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('getSaleDetail', () => {
  it('throws NotFoundError when the sale does not exist', async () => {
    await expect(
      getSaleDetail(
        'user-1',
        'missing',
        fakeSaleRepo(null),
        fakeClientRepo(null),
        fakeCatalogRepo([]),
        fakeAccountRepo(makeAccount()),
        fakeCreditGrantedRepo([]),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('returns a paid-in-full snapshot with full payment and no abonos', async () => {
    const sale = makeSale({ paymentMode: 'paid-in-full' });
    const snapshot = await getSaleDetail(
      'user-1',
      'sale-1',
      fakeSaleRepo(sale),
      fakeClientRepo(makeClient()),
      fakeCatalogRepo([makeCatalogItem()]),
      fakeAccountRepo(makeAccount()),
      fakeCreditGrantedRepo([]),
    );

    expect(snapshot.paymentMode).toBe('paid-in-full');
    expect(snapshot.status).toBe('paid');
    expect(snapshot.total).toBe(100000);
    expect(snapshot.initialPayment).toBe(100000);
    expect(snapshot.pending).toBe(0);
    expect(snapshot.abonos).toHaveLength(0);
    expect(snapshot.hasLinkedCredit).toBe(false);
    expect(snapshot.clientName).toBe('Juan Pérez');
    expect(snapshot.accountName).toBe('Efectivo');
    expect(snapshot.currency).toBe('COP');
  });

  it('resolves item names and computes subtotals', async () => {
    const sale = makeSale();
    const snapshot = await getSaleDetail(
      'user-1',
      'sale-1',
      fakeSaleRepo(sale),
      fakeClientRepo(makeClient()),
      fakeCatalogRepo([makeCatalogItem()]),
      fakeAccountRepo(makeAccount()),
      fakeCreditGrantedRepo([]),
    );

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0].itemName).toBe('Perfume A');
    expect(snapshot.items[0].quantity).toBe(2);
    expect(snapshot.items[0].unitPrice).toEqual({ amount: 50000, currency: 'COP' });
    expect(snapshot.items[0].subtotal).toBe(100000);
  });

  it('derives initialPayment/pending/abonos for the LEGACY model (net principal ≠ total) (H14 invariant)', async () => {
    // total=100000, principal(net)=80000 → initialPayment=total−principal=20000.
    const sale = makeSale();
    const credit = makeLinkedCredit({}, [
      { id: 'ab-1', amount: new Money(30000, 'COP'), date: DATE, accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const snapshot = await getSaleDetail(
      'user-1',
      'sale-1',
      fakeSaleRepo(sale),
      fakeClientRepo(makeClient()),
      fakeCatalogRepo([makeCatalogItem()]),
      fakeAccountRepo(makeAccount()),
      fakeCreditGrantedRepo([credit]),
    );

    expect(snapshot.hasLinkedCredit).toBe(true);
    expect(snapshot.initialPayment).toBe(20000);
    expect(snapshot.pending).toBe(50000);
    expect(snapshot.abonos).toHaveLength(1);
    expect(snapshot.abonos[0].amount).toEqual({ amount: 30000, currency: 'COP' });
    // Invariant: pending == total − initialPayment − Σ abonos.
    expect(snapshot.pending).toBe(100000 - 20000 - 30000);
    expect(snapshot.status).toBe('pending');
  });

  it('derives initialPayment from the credit FIRST abono for the NEW model (principal === total) (R5-D0b)', async () => {
    // total=100000, principal = total → initialPayment = abonos[0] = 20000.
    const sale = makeSale();
    const credit = makeLinkedCredit({ principal: new Money(100000, 'COP') }, [
      { id: 'ab-init', amount: new Money(20000, 'COP'), date: DATE, accountId: 'acc-1', movementId: 'mov-init' },
      { id: 'ab-2', amount: new Money(30000, 'COP'), date: DATE, accountId: 'acc-1', movementId: 'mov-2' },
    ]);
    const snapshot = await getSaleDetail(
      'user-1',
      'sale-1',
      fakeSaleRepo(sale),
      fakeClientRepo(makeClient()),
      fakeCatalogRepo([makeCatalogItem()]),
      fakeAccountRepo(makeAccount()),
      fakeCreditGrantedRepo([credit]),
    );

    expect(snapshot.hasLinkedCredit).toBe(true);
    expect(snapshot.initialPayment).toBe(20000);
    expect(snapshot.pending).toBe(50000);
    expect(snapshot.abonos).toHaveLength(2);
    expect(snapshot.status).toBe('pending');
  });

  it('derives initialPayment = 0 for a new-model credit with no abonos yet (R5-D0b)', async () => {
    // total=100000, principal = total, no abonos → no initial payment.
    const sale = makeSale();
    const credit = makeLinkedCredit({ principal: new Money(100000, 'COP') }, []);
    const snapshot = await getSaleDetail(
      'user-1',
      'sale-1',
      fakeSaleRepo(sale),
      fakeClientRepo(makeClient()),
      fakeCatalogRepo([makeCatalogItem()]),
      fakeAccountRepo(makeAccount()),
      fakeCreditGrantedRepo([credit]),
    );

    expect(snapshot.initialPayment).toBe(0);
    expect(snapshot.pending).toBe(100000);
    expect(snapshot.hasLinkedCredit).toBe(true);
  });

  it('marks a linked credit fully settled as paid', async () => {
    const sale = makeSale();
    const credit = makeLinkedCredit({ principal: new Money(80000, 'COP') }, [
      { id: 'ab-1', amount: new Money(80000, 'COP'), date: DATE, accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const snapshot = await getSaleDetail(
      'user-1',
      'sale-1',
      fakeSaleRepo(sale),
      fakeClientRepo(makeClient()),
      fakeCatalogRepo([makeCatalogItem()]),
      fakeAccountRepo(makeAccount()),
      fakeCreditGrantedRepo([credit]),
    );

    expect(snapshot.pending).toBe(0);
    expect(snapshot.status).toBe('paid');
  });

  it('falls back to sale embedded abonos for legacy on-credit sales without a linked credit', async () => {
    const sale = makeSale({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: DATE, accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const snapshot = await getSaleDetail(
      'user-1',
      'sale-1',
      fakeSaleRepo(sale),
      fakeClientRepo(makeClient()),
      fakeCatalogRepo([makeCatalogItem()]),
      fakeAccountRepo(makeAccount()),
      fakeCreditGrantedRepo([]),
    );

    expect(snapshot.hasLinkedCredit).toBe(false);
    expect(snapshot.initialPayment).toBe(0);
    expect(snapshot.pending).toBe(75000);
    expect(snapshot.abonos).toHaveLength(1);
    expect(snapshot.status).toBe('pending');
  });

  it('renders dangling references as null instead of failing', async () => {
    const sale = makeSale();
    const snapshot = await getSaleDetail(
      'user-1',
      'sale-1',
      fakeSaleRepo(sale),
      // Client deleted → findById resolves null (repos honor the nullable port).
      fakeClientRepo(null),
      // Catalog item deleted → name unresolvable.
      fakeCatalogRepo([]),
      // Account deleted → name unresolvable.
      fakeAccountRepo(null),
      fakeCreditGrantedRepo([]),
    );

    expect(snapshot.clientName).toBeNull();
    expect(snapshot.accountName).toBeNull();
    expect(snapshot.items[0].itemName).toBeNull();
  });
});
