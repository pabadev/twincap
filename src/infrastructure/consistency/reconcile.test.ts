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
} from "../../core/domain/repositories";
import type { Transfer } from "../../core/domain/transfer";
import type { Movement } from "../../core/domain/movement";
import type { CreditReceived } from "../../core/domain/credit-received";
import type { CreditGranted } from "../../core/domain/credit-granted";
import type { Sale } from "../../core/domain/sale";

// ─── Fake repositories ──────────────────────────────────────────────

function fakeTransferRepo(transfers: Transfer[]): TransferRepository {
  return {
    findById: async () => null,
    findByUserId: async () => transfers,
    create: async (t) => t,
    update: async (t) => t,
    delete: async () => {},
    findByIdRaw: async () => null,
  };
}

function fakeMovementRepo(movements: Movement[]): MovementRepository {
  return {
    findById: async () => null,
    findByUserId: async () => movements,
    findByAccountId: async () => [],
    create: async (m) => m,
    update: async (m) => m,
    delete: async () => {},
    aggregateBalance: async () => 0,
    countByCategoryId: async () => 0,
    findPaged: async () => ({ items: [], nextCursor: null }),
  };
}

function fakeCreditReceivedRepo(
  credits: CreditReceived[],
): CreditReceivedRepository {
  return {
    findById: async () => null,
    findByUserId: async () => credits,
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
    findByUserId: async () => credits,
    create: async (c) => c,
    update: async (c) => c,
    delete: async () => {},
    addAbono: async () => {},
    editAbono: async () => {},
    deleteAbono: async () => {},
  };
}

function fakeSaleRepo(sales: Sale[]): SaleRepository {
  return {
    findById: async () => null,
    findByUserId: async () => sales,
    create: async (s) => s,
    update: async (s) => s,
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
    userId: "u1",
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
    userId: "u1",
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
    userId: "u1",
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
    total: 50000,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as Sale;
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

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
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

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
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

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
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

      const actions = await findOrphanMovements(
        movementRepo,
        transferRepo,
        creditReceivedRepo,
        creditGrantedRepo,
        saleRepo,
        "u1",
      );

      expect(actions).toHaveLength(0);
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
