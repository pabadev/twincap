import { describe, expect, it, vi } from "vitest";
import { receiveInventoryReceipt } from "./receive-inventory-receipt";
import { Account } from "../../domain/account";
import { CatalogItem } from "../../domain/catalog";
import { Money } from "../../domain/money";
import type {
  AccountRepository,
  CatalogItemRepository,
  InventoryReceiptRepository,
  MovementRepository,
  PayableRepository,
} from "../../domain/repositories";
import type { UnitOfWork } from "../ports";
import type { TransactionHandle } from "../../domain/transaction";

function setup(initialPayment = 0) {
  const tx = {} as TransactionHandle;
  const item = new CatalogItem({
    id: "item-1",
    workspaceId: "workspace-1",
    name: "Esencia",
    type: "product",
    saleUnit: "g",
    stock: 0,
    unitPrice: new Money(100, "COP"),
    createdAt: new Date(),
  });
  const account = new Account({
    id: "account-1",
    workspaceId: "workspace-1",
    name: "Caja negocio",
    currency: "COP",
    isFixed: false,
    createdAt: new Date(),
  });
  const catalogRepo = {
    findById: vi.fn().mockResolvedValue(item),
    receiveStock: vi.fn().mockResolvedValue(true),
  } as unknown as CatalogItemRepository;
  const receiptRepo = {
    create: vi.fn(async (receipt) => receipt),
  } as unknown as InventoryReceiptRepository;
  const payableRepo = { create: vi.fn(async (payable) => payable) } as unknown as PayableRepository;
  const movementRepo = {
    create: vi.fn(async (movement) => movement),
  } as unknown as MovementRepository;
  const accountRepo = {
    findById: vi.fn().mockResolvedValue(account),
    touch: vi.fn().mockResolvedValue(true),
  } as unknown as AccountRepository;
  const uow = {
    withTransaction: vi.fn(async <T>(fn: (handle: TransactionHandle) => Promise<T>) => fn(tx)),
  } as unknown as UnitOfWork;
  const ids = {
    generate: vi
      .fn()
      .mockReturnValueOnce("receipt-1")
      .mockReturnValueOnce("payable-1")
      .mockReturnValue("movement-1"),
  };
  const input = {
    lines: [
      { itemId: "item-1", quantity: 2, unit: "g" as const, lineAmount: 1_000 },
      { itemId: "item-1", quantity: 3, unit: "g" as const, lineAmount: 1_500 },
    ],
    currency: "COP" as const,
    supplierName: "Proveedor",
    date: new Date("2026-09-28T12:00:00.000Z"),
    accountId: "account-1",
    initialPayment,
  };
  return { tx, catalogRepo, receiptRepo, payableRepo, movementRepo, accountRepo, uow, ids, input };
}

describe("receiveInventoryReceipt", () => {
  it("records multiple received lines and a Business payable without an expense before payment", async () => {
    const deps = setup();
    const receipt = await receiveInventoryReceipt(
      "workspace-1",
      deps.input,
      { ...deps, ids: deps.ids },
      "user-1",
    );

    expect(receipt.lines).toHaveLength(2);
    expect(receipt.total.amount).toBe(2_500);
    expect(deps.catalogRepo.receiveStock).toHaveBeenCalledTimes(2);
    expect(deps.payableRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ context: "Business", initialPayment: 0 }),
      deps.tx,
    );
    expect(deps.movementRepo.create).not.toHaveBeenCalled();
    expect(deps.receiptRepo.create).toHaveBeenCalledWith(receipt, deps.tx);
    expect(vi.mocked(deps.accountRepo.touch).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(deps.receiptRepo.create).mock.invocationCallOrder[0],
    );
  });

  it("creates exactly one Business expense for the actual initial payment", async () => {
    const deps = setup(500);
    const receipt = await receiveInventoryReceipt("workspace-1", deps.input, deps, "user-1");

    expect(receipt.initialPayment).toBe(500);
    expect(deps.movementRepo.create).toHaveBeenCalledTimes(1);
    expect(deps.movementRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "Business",
        amount: expect.objectContaining({ amount: 500 }),
      }),
      deps.tx,
    );
  });

  it("requires a supplier when any receipt balance will remain unpaid", async () => {
    const deps = setup(500);
    deps.input.supplierName = "   ";

    await expect(
      receiveInventoryReceipt("workspace-1", deps.input, deps, "user-1"),
    ).rejects.toThrow("Supplier is required when a receipt has an outstanding balance");
    expect(deps.uow.withTransaction).not.toHaveBeenCalled();
  });

  it("does not create a payable when the receipt is fully paid now", async () => {
    const deps = setup(2_500);
    deps.input.supplierName = "";

    const receipt = await receiveInventoryReceipt("workspace-1", deps.input, deps, "user-1");

    expect(receipt.supplierName).toBeUndefined();
    expect(receipt.payableId).toBeUndefined();
    expect(deps.payableRepo.create).not.toHaveBeenCalled();
    expect(deps.movementRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "Business",
        link: expect.objectContaining({
          kind: "inventoryReceiptPayment",
          refId: "account-1",
          receiptId: "receipt-1",
        }),
        amount: expect.objectContaining({ amount: 2_500 }),
      }),
      deps.tx,
    );
  });

  it("aborts the transaction when any stock line cannot be received", async () => {
    const deps = setup();
    vi.mocked(deps.catalogRepo.receiveStock!)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(
      receiveInventoryReceipt("workspace-1", deps.input, deps, "user-1"),
    ).rejects.toThrow("Could not add received stock");
    expect(deps.receiptRepo.create).not.toHaveBeenCalled();
  });
});
