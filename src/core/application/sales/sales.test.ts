import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSale } from './create-sale';
import { addSaleAbono } from './add-sale-abono';
import { deleteSaleAbono } from './delete-sale-abono';
import { deleteSale } from './delete-sale';
import { listSales } from './list-sales';
import { Sale } from '../../domain/sale';
import { CreditGranted } from '../../domain/credit-granted';
import { Client } from '../../domain/client';
import { Movement } from '../../domain/movement';
import { Category } from '../../domain/category';
import { Account } from '../../domain/account';
import { Money } from '../../domain/money';
import { CatalogItem } from '../../domain/catalog';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import type {
  SaleRepository,
  CatalogItemRepository,
  MovementRepository,
  ClientRepository,
  CreditGrantedRepository,
  AccountRepository,
} from '../../domain/repositories';
import type { IdGenerator } from '../ports';

// ─── Fake factories ────────────────────────────────────────────────

let idCounter = 0;

interface AbonoRecord {
  id: string;
  amount: number;
  date: Date;
  accountId: string;
  movementId?: string;
}

function fakeSaleRepo(
  overrides: Partial<SaleRepository> = {},
): SaleRepository & { created: Sale[]; updated: Sale[]; deleted: string[]; abonosAdded: { saleId: string; abono: AbonoRecord }[]; abonosEdited: { saleId: string; abonoId: string; updates: Partial<{ amount: number; date: Date; movementId: string }> }[]; abonosDeleted: { saleId: string; abonoId: string }[] } {
  const created: Sale[] = [];
  const updated: Sale[] = [];
  const deleted: string[] = [];
  const abonosAdded: { saleId: string; abono: AbonoRecord }[] = [];
  const abonosEdited: { saleId: string; abonoId: string; updates: Partial<{ amount: number; date: Date; movementId: string }> }[] = [];
  const abonosDeleted: { saleId: string; abonoId: string }[] = [];
  return {
    created,
    updated,
    deleted,
    abonosAdded,
    abonosEdited,
    abonosDeleted,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (sale: Sale) => {
      created.push(sale);
      return sale;
    }),
    update: vi.fn().mockImplementation(async (sale: Sale) => {
      updated.push(sale);
      return sale;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    addAbono: vi.fn().mockImplementation(async (_userId: string, saleId: string, abono: AbonoRecord) => {
      abonosAdded.push({ saleId, abono });
    }),
    editAbono: vi.fn().mockImplementation(async (_userId: string, saleId: string, abonoId: string, updates: Partial<{ amount: number; date: Date; movementId: string }>) => {
      abonosEdited.push({ saleId, abonoId, updates });
    }),
    deleteAbono: vi.fn().mockImplementation(async (_userId: string, saleId: string, abonoId: string) => {
      abonosDeleted.push({ saleId, abonoId });
    }),
    ...overrides,
  };
}

function fakeCatalogRepo(
  overrides: Partial<CatalogItemRepository> = {},
) {
  const decremented: { itemId: string; quantity: number }[] = [];
  const incremented: { itemId: string; quantity: number }[] = [];

  // Shared state — mock implementations read from here so tests can toggle behavior
  const state = { shouldDecrement: true };

  const repo = {
    decremented,
    incremented,
    state,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (item: CatalogItem) => item),
    update: vi.fn().mockImplementation(async (item: CatalogItem) => item),
    delete: vi.fn().mockResolvedValue(undefined),
    decrementStock: vi.fn().mockImplementation(async (_userId: string, itemId: string, quantity: number) => {
      decremented.push({ itemId, quantity });
      return state.shouldDecrement;
    }),
    incrementStock: vi.fn().mockImplementation(async (_userId: string, itemId: string, quantity: number) => {
      incremented.push({ itemId, quantity });
    }),
    ...overrides,
  };
  return repo;
}

function fakeMovementRepo(
  overrides: Partial<MovementRepository> = {},
): MovementRepository & { created: Movement[]; updated: Movement[]; deleted: string[] } {
  const created: Movement[] = [];
  const updated: Movement[] = [];
  const deleted: string[] = [];
  return {
    created,
    updated,
    deleted,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByAccountId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (movement: Movement) => {
      created.push(movement);
      return movement;
    }),
    update: vi.fn().mockImplementation(async (movement: Movement) => {
      updated.push(movement);
      return movement;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    aggregateBalance: vi.fn().mockResolvedValue(0),
    countByCategoryId: vi.fn().mockResolvedValue(0),
    findPaged: async () => ({ items: [], nextCursor: null }),
    ...overrides,
  };
}

function fakeIdGen(): IdGenerator {
  return { generate: () => `id-${++idCounter}` };
}

function fakeClientRepo(
  overrides: Partial<ClientRepository> = {},
): ClientRepository & { client: Client } {
  const client = new Client({
    id: 'client-1',
    userId: 'user-1',
    name: 'Juan Pérez',
    phone: '',
    email: '',
    note: '',
    createdAt: new Date(),
  });
  return {
    client,
    findById: vi.fn().mockResolvedValue(client),
    findByUserId: vi.fn().mockResolvedValue([client]),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (c: Client) => c),
    update: vi.fn().mockImplementation(async (c: Client) => c),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeCreditGrantedRepo(
  overrides: Partial<CreditGrantedRepository> = {},
): CreditGrantedRepository & { created: CreditGranted[]; deleted: string[] } {
  const created: CreditGranted[] = [];
  const deleted: string[] = [];
  return {
    created,
    deleted,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (credit: CreditGranted) => {
      created.push(credit);
      return credit;
    }),
    update: vi.fn().mockImplementation(async (credit: CreditGranted) => credit),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    addAbono: vi.fn().mockResolvedValue(undefined),
    editAbono: vi.fn().mockResolvedValue(undefined),
    deleteAbono: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeAccountRepo(
  accounts: Account[] = [],
): AccountRepository {
  return {
    findById: vi.fn().mockImplementation(async (_userId: string, id: string) =>
      accounts.find((a) => a.id === id) ?? null,
    ),
    findByUserId: vi.fn().mockResolvedValue(accounts),
    create: vi.fn().mockImplementation(async (account: Account) => account),
    update: vi.fn().mockImplementation(async (account: Account) => account),
    delete: vi.fn().mockResolvedValue(undefined),
    countReferences: vi.fn().mockResolvedValue(0),
  };
}

function makeAccount(
  id: string,
): Account {
  return new Account({
    id,
    userId: 'user-1',
    name: `Account ${id}`,
    currency: 'COP',
    isFixed: false,
    createdAt: new Date(),
  });
}

function makeSale(
  overrides: Partial<ConstructorParameters<typeof Sale>[0]> = {},
  abonos: ConstructorParameters<typeof Sale>[1] = [],
): Sale {
  return new Sale(
    {
      id: 'sale-1',
      userId: 'user-1',
      items: [{ itemId: 'item-1', quantity: 2, unitPrice: new Money(50000, 'COP') }],
      date: new Date('2025-06-01'),
      paymentMode: 'on-credit',
      accountId: 'acc-1',
      createdAt: new Date(),
      ...overrides,
    },
    abonos,
  );
}

function makeProduct(
  overrides: Partial<ConstructorParameters<typeof CatalogItem>[0]> = {},
): CatalogItem {
  return new CatalogItem({
    id: 'item-1',
    userId: 'user-1',
    name: 'Product A',
    unitPrice: new Money(50000, 'COP'),
    type: 'product',
    stock: 10,
    createdAt: new Date(),
    ...overrides,
  });
}

function makeService(
  overrides: Partial<ConstructorParameters<typeof CatalogItem>[0]> = {},
): CatalogItem {
  return new CatalogItem({
    id: 'item-2',
    userId: 'user-1',
    name: 'Service B',
    unitPrice: new Money(30000, 'COP'),
    type: 'service',
    createdAt: new Date(),
    ...overrides,
  });
}

function makeMovement(
  overrides: Partial<ConstructorParameters<typeof Movement>[0]> = {},
): Movement {
  const type = overrides.type ?? 'income';
  return new Movement({
    id: 'mov-1',
    userId: 'user-1',
    accountId: 'acc-1',
    category: new Category({ id: 'cat-1', userId: 'user-1', name: 'Sale', type, createdAt: new Date() }),
    type,
    amount: new Money(50000, 'COP'),
    date: new Date('2025-06-01'),
    context: 'Personal',
    createdAt: new Date(),
    ...overrides,
  });
}

beforeEach(() => {
  idCounter = 0;
});

// ─── Create Sale ────────────────────────────────────────────────────

describe('createSale', () => {
  it('creates a paid-in-full sale with line items and income movement (POS-2, POS-4)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const sale = await createSale(
      'user-1',
      {
        items: [{ itemId: 'item-1', quantity: 2, unitPrice: 50000 }],
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
        paymentMode: 'paid-in-full',
        currency: 'COP',
      },
      saleRepo,
      catalogRepo,
      movementRepo,
      ids,
      clientRepo,
      creditRepo,
      accountRepo,
    );

    expect(sale.total).toBe(100000);
    expect(sale.paymentMode).toBe('paid-in-full');
    expect(saleRepo.created).toHaveLength(1);
    expect(movementRepo.created).toHaveLength(1);
    expect(movementRepo.created[0].type).toBe('income');
    expect(movementRepo.created[0].amount.amount).toBe(100000);
    expect(movementRepo.created[0].link?.kind).toBe('salePayment');
    expect(creditRepo.created).toHaveLength(0);
    expect(catalogRepo.decremented).toHaveLength(1);
    expect(catalogRepo.decremented[0].quantity).toBe(2);
  });

  it('rejects a paid-in-full sale carrying an initial payment (H14)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createSale(
        'user-1',
        {
          items: [{ itemId: 'item-1', quantity: 1, unitPrice: 50000 }],
          accountId: 'acc-1',
          date: new Date('2025-06-01'),
          paymentMode: 'paid-in-full',
          currency: 'COP',
          initialPayment: 10000,
        },
        saleRepo,
        catalogRepo,
        movementRepo,
        ids,
        clientRepo,
        creditRepo,
        accountRepo,
      ),
    ).rejects.toThrow(ValidationError);
    expect(saleRepo.created).toHaveLength(0);
    expect(movementRepo.created).toHaveLength(0);
  });

  it('creates an on-credit sale with a linked credit and no movements when initialPayment is omitted (H14)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const sale = await createSale(
      'user-1',
      {
        items: [{ itemId: 'item-1', quantity: 1, unitPrice: 50000 }],
        accountId: 'acc-1',
        clientId: 'client-1',
        date: new Date('2025-06-01'),
        paymentMode: 'on-credit',
        currency: 'COP',
      },
      saleRepo,
      catalogRepo,
      movementRepo,
      ids,
      clientRepo,
      creditRepo,
      accountRepo,
    );

    expect(sale.paymentMode).toBe('on-credit');
    expect(movementRepo.created).toHaveLength(0);
    expect(saleRepo.created).toHaveLength(1);
    // R5-D0: principal = total (the credit owns the whole debt; no abonos yet).
    expect(creditRepo.created).toHaveLength(1);
    expect(creditRepo.created[0].principal.amount).toBe(50000);
    expect(creditRepo.created[0].pending).toBe(50000);
    expect(creditRepo.created[0].abonos).toHaveLength(0);
    expect(creditRepo.created[0].saleId).toBe(sale.id);
  });

  it('rejects an on-credit sale without a client (H14)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createSale(
        'user-1',
        {
          items: [{ itemId: 'item-1', quantity: 1, unitPrice: 50000 }],
          accountId: 'acc-1',
          date: new Date('2025-06-01'),
          paymentMode: 'on-credit',
          currency: 'COP',
        },
        saleRepo,
        catalogRepo,
        movementRepo,
        ids,
        clientRepo,
        creditRepo,
        accountRepo,
      ),
    ).rejects.toThrow(ValidationError);
    expect(saleRepo.created).toHaveLength(0);
    expect(creditRepo.created).toHaveLength(0);
  });

  it('rejects an on-credit sale with an unknown client (H14)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createSale(
        'user-1',
        {
          items: [{ itemId: 'item-1', quantity: 1, unitPrice: 50000 }],
          accountId: 'acc-1',
          clientId: 'missing-client',
          date: new Date('2025-06-01'),
          paymentMode: 'on-credit',
          currency: 'COP',
        },
        saleRepo,
        catalogRepo,
        movementRepo,
        ids,
        clientRepo,
        creditRepo,
        accountRepo,
      ),
    ).rejects.toThrow(NotFoundError);
    expect(saleRepo.created).toHaveLength(0);
    expect(creditRepo.created).toHaveLength(0);
  });

  it('rejects an initial payment greater than the total (H14)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createSale(
        'user-1',
        {
          items: [{ itemId: 'item-1', quantity: 1, unitPrice: 50000 }],
          accountId: 'acc-1',
          clientId: 'client-1',
          date: new Date('2025-06-01'),
          paymentMode: 'on-credit',
          currency: 'COP',
          initialPayment: 60000,
        },
        saleRepo,
        catalogRepo,
        movementRepo,
        ids,
        clientRepo,
        creditRepo,
        accountRepo,
      ),
    ).rejects.toThrow(ConflictError);
    // Validation happens before any write: no stock decrement either.
    expect(saleRepo.created).toHaveLength(0);
    expect(catalogRepo.decremented).toHaveLength(0);
    expect(creditRepo.created).toHaveLength(0);
  });

  it('rejects a negative initial payment (H14)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createSale(
        'user-1',
        {
          items: [{ itemId: 'item-1', quantity: 1, unitPrice: 50000 }],
          accountId: 'acc-1',
          clientId: 'client-1',
          date: new Date('2025-06-01'),
          paymentMode: 'on-credit',
          currency: 'COP',
          initialPayment: -1,
        },
        saleRepo,
        catalogRepo,
        movementRepo,
        ids,
        clientRepo,
        creditRepo,
        accountRepo,
      ),
    ).rejects.toThrow(ValidationError);
    expect(creditRepo.created).toHaveLength(0);
  });

  it('on-credit with initialPayment > 0 records it as the credit FIRST abono and one credit abono movement (R5-D0/R5-D0b)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const sale = await createSale(
      'user-1',
      {
        items: [{ itemId: 'item-1', quantity: 3, unitPrice: 50000 }],
        accountId: 'acc-1',
        clientId: 'client-1',
        date: new Date('2025-06-01'),
        paymentMode: 'on-credit',
        currency: 'COP',
        initialPayment: 20000,
      },
      saleRepo,
      catalogRepo,
      movementRepo,
      ids,
      clientRepo,
      creditRepo,
      accountRepo,
    );

    // Exactly one income movement = initialPayment, linked to the CREDIT.
    expect(movementRepo.created).toHaveLength(1);
    expect(movementRepo.created[0].type).toBe('income');
    expect(movementRepo.created[0].amount.amount).toBe(20000);
    expect(movementRepo.created[0].accountId).toBe('acc-1');
    expect(movementRepo.created[0].context).toBe('Business');
    expect(movementRepo.created[0].link?.kind).toBe('creditGrantedAbono');
    expect(movementRepo.created[0].link?.refId).toBe(creditRepo.created[0].id);
    expect(movementRepo.created[0].id).toBe(creditRepo.created[0].abonos[0].movementId);

    // The credit owns the FULL debt; the initial payment is its first abono.
    expect(creditRepo.created).toHaveLength(1);
    const credit = creditRepo.created[0];
    expect(credit.principal.amount).toBe(150000);
    expect(credit.abonos).toHaveLength(1);
    expect(credit.abonos[0].amount.amount).toBe(20000);
    expect(credit.pending).toBe(130000);
    expect(credit.saleId).toBe(sale.id);
    expect(credit.counterparty).toBe('Juan Pérez');
    expect(credit.accountId).toBe('acc-1');

    // Invariant: pending == total − Σ abonos (R5-D0).
    expect(credit.pending).toBe(150000 - 20000);
  });

  it('on-credit with initialPayment = 0 creates no movement (H14)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await createSale(
      'user-1',
      {
        items: [{ itemId: 'item-1', quantity: 1, unitPrice: 50000 }],
        accountId: 'acc-1',
        clientId: 'client-1',
        date: new Date('2025-06-01'),
        paymentMode: 'on-credit',
        currency: 'COP',
        initialPayment: 0,
      },
      saleRepo,
      catalogRepo,
      movementRepo,
      ids,
      clientRepo,
      creditRepo,
      accountRepo,
    );

    expect(creditRepo.created).toHaveLength(1);
    expect(creditRepo.created[0].principal.amount).toBe(50000);
    expect(creditRepo.created[0].pending).toBe(50000);
    expect(creditRepo.created[0].abonos).toHaveLength(0);
    expect(movementRepo.created).toHaveLength(0);
  });

  it('allows initialPayment = total: credit born paid-in-full with first abono = total and one income movement (R5-D0b)', async () => {
    const product = makeProduct();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await createSale(
      'user-1',
      {
        items: [{ itemId: 'item-1', quantity: 1, unitPrice: 50000 }],
        accountId: 'acc-1',
        clientId: 'client-1',
        date: new Date('2025-06-01'),
        paymentMode: 'on-credit',
        currency: 'COP',
        initialPayment: 50000,
      },
      saleRepo,
      catalogRepo,
      movementRepo,
      ids,
      clientRepo,
      creditRepo,
      accountRepo,
    );

    expect(creditRepo.created).toHaveLength(1);
    expect(creditRepo.created[0].principal.amount).toBe(50000);
    expect(creditRepo.created[0].pending).toBe(0);
    expect(creditRepo.created[0].abonos).toHaveLength(1);
    expect(creditRepo.created[0].abonos[0].amount.amount).toBe(50000);
    // initialPayment = total → the full amount becomes the credit's first
    // abono; exactly one credit-abono income movement (no separate salePayment).
    expect(movementRepo.created).toHaveLength(1);
    const movement = movementRepo.created[0];
    expect(movement.type).toBe('income');
    expect(movement.amount.amount).toBe(50000);
    expect(movement.link?.kind).toBe('creditGrantedAbono');
    expect(movement.link?.refId).toBe(creditRepo.created[0].id);
  });

  it('allows services without stock decrement (POS-3)', async () => {
    const service = makeService();
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(service),
    });
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await createSale(
      'user-1',
      {
        items: [{ itemId: 'item-2', quantity: 1, unitPrice: 30000 }],
        accountId: 'acc-1',
        clientId: 'client-1',
        date: new Date('2025-06-01'),
        paymentMode: 'on-credit',
        currency: 'COP',
      },
      saleRepo,
      catalogRepo,
      movementRepo,
      ids,
      clientRepo,
      creditRepo,
      accountRepo,
    );

    expect(catalogRepo.decremented).toHaveLength(0);
  });

  it('rejects sale when product stock is insufficient (POS-3)', async () => {
    const product = makeProduct({ stock: 1 });
    const saleRepo = fakeSaleRepo();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    catalogRepo.state.shouldDecrement = false;
    const movementRepo = fakeMovementRepo();
    const clientRepo = fakeClientRepo();
    const creditRepo = fakeCreditGrantedRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createSale(
        'user-1',
        {
          items: [{ itemId: 'item-1', quantity: 5, unitPrice: 50000 }],
          accountId: 'acc-1',
          clientId: 'client-1',
          date: new Date('2025-06-01'),
          paymentMode: 'on-credit',
          currency: 'COP',
        },
        saleRepo,
        catalogRepo,
        movementRepo,
        ids,
        clientRepo,
        creditRepo,
        accountRepo,
      ),
    ).rejects.toThrow(ConflictError);
    expect(saleRepo.created).toHaveLength(0);
  });
});

// ─── Add Sale Abono ────────────────────────────────────────────────

describe('addSaleAbono', () => {
  it('adds an abono and creates income movement (POS-4)', async () => {
    const sale = makeSale();
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const result = await addSaleAbono(
      'user-1',
      'sale-1',
      { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
      saleRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    expect(result.abonos).toHaveLength(1);
    expect(result.abonos[0].amount.amount).toBe(25000);
    expect(result.pending).toBe(75000);
    expect(saleRepo.addAbono).toHaveBeenCalledOnce();
    expect(movementRepo.created).toHaveLength(1);
    expect(movementRepo.created[0].type).toBe('income');
    expect(movementRepo.created[0].link?.kind).toBe('salePayment');
  });

  it('sets context to Business (hardcoded) regardless of account', async () => {
    const sale = makeSale(); // sale.accountId = acc-1
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-1'),
      makeAccount('acc-biz'),
    ]);
    const ids = fakeIdGen();

    await addSaleAbono(
      'user-1',
      'sale-1',
      { amount: 25000, currency: 'COP', accountId: 'acc-biz', date: new Date('2025-07-01') },
      saleRepo,
      movementRepo,
      ids,
      accountRepo,
    );

    const movement = movementRepo.created[0];
    expect(movement.accountId).toBe('acc-biz');
    expect(movement.context).toBe('Business');
  });

  it('rejects abono exceeding pending amount (POS-5)', async () => {
    const sale = makeSale();
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      addSaleAbono(
        'user-1',
        'sale-1',
        { amount: 150000, currency: 'COP', accountId: 'acc-1', date: new Date('2025-07-01') },
        saleRepo,
        movementRepo,
        ids,
        accountRepo,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects when sale not found', async () => {
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      addSaleAbono(
        'user-1',
        'missing',
        { amount: 25000, currency: 'COP', accountId: 'acc-1', date: new Date() },
        saleRepo,
        movementRepo,
        ids,
        accountRepo,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Delete Sale Abono ─────────────────────────────────────────────

describe('deleteSaleAbono', () => {
  it('removes abono and reverses linked movement (POS-6)', async () => {
    const sale = makeSale({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const movementRepo = fakeMovementRepo();

    const result = await deleteSaleAbono('user-1', 'sale-1', 'ab-1', saleRepo, movementRepo);

    expect(result.abonos).toHaveLength(0);
    expect(result.pending).toBe(100000);
    expect(saleRepo.deleteAbono).toHaveBeenCalledOnce();
    expect(movementRepo.deleted).toContain('mov-1');
  });

  it('deletes the linked movement BEFORE pulling the abono (R5-B atomicity)', async () => {
    const sale = makeSale({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const deleteAbonoMock = vi.fn().mockImplementation(async () => {});
    const deleteMovementMock = vi.fn().mockImplementation(async () => {});
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
      deleteAbono: deleteAbonoMock,
    });
    const movementRepo = fakeMovementRepo({ delete: deleteMovementMock });

    await deleteSaleAbono('user-1', 'sale-1', 'ab-1', saleRepo, movementRepo);

    expect(deleteMovementMock.mock.invocationCallOrder[0])
      .toBeLessThan(deleteAbonoMock.mock.invocationCallOrder[0]);
  });

  it('tolerates an already-missing movement when deleting an abono (R5-B)', async () => {
    const sale = makeSale({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const movementRepo = fakeMovementRepo({
      delete: vi.fn().mockRejectedValue(new NotFoundError('Movement not found')),
    });

    const result = await deleteSaleAbono('user-1', 'sale-1', 'ab-1', saleRepo, movementRepo);

    expect(result.abonos).toHaveLength(0);
    expect(saleRepo.deleteAbono).toHaveBeenCalledOnce();
    expect(movementRepo.deleted).toHaveLength(0);
  });

  it('propagates non-NotFound movement errors WITHOUT pulling the abono (R5-B)', async () => {
    const sale = makeSale({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-1' },
    ]);
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const movementRepo = fakeMovementRepo({
      delete: vi.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(
      deleteSaleAbono('user-1', 'sale-1', 'ab-1', saleRepo, movementRepo),
    ).rejects.toThrow('db down');

    expect(saleRepo.deleteAbono).not.toHaveBeenCalled();
  });

  it('rejects when sale not found', async () => {
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteSaleAbono('user-1', 'missing', 'ab-1', saleRepo, movementRepo),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects when abono not found', async () => {
    const sale = makeSale();
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteSaleAbono('user-1', 'sale-1', 'missing-abono', saleRepo, movementRepo),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Delete Sale ───────────────────────────────────────────────────

describe('deleteSale', () => {
  it('deletes sale, reverses movements, and restores stock (POS-8)', async () => {
    const product = makeProduct();
    const sale = makeSale({}, [
      { id: 'ab-1', amount: new Money(25000, 'COP'), date: new Date(), accountId: 'acc-1', movementId: 'mov-abono' },
    ]);
    const abonoMovement = makeMovement({
      id: 'mov-abono',
      type: 'income',
      link: { kind: 'salePayment', refId: 'sale-1', opId: 'op-1' },
    });
    const paymentMovement = makeMovement({
      id: 'mov-payment',
      type: 'income',
      link: { kind: 'salePayment', refId: 'sale-1', opId: 'op-2' },
    });

    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue([abonoMovement, paymentMovement]),
    });
    const creditRepo = fakeCreditGrantedRepo();

    await deleteSale('user-1', 'sale-1', saleRepo, catalogRepo, movementRepo, creditRepo);

    expect(catalogRepo.incremented).toHaveLength(1);
    expect(catalogRepo.incremented[0].quantity).toBe(2); // restore 2 units
    expect(movementRepo.deleted).toContain('mov-abono');
    expect(movementRepo.deleted).toContain('mov-payment');
    expect(movementRepo.delete).toHaveBeenCalledTimes(2);
    expect(saleRepo.deleted).toContain('sale-1');
  });

  it('cascade-deletes the linked credit and ALL its movements when deleting an on-credit sale (R5-D0c)', async () => {
    const product = makeProduct();
    // NEW model: the sale owns no abonos; its credit owns the debt.
    const sale = makeSale({});
    const credit = new CreditGranted(
      {
        id: 'cg-1',
        userId: 'user-1',
        counterparty: 'Juan Pérez',
        principal: new Money(150000, 'COP'),
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
        saleId: 'sale-1',
        createdAt: new Date(),
      },
      [
        { id: 'ab-init', amount: new Money(20000, 'COP'), date: new Date('2025-06-01'), accountId: 'acc-1', movementId: 'mov-initial' },
        { id: 'ab-2', amount: new Money(30000, 'COP'), date: new Date('2025-07-01'), accountId: 'acc-1', movementId: 'mov-abono' },
      ],
    );
    const initialPaymentMovement = makeMovement({
      id: 'mov-initial',
      type: 'income',
      amount: new Money(20000, 'COP'),
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-1' },
    });
    const creditAbonoMovement = makeMovement({
      id: 'mov-abono',
      type: 'income',
      amount: new Money(30000, 'COP'),
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-2' },
    });
    // LEGACY leftover: an old-model salePayment that still references the sale.
    const legacySalePayment = makeMovement({
      id: 'mov-legacy',
      type: 'income',
      link: { kind: 'salePayment', refId: 'sale-1', opId: 'op-3' },
    });

    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue([initialPaymentMovement, creditAbonoMovement, legacySalePayment]),
    });
    const creditRepo = fakeCreditGrantedRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });

    await deleteSale('user-1', 'sale-1', saleRepo, catalogRepo, movementRepo, creditRepo);

    // Initial payment + credit abono (refId = creditId) AND legacy sale movement.
    expect(movementRepo.deleted).toContain('mov-initial');
    expect(movementRepo.deleted).toContain('mov-abono');
    expect(movementRepo.deleted).toContain('mov-legacy');
    expect(creditRepo.deleted).toContain('cg-1');
    expect(saleRepo.deleted).toContain('sale-1');
  });

  it('tolerates a movement that is already gone — no orphan, no false error (R5-D0c)', async () => {
    const product = makeProduct();
    const sale = makeSale({});
    const credit = new CreditGranted(
      {
        id: 'cg-1',
        userId: 'user-1',
        counterparty: 'Juan Pérez',
        principal: new Money(50000, 'COP'),
        accountId: 'acc-1',
        date: new Date('2025-06-01'),
        saleId: 'sale-1',
        createdAt: new Date(),
      },
      [
        { id: 'ab-init', amount: new Money(20000, 'COP'), date: new Date('2025-06-01'), accountId: 'acc-1', movementId: 'mov-initial' },
      ],
    );
    const initialPaymentMovement = makeMovement({
      id: 'mov-initial',
      type: 'income',
      amount: new Money(20000, 'COP'),
      link: { kind: 'creditGrantedAbono', refId: 'cg-1', opId: 'op-1' },
    });

    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale]),
    });
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(product),
    });
    const movementRepo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue([initialPaymentMovement]),
      // Concurrent deletion already removed the movement before we delete it.
      delete: vi.fn().mockRejectedValue(new NotFoundError('Movement already deleted')),
    });
    const creditRepo = fakeCreditGrantedRepo({
      findByUserId: vi.fn().mockResolvedValue([credit]),
    });

    await expect(
      deleteSale('user-1', 'sale-1', saleRepo, catalogRepo, movementRepo, creditRepo),
    ).resolves.toBeUndefined();

    expect(creditRepo.deleted).toContain('cg-1');
    expect(saleRepo.deleted).toContain('sale-1');
    expect(catalogRepo.incremented).toHaveLength(1);
  });

  it('rejects when sale not found', async () => {
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });
    const catalogRepo = fakeCatalogRepo();
    const movementRepo = fakeMovementRepo();
    const creditRepo = fakeCreditGrantedRepo();

    await expect(
      deleteSale('user-1', 'missing', saleRepo, catalogRepo, movementRepo, creditRepo),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── List Sales ────────────────────────────────────────────────────

describe('listSales', () => {
  it('returns all sales for user', async () => {
    const sale1 = makeSale({ id: 'sale-1' });
    const sale2 = makeSale({ id: 'sale-2' });
    const saleRepo = fakeSaleRepo({
      findByUserId: vi.fn().mockResolvedValue([sale1, sale2]),
    });

    const result = await listSales('user-1', saleRepo);

    expect(result).toHaveLength(2);
    expect(saleRepo.findByUserId).toHaveBeenCalledWith('user-1');
  });
});
