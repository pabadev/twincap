import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateSale } from "./update-sale";
import { Sale } from "../../domain/sale";
import { Movement } from "../../domain/movement";
import { CreditGranted } from "../../domain/credit-granted";
import { Category } from "../../domain/category";
import { Account } from "../../domain/account";
import { Money } from "../../domain/money";
import type { Currency } from "../../domain/currency";
import { ConflictError, ValidationError } from "../../domain/errors";
import type {
  SaleRepository,
  MovementRepository,
  CreditGrantedRepository,
  AccountRepository,
  CategoryRepository,
} from "../../domain/repositories";
import type { TransactionHandle } from "../../domain/transaction";
import type { UnitOfWork } from "../ports";

// ─── Fake factories (same discipline as credits-granted.test.ts) ──────────

function fakeSaleRepo(sale: Sale | null): SaleRepository & { updated: Sale[] } {
  const updated: Sale[] = [];
  return {
    updated,
    findById: vi.fn().mockImplementation(async () => sale),
    findByWorkspaceId: vi.fn().mockResolvedValue(sale ? [sale] : []),
    update: vi.fn().mockImplementation(async (s: Sale) => {
      updated.push(s);
      return s;
    }),
    create: vi.fn().mockImplementation(async (s: Sale) => s),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as SaleRepository & { updated: Sale[] };
}

function fakeAccountRepo(accounts: Account[] = []): AccountRepository {
  return {
    findById: vi
      .fn()
      .mockImplementation(
        async (_ws: string, id: string) => accounts.find((a) => a.id === id) ?? null,
      ),
    findByWorkspaceId: vi.fn().mockResolvedValue(accounts),
    create: vi.fn().mockImplementation(async (account: Account) => account),
    update: vi.fn().mockImplementation(async (account: Account) => account),
    delete: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue(true),
    countReferences: vi.fn().mockResolvedValue(0),
    bumpVersion: vi.fn().mockResolvedValue(true),
  };
}

function fakeCreditRepo(credits: CreditGranted[] = []): CreditGrantedRepository & {
  updated: CreditGranted[];
} {
  const updated: CreditGranted[] = [];
  return {
    updated,
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue(credits),
    create: vi.fn().mockImplementation(async (c: CreditGranted) => c),
    update: vi.fn().mockImplementation(async (c: CreditGranted) => {
      updated.push(c);
      return c;
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    addAbono: vi.fn().mockResolvedValue(null),
    editAbono: vi.fn().mockResolvedValue(null),
    deleteAbono: vi.fn().mockResolvedValue(null),
    bumpVersion: vi.fn().mockResolvedValue(true),
  } as unknown as CreditGrantedRepository & { updated: CreditGranted[] };
}

function fakeMovementRepo(movements: Movement[] = []): MovementRepository & {
  updated: Movement[];
} {
  const updated: Movement[] = [];
  return {
    updated,
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue(movements),
    findByAccountId: vi.fn().mockResolvedValue([]),
    findByAccountIdForBalance: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (m: Movement) => m),
    update: vi.fn().mockImplementation(async (m: Movement) => {
      updated.push(m);
      return m;
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(0),
    countByCategoryId: vi.fn().mockResolvedValue(0),
    countOpeningMovements: vi.fn().mockResolvedValue(0),
    findOpeningMovement: vi.fn().mockResolvedValue(null),
    findPaged: async () => ({ items: [], nextCursor: null }),
    findByWorkspaceIdAndDateRange: async () => [],
    findByWorkspaceIdForBalance: async () => [],
  } as MovementRepository & { updated: Movement[] };
}

function fakeCategoryRepo(category: Category | null): CategoryRepository {
  return {
    findById: vi.fn().mockResolvedValue(category),
    findByWorkspaceId: vi.fn().mockResolvedValue(category ? [category] : []),
    findByNameAndType: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (c: Category) => c),
    update: vi.fn().mockImplementation(async (c: Category) => c),
    delete: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue(true),
    bumpVersion: vi.fn().mockResolvedValue(true),
  } as unknown as CategoryRepository;
}

/** Transparent unit of work — just runs the callback (no real tx). */
function fakeUow(): UnitOfWork {
  return {
    withTransaction: <T>(fn: (tx: TransactionHandle) => Promise<T>) => fn({} as TransactionHandle),
  };
}

function makeSale(
  overrides: Partial<ConstructorParameters<typeof Sale>[0]> = {},
  abonos: ConstructorParameters<typeof Sale>[1] = [],
): Sale {
  return new Sale(
    {
      id: "sale-1",
      workspaceId: "user-1",
      items: [
        {
          itemId: "item-1",
          quantity: 1,
          stockQuantity: 1,
          unit: "unit",
          unitPrice: new Money(10000, "COP"),
        },
      ],
      date: new Date("2025-06-01"),
      paymentMode: "paid-in-full",
      accountId: "acc-1",
      createdAt: new Date("2025-06-01"),
      ...overrides,
    },
    abonos,
  );
}

function makeCredit(
  overrides: Partial<ConstructorParameters<typeof CreditGranted>[0]> = {},
  abonos: ConstructorParameters<typeof CreditGranted>[1] = [],
): CreditGranted {
  return new CreditGranted(
    {
      id: "cg-1",
      workspaceId: "user-1",
      counterparty: "Pedro",
      principal: new Money(10000, "COP"),
      accountId: "acc-1",
      date: new Date("2025-06-01"),
      saleId: "sale-1",
      createdAt: new Date("2025-06-01"),
      ...overrides,
    },
    abonos,
  );
}

function makeMovement(
  overrides: Partial<ConstructorParameters<typeof Movement>[0]> = {},
): Movement {
  const type = overrides.type ?? "income";
  return new Movement({
    id: "mov-1",
    workspaceId: "user-1",
    accountId: "acc-1",
    category: new Category({
      id: "cat-1",
      workspaceId: "user-1",
      name: "Ventas",
      type,
      createdAt: new Date(),
    }),
    type,
    amount: new Money(10000, "COP"),
    date: new Date("2025-06-01"),
    context: "Business",
    link: { kind: "salePayment", refId: "sale-1", opId: "op-1" },
    createdAt: new Date("2025-06-01"),
    ...overrides,
  });
}

function makeUserCategory(): Category {
  return new Category({
    id: "cat-1",
    workspaceId: "user-1",
    name: "Ventas",
    type: "income",
    createdAt: new Date(),
  });
}

function makeAccount(): Account {
  return new Account({
    id: "acc-1",
    workspaceId: "user-1",
    name: "Efectivo",
    currency: "COP" as Currency,
    isFixed: false,
    createdAt: new Date(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── updateSale (DOM-1 / EXC-2) ────────────────────────────────────

describe("updateSale", () => {
  it("paid-in-full: updates the salePayment movement to the new total and keeps the user category", async () => {
    const sale = makeSale();
    const movement = makeMovement();
    const saleRepo = fakeSaleRepo(sale);
    const movementRepo = fakeMovementRepo([movement]);
    const creditRepo = fakeCreditRepo([]);
    const accountRepo = fakeAccountRepo([makeAccount()]);
    const categoryRepo = fakeCategoryRepo(makeUserCategory());

    const result = await updateSale(
      "user-1",
      "sale-1",
      { unitPrices: [12000], currency: "COP" },
      saleRepo,
      movementRepo,
      creditRepo,
      accountRepo,
      categoryRepo,
      fakeUow(),
    );

    expect(result.total).toBe(12000);
    expect(saleRepo.updated).toHaveLength(1);
    expect(saleRepo.updated[0].version).toBe(sale.version + 1);
    // The income movement mirrors the new total with the ORIGINAL category.
    expect(movementRepo.updated).toHaveLength(1);
    expect(movementRepo.updated[0].amount.amount).toBe(12000);
    expect(movementRepo.updated[0].categoryId).toBe("cat-1");
    expect(accountRepo.touch).toHaveBeenCalled();
  });

  it("on-credit (NEW model): the credit principal follows the new total — the initial payment is already abono #1", async () => {
    const sale = makeSale({ paymentMode: "on-credit" });
    // NEW model: principal === total; the initial payment (2000) is abono #1.
    const credit = makeCredit({ principal: new Money(10000, "COP") }, [
      {
        id: "ab-1",
        amount: new Money(2000, "COP"),
        date: new Date("2025-06-01"),
        accountId: "acc-1",
      },
    ]);
    const saleRepo = fakeSaleRepo(sale);
    const movementRepo = fakeMovementRepo([]);
    const creditRepo = fakeCreditRepo([credit]);
    const accountRepo = fakeAccountRepo([makeAccount()]);
    const categoryRepo = fakeCategoryRepo(null);

    const result = await updateSale(
      "user-1",
      "sale-1",
      { unitPrices: [12000], currency: "COP" },
      saleRepo,
      movementRepo,
      creditRepo,
      accountRepo,
      categoryRepo,
      fakeUow(),
    );

    expect(result.total).toBe(12000);
    // The credit OWNS the full debt: new principal = NEW total (the upfront
    // is abono #1, NOT deducted again). Pending = 12000 − 2000 = 10000.
    expect(creditRepo.updated).toHaveLength(1);
    expect(creditRepo.updated[0].principal.amount).toBe(12000);
    expect(creditRepo.updated[0].version).toBe(credit.version + 1);
    // RCA 2026-10-19: a SALE-BORN credit has NO principal movement by design
    // (create-sale R5-D0b) — the cascade updates the aggregate ONLY.
    expect(movementRepo.updated).toHaveLength(0);
  });

  it("FOUNDER REPRO (2026-10-19): venta renegociada 25.000→20.000 con pago inicial 20.000 → pendiente 0, sin error", async () => {
    // Merlenisa: servicio registrado en 25.000 a crédito; el cliente pagó
    // 20.000 (pago inicial = abono #1 del crédito) y el precio final quedó en
    // 20.000. Editar la venta a 20.000 debe bajar el crédito a 20.000 y dejar
    // el pendiente en 0 — el abono (caja real) queda intacto.
    const sale = makeSale({
      paymentMode: "on-credit",
      items: [
        {
          itemId: "item-1",
          quantity: 1,
          stockQuantity: 1,
          unit: "unit",
          unitPrice: new Money(25000, "COP"),
        },
      ],
    });
    const credit = makeCredit({ principal: new Money(25000, "COP") }, [
      {
        id: "ab-1",
        amount: new Money(20000, "COP"),
        date: new Date("2025-10-16"),
        accountId: "acc-1",
      },
    ]);
    const saleRepo = fakeSaleRepo(sale);
    const movementRepo = fakeMovementRepo([]);
    const creditRepo = fakeCreditRepo([credit]);
    const accountRepo = fakeAccountRepo([makeAccount()]);
    const categoryRepo = fakeCategoryRepo(null);

    const result = await updateSale(
      "user-1",
      "sale-1",
      { unitPrices: [20000], currency: "COP" },
      saleRepo,
      movementRepo,
      creditRepo,
      accountRepo,
      categoryRepo,
      fakeUow(),
    );

    // Venta corregida al precio real.
    expect(result.total).toBe(20000);
    // El crédito baja CON la venta: principal 20.000 → con el abono de 20.000
    // queda PAGADO EN SU TOTALIDAD (pendiente 0) — sin saldo fantasma.
    expect(creditRepo.updated).toHaveLength(1);
    expect(creditRepo.updated[0].principal.amount).toBe(20000);
    expect(creditRepo.updated[0].pending).toBe(0);
    // Ningún movimiento cambia: el abono es caja real (intacto) y el crédito
    // sale-born no tiene movimiento principal que espejar (R5-D0b).
    expect(movementRepo.updated).toHaveLength(0);
  });

  it("rejects when the new total cannot cover what the credit already collected", async () => {
    const sale = makeSale({ paymentMode: "on-credit" });
    // NEW model: principal 10000 = total; collected Σ abonos = 2000 + 3000.
    const credit = makeCredit({ principal: new Money(10000, "COP") }, [
      {
        id: "ab-1",
        amount: new Money(2000, "COP"),
        date: new Date("2025-06-01"),
        accountId: "acc-1",
      },
      {
        id: "ab-2",
        amount: new Money(3000, "COP"),
        date: new Date("2025-06-02"),
        accountId: "acc-1",
      },
    ]);
    const principalMovement = makeMovement({
      id: "mov-principal",
      type: "expense",
      amount: new Money(10000, "COP"),
      context: "Business",
      link: { kind: "creditGrantedPrincipal", refId: "cg-1", opId: "op-2" },
    });

    await expect(
      updateSale(
        "user-1",
        "sale-1",
        { unitPrices: [4000], currency: "COP" }, // newPrincipal 4000 < 5000
        fakeSaleRepo(sale),
        fakeMovementRepo([principalMovement]),
        fakeCreditRepo([credit]),
        fakeAccountRepo([makeAccount()]),
        fakeCategoryRepo(null),
        fakeUow(),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects a written-off linked credit", async () => {
    const sale = makeSale({ paymentMode: "on-credit" });
    const credit = makeCredit({
      writtenOff: { date: new Date("2025-06-05"), movementId: "mov-wo" },
    });

    await expect(
      updateSale(
        "user-1",
        "sale-1",
        { unitPrices: [12000], currency: "COP" },
        fakeSaleRepo(sale),
        fakeMovementRepo([]),
        fakeCreditRepo([credit]),
        fakeAccountRepo([makeAccount()]),
        fakeCategoryRepo(null),
        fakeUow(),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects a deleted sale", async () => {
    const sale = makeSale({ deletedAt: new Date("2025-06-03") });

    await expect(
      updateSale(
        "user-1",
        "sale-1",
        { unitPrices: [12000], currency: "COP" },
        fakeSaleRepo(sale),
        fakeMovementRepo([]),
        fakeCreditRepo([]),
        fakeAccountRepo([makeAccount()]),
        fakeCategoryRepo(null),
        fakeUow(),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects a stale client version (CAS guard on the version the modal read)", async () => {
    const sale = makeSale();

    await expect(
      updateSale(
        "user-1",
        "sale-1",
        { unitPrices: [12000], currency: "COP", version: 99 },
        fakeSaleRepo(sale),
        fakeMovementRepo([makeMovement()]),
        fakeCreditRepo([]),
        fakeAccountRepo([makeAccount()]),
        fakeCategoryRepo(makeUserCategory()),
        fakeUow(),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects a currency mismatch (ACC-1)", async () => {
    const sale = makeSale();

    await expect(
      updateSale(
        "user-1",
        "sale-1",
        { unitPrices: [12000], currency: "USD" },
        fakeSaleRepo(sale),
        fakeMovementRepo([]),
        fakeCreditRepo([]),
        fakeAccountRepo([makeAccount()]),
        fakeCategoryRepo(null),
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a unitPrices length mismatch and non-positive prices", async () => {
    const sale = makeSale();
    const deps = (): [
      SaleRepository,
      MovementRepository,
      CreditGrantedRepository,
      AccountRepository,
      CategoryRepository,
      UnitOfWork,
    ] => [
      fakeSaleRepo(sale),
      fakeMovementRepo([]),
      fakeCreditRepo([]),
      fakeAccountRepo([makeAccount()]),
      fakeCategoryRepo(null),
      fakeUow(),
    ];

    await expect(
      updateSale("user-1", "sale-1", { unitPrices: [1, 2], currency: "COP" }, ...deps()),
    ).rejects.toThrow(ValidationError);
    await expect(
      updateSale("user-1", "sale-1", { unitPrices: [0], currency: "COP" }, ...deps()),
    ).rejects.toThrow(ValidationError);
  });

  it("legacy embedded-abono sale (no credit): new total can never drop below collected", async () => {
    const sale = makeSale({ paymentMode: "on-credit" }, [
      {
        id: "ab-1",
        amount: new Money(3000, "COP"),
        date: new Date("2025-06-02"),
        accountId: "acc-1",
      },
    ]);

    await expect(
      updateSale(
        "user-1",
        "sale-1",
        { unitPrices: [2000], currency: "COP" },
        fakeSaleRepo(sale),
        fakeMovementRepo([]),
        fakeCreditRepo([]),
        fakeAccountRepo([makeAccount()]),
        fakeCategoryRepo(null),
        fakeUow(),
      ),
    ).rejects.toThrow(ConflictError);
  });
});
