import { describe, it, expect } from "vitest";
import {
  findIncompleteTransfers,
  findOrphanMovements,
  findPendingStockRestores,
  executeReconcile,
  type ReconcileAction,
} from "./reconcile";
import type {
  TransferRepository,
  MovementRepository,
  CreditReceivedRepository,
  CreditGrantedRepository,
  SaleRepository,
  AccountRepository,
  PayableRepository,
} from "../../core/domain/repositories";
import type { Transfer } from "../../core/domain/transfer";
import type { Movement } from "../../core/domain/movement";
import type { CreditReceived } from "../../core/domain/credit-received";
import type { CreditGranted } from "../../core/domain/credit-granted";
import type { Sale } from "../../core/domain/sale";
import type { Account } from "../../core/domain/account";
import type { Payable } from "../../core/domain/payable";

// ─── Fake repositories ──────────────────────────────────────────────

function fakeTransferRepo(transfers: Transfer[]): TransferRepository {
  return {
    findById: async () => null,
    findByWorkspaceId: async () => transfers,
    create: async (t) => t,
    update: async (t) => t,
    delete: async () => {},
    findByIdRaw: async () => null,
  };
}

function fakeMovementRepo(movements: Movement[]): MovementRepository {
  return {
    findById: async () => null,
    findByWorkspaceId: async () => movements,
    findByAccountId: async () => [],
    findByAccountIdForBalance: async () => [],
    create: async (m) => m,
    update: async (m) => m,
    delete: async () => {},
    deleteByRefId: async () => 0,
    countByCategoryId: async () => 0,
    findPaged: async () => ({ items: [], nextCursor: null }),
    findByWorkspaceIdAndDateRange: async () => [],
    findByWorkspaceIdForBalance: async () => [],
  };
}

function fakeCreditReceivedRepo(
  credits: CreditReceived[],
): CreditReceivedRepository {
  return {
    findById: async () => null,
    findByWorkspaceId: async () => credits,
    create: async (c) => c,
    update: async (c) => c,
    delete: async () => {},
    addAbono: async () => {},
    editAbono: async () => {},
    deleteAbono: async () => {},
  };
}

function fakeCreditGrantedRepo(
  credits: CreditGranted[],
): CreditGrantedRepository {
  return {
    findById: async () => null,
    findByWorkspaceId: async () => credits,
    create: async (c) => c,
    update: async (c) => c,
    delete: async () => {},
    addAbono: async () => {},
    editAbono: async () => {},
    deleteAbono: async () => {},
    markWrittenOff: async () => {},
  };
}

function fakeSaleRepo(sales: Sale[]): SaleRepository {
  return {
    findById: async () => null,
    findByWorkspaceId: async () => sales,
    create: async (s) => s,
    update: async (s) => s,
    delete: async () => {},
    addAbono: async () => {},
    editAbono: async () => {},
    deleteAbono: async () => {},
  };
}

function fakeAccountRepo(accounts: Account[]): AccountRepository {
  return {
    findById: async () => null,
    findByWorkspaceId: async () => accounts,
    create: async (a) => a,
    update: async (a) => a,
    delete: async () => {},
    touch: async () => true,
    bumpVersion: async () => true,
    countReferences: async () => 0,
  };
}

function fakePayableRepo(payables: Payable[]): PayableRepository {
  return {
    findById: async () => null,
    findByWorkspaceId: async () => payables,
    create: async (p) => p,
    update: async (p) => p,
    delete: async () => {},
    addAbono: async () => {},
    editAbono: async () => {},
    deleteAbono: async () => {},
  };
}

// ─── Helpers to build domain entities without Mongoose ───────────────

function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: "t1",
    workspaceId: "u1",
    sourceAccountId: "acc1",
    destinationAccountId: "acc2",
    sourceAmount: { amount: 10000, currency: "COP" } as Transfer["sourceAmount"],
    destinationAmount: {
      amount: 10000,
      currency: "COP",
    } as Transfer["destinationAmount"],
    sourceCurrency: "COP",
    destinationCurrency: "COP",
    date: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as Transfer;
}

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "m1",
    workspaceId: "u1",
    accountId: "acc1",
    categoryId: "cat1",
    type: "expense",
    amount: { amount: 10000, currency: "COP" } as Movement["amount"],
    signedAmount: -10000,
    date: new Date("2026-01-01"),
    context: "Personal",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as Movement;
}

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s1",
    workspaceId: "u1",
    items: [
      {
        itemId: "item1",
        quantity: 1,
        unitPrice: { amount: 50000, currency: "COP" } as Sale["items"][number]["unitPrice"],
        subtotal: 50000,
      },
    ],
    date: new Date("2026-01-01"),
    paymentMode: "paid-in-full",
    accountId: "acc1",
    total: 50000, // Sale.total is minor units (number), not Money
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as Sale;
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc1",
    workspaceId: "u1",
    name: "Test Account",
    currency: "COP",
    isFixed: false,
    version: 0,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as Account;
}

function makeCreditGranted(overrides: Partial<CreditGranted> = {}): CreditGranted {
  return {
    id: "cg1",
    workspaceId: "u1",
    accountId: "acc1",
    personName: "Test Credit",
    principal: { amount: 100000, currency: "COP" },
    totalToPay: { amount: 100000, currency: "COP" },
    pending: 100000,
    interestRate: 0,
    date: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as unknown as CreditGranted;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("reconcile", () => {
  describe("findIncompleteTransfers", () => {
    it("flags transfer with missing movementIds", async () => {
      const transfer = makeTransfer({ id: "t1" });
      // movementIds is undefined (not set)
      const repo = fakeTransferRepo([transfer]);
      const actions = await findIncompleteTransfers(repo, "u1");

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("complete_parent");
      expect(actions[0].entity).toBe("Transfer");
      expect(actions[0].entityId).toBe("t1");
    });

    it("flags transfer with partial movementIds (only expenseId)", async () => {
      const transfer = makeTransfer({
        id: "t2",
        movementIds: { expenseId: "m1" },
      } as Partial<Transfer>);
      const repo = fakeTransferRepo([transfer]);
      const actions = await findIncompleteTransfers(repo, "u1");

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("complete_parent");
    });

    it("returns empty when all transfers have complete movementIds", async () => {
      const transfer = makeTransfer({
        id: "t3",
        movementIds: { expenseId: "m1", incomeId: "m2" },
      } as Partial<Transfer>);
      const repo = fakeTransferRepo([transfer]);
      const actions = await findIncompleteTransfers(repo, "u1");

      expect(actions).toHaveLength(0);
    });
  });

  describe("findOrphanMovements", () => {
    it("flags movement whose transfer parent was deleted", async () => {
      const movement = makeMovement({
        id: "m1",
        link: { kind: "transfer", refId: "t_deleted", opId: "op1" },
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("delete_orphan");
      expect(actions[0].entity).toBe("Movement");
      expect(actions[0].entityId).toBe("m1");
    });

    it("flags movement whose sale parent was deleted", async () => {
      const movement = makeMovement({
        id: "m2",
        link: { kind: "salePayment", refId: "s_deleted", opId: "op2" },
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("delete_orphan");
      expect(actions[0].details).toEqual(
        expect.objectContaining({
          link: expect.objectContaining({ kind: "salePayment" }),
        }),
      );
    });

    it("returns empty when all linked parents exist", async () => {
      const movement = makeMovement({
        id: "m3",
        link: { kind: "transfer", refId: "t1", opId: "op3" },
      });
      const transfer = makeTransfer({ id: "t1" });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([transfer]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(0);
    });

    it("skips movements without a link", async () => {
      const movement = makeMovement({ id: "m4", link: undefined });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(0);
    });

    it("flags opening movement when account parent is deleted", async () => {
      const movement = makeMovement({
        id: "m5",
        link: { kind: "opening", refId: "acc_deleted", opId: "op5" },
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].details).toEqual(
        expect.objectContaining({
          link: expect.objectContaining({ kind: "opening" }),
        }),
      );
    });

    it("keeps opening movement when account parent exists", async () => {
      const movement = makeMovement({
        id: "m6",
        link: { kind: "opening", refId: "acc1", opId: "op6" },
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([makeAccount({ id: "acc1" })]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(0);
    });

    it("flags payableInitialPayment when payable parent is deleted", async () => {
      const movement = makeMovement({
        id: "m7",
        link: { kind: "payableInitialPayment", refId: "pay_deleted", opId: "op7" },
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].details).toEqual(
        expect.objectContaining({
          link: expect.objectContaining({ kind: "payableInitialPayment" }),
        }),
      );
    });

    it("flags creditGrantedAbonoInterest when credit parent is deleted", async () => {
      const movement = makeMovement({
        id: "m8",
        link: { kind: "creditGrantedAbonoInterest", refId: "cg_deleted", opId: "op8" },
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].details).toEqual(
        expect.objectContaining({
          link: expect.objectContaining({ kind: "creditGrantedAbonoInterest" }),
        }),
      );
    });

    it("flags creditGrantedWriteOff when credit parent is deleted", async () => {
      const movement = makeMovement({
        id: "m9",
        link: { kind: "creditGrantedWriteOff", refId: "cg_deleted2", opId: "op9" },
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].details).toEqual(
        expect.objectContaining({
          link: expect.objectContaining({ kind: "creditGrantedWriteOff" }),
        }),
      );
    });

    it("keeps creditGrantedAbonoInterest when credit parent exists", async () => {
      const movement = makeMovement({
        id: "m10",
        link: { kind: "creditGrantedAbonoInterest", refId: "cg1", opId: "op10" },
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([makeCreditGranted({ id: "cg1" })]);
      const saleRepo = fakeSaleRepo([]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(0);
    });

    // R15.1 6d — legacy value-based reconciliation must mirror the read path:
    // a legacy UUID refId that fails the id lookup is reconciled by
    // (accountId + business-date key + mirror amount). Modern movements
    // (created at/after the R15.1 cutoff) are STRICT: unmatched id → orphan.
    it("reconciles a legacy salePayment with a matching live sale by value", async () => {
      const movement = makeMovement({
        id: "m11",
        link: { kind: "salePayment", refId: "legacy-uuid-sale-1", opId: "op11" },
        createdAt: new Date("2026-01-01"), // legacy: before the R15.1 cutoff
        amount: { amount: 50000, currency: "COP" } as Movement["amount"],
        signedAmount: -50000,
      });
      const sale = makeSale({
        id: "s1",
        accountId: "acc1",
        date: new Date("2026-01-01"),
        total: 50000, // Sale.total is minor units (number), not Money
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([sale]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      // Value reconciliation found exactly one candidate → the movement is live.
      expect(actions).toHaveLength(0);
    });

    it("treats an AMBIGUOUS legacy salePayment as live (value matches 2 sales)", async () => {
      const movement = makeMovement({
        id: "m12",
        link: { kind: "salePayment", refId: "legacy-uuid-sale-2", opId: "op12" },
        createdAt: new Date("2026-01-01"),
        amount: { amount: 50000, currency: "COP" } as Movement["amount"],
        signedAmount: -50000,
      });
      const saleA = makeSale({
        id: "s-a",
        accountId: "acc1",
        date: new Date("2026-01-01"),
        total: 50000, // Sale.total is minor units (number), not Money
      });
      const saleB = makeSale({
        id: "s-b",
        accountId: "acc1",
        date: new Date("2026-01-01"),
        total: 50000, // Sale.total is minor units (number), not Money
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([saleA, saleB]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      // Ambiguous → still included (flagged for manual review in the read
      // filter, but never treated as an orphan).
      expect(actions).toHaveLength(0);
    });

    it("flags a legacy salePayment whose value matches NO live sale", async () => {
      const movement = makeMovement({
        id: "m13",
        link: { kind: "salePayment", refId: "legacy-uuid-sale-3", opId: "op13" },
        createdAt: new Date("2026-01-01"),
        amount: { amount: 50000, currency: "COP" } as Movement["amount"],
        signedAmount: -50000,
      });
      const sale = makeSale({
        id: "s1",
        accountId: "acc1",
        date: new Date("2026-01-01"),
        total: 99999, // amount mismatch
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([sale]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].entityId).toBe("m13");
    });

    it("flags a MODERN salePayment with unmatched refId even when the value matches", async () => {
      const movement = makeMovement({
        id: "m14",
        link: { kind: "salePayment", refId: "modern-unmatched", opId: "op14" },
        createdAt: new Date("2026-09-10"), // modern: at/after the R15.1 cutoff
        amount: { amount: 50000, currency: "COP" } as Movement["amount"],
        signedAmount: -50000,
      });
      const sale = makeSale({
        id: "s1",
        accountId: "acc1",
        date: new Date("2026-01-01"),
        total: 50000, // Sale.total is minor units (number), not Money
      });
      const movementRepo = fakeMovementRepo([movement]);
      const transferRepo = fakeTransferRepo([]);
      const creditReceivedRepo = fakeCreditReceivedRepo([]);
      const creditGrantedRepo = fakeCreditGrantedRepo([]);
      const saleRepo = fakeSaleRepo([sale]);
      const accountRepo = fakeAccountRepo([]);
      const payableRepo = fakePayableRepo([]);

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        accountRepo,
        payableRepo,
        "u1",
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].entityId).toBe("m14");
    });
  });

  describe("findPendingStockRestores", () => {
    it("flags sale with deletedAt but stockRestored=false", async () => {
      const sale = makeSale({
        id: "s1",
        deletedAt: new Date("2026-01-01"),
        stockRestored: false,
      } as Partial<Sale>);
      const repo = fakeSaleRepo([sale]);
      const actions = await findPendingStockRestores(repo, "u1");

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("restore_stock");
      expect(actions[0].entity).toBe("Sale");
      expect(actions[0].entityId).toBe("s1");
    });

    it("does not flag sale with deletedAt and stockRestored=true", async () => {
      const sale = makeSale({
        id: "s2",
        deletedAt: new Date("2026-01-01"),
        stockRestored: true,
      } as Partial<Sale>);
      const repo = fakeSaleRepo([sale]);
      const actions = await findPendingStockRestores(repo, "u1");

      expect(actions).toHaveLength(0);
    });

    it("returns empty when no issues", async () => {
      const sale = makeSale({ id: "s3" });
      const repo = fakeSaleRepo([sale]);
      const actions = await findPendingStockRestores(repo, "u1");

      expect(actions).toHaveLength(0);
    });
  });

  describe("executeReconcile", () => {
    it("dryRun returns actions without applying", async () => {
      const actions: ReconcileAction[] = [
        {
          type: "flag",
          description: "test action",
          entity: "Test",
          entityId: "1",
        },
      ];
      const result = await executeReconcile(actions, true);

      expect(result.dryRun).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.applied).toBe(0);
    });

    it("non-dryRun returns result (apply phase placeholder)", async () => {
      const actions: ReconcileAction[] = [
        {
          type: "flag",
          description: "test action",
          entity: "Test",
          entityId: "1",
        },
      ];
      const result = await executeReconcile(actions, false);

      expect(result.dryRun).toBe(false);
      expect(result.actions).toHaveLength(1);
      // Apply phase is currently a no-op placeholder
      expect(result.applied).toBe(0);
    });
  });
});
