import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  connectDb: vi.fn(),
  revalidatePath: vi.fn(),
  claimIdempotency: vi.fn(),
  releaseIdempotency: vi.fn(),
  receiveInventoryReceipt: vi.fn(),
  withAudit: vi.fn(),
  MongoCatalogItemRepository: vi.fn(),
  MongoSaleRepository: vi.fn(),
  MongoPayableRepository: vi.fn(),
  MongoMovementRepository: vi.fn(),
  MongoInventoryReceiptRepository: vi.fn(),
  MongoAccountRepository: vi.fn(),
  MongoOperationLogger: vi.fn(),
  MongoUnitOfWork: vi.fn(),
}));

vi.mock("../../../../infrastructure/auth/getCurrentUser", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("../../../../infrastructure/db/connection", () => ({ connectDb: mocks.connectDb }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../../infrastructure/auth/idempotency", () => ({
  claimIdempotency: mocks.claimIdempotency,
  releaseIdempotency: mocks.releaseIdempotency,
}));
vi.mock("../../../../core/application/inventory/receive-inventory-receipt", () => ({
  receiveInventoryReceipt: mocks.receiveInventoryReceipt,
}));
vi.mock("../../../../infrastructure/repositories/catalog-repository", () => ({
  MongoCatalogItemRepository: mocks.MongoCatalogItemRepository,
}));
vi.mock("../../../../infrastructure/repositories/sale-repository", () => ({
  MongoSaleRepository: mocks.MongoSaleRepository,
}));
vi.mock("../../../../infrastructure/repositories/payable-repository", () => ({
  MongoPayableRepository: mocks.MongoPayableRepository,
}));
vi.mock("../../../../infrastructure/repositories/movement-repository", () => ({
  MongoMovementRepository: mocks.MongoMovementRepository,
}));
vi.mock("../../../../infrastructure/repositories/inventory-receipt-repository", () => ({
  MongoInventoryReceiptRepository: mocks.MongoInventoryReceiptRepository,
}));
vi.mock("../../../../infrastructure/repositories/account-repository", () => ({
  MongoAccountRepository: mocks.MongoAccountRepository,
}));
vi.mock("../../../../infrastructure/repositories/operation-log-repository", () => ({
  MongoOperationLogger: mocks.MongoOperationLogger,
}));
vi.mock("../../../../infrastructure/transactions/mongo-unit-of-work", () => ({
  MongoUnitOfWork: mocks.MongoUnitOfWork,
}));
vi.mock("../../../../lib/with-audit", () => ({ withAudit: mocks.withAudit }));

const { receiveInventoryReceiptAction } = await import("./actions");

function formData(idempotencyKey = "receipt-key-1") {
  const data = new FormData();
  data.set("accountId", "account-1");
  data.set("supplierName", "Supplier");
  data.set("reference", "INV-1");
  data.set("date", "2026-09-28");
  data.set("initialPayment", "0");
  data.set(
    "lines",
    JSON.stringify([{ itemId: "item-1", quantity: 1, unit: "unit", amount: "15000" }]),
  );
  if (idempotencyKey) data.set("idempotencyKey", idempotencyKey);
  return data;
}

describe("receiveInventoryReceiptAction idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "workspace-1" });
    mocks.connectDb.mockResolvedValue(undefined);
    mocks.claimIdempotency.mockResolvedValue(true);
    mocks.releaseIdempotency.mockResolvedValue(undefined);
    mocks.receiveInventoryReceipt.mockResolvedValue({});
    mocks.MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue({ currency: "COP" }),
    }));
    mocks.withAudit.mockImplementation(async (_logger, _options, operation) => operation());
    mocks.MongoOperationLogger.mockImplementation(() => ({
      log: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it("requires an idempotency key before database access", async () => {
    const result = await receiveInventoryReceiptAction(null, formData(""));

    expect(result).toEqual({ error: "error.idempotencyKeyRequired" });
    expect(mocks.connectDb).not.toHaveBeenCalled();
    expect(mocks.receiveInventoryReceipt).not.toHaveBeenCalled();
  });

  it("does not repeat the stock or financial mutation for a duplicate key", async () => {
    mocks.claimIdempotency.mockResolvedValue(false);

    const result = await receiveInventoryReceiptAction(null, formData());

    expect(result).toEqual({ error: "error.duplicateRequest" });
    expect(mocks.receiveInventoryReceipt).not.toHaveBeenCalled();
    expect(mocks.releaseIdempotency).not.toHaveBeenCalled();
  });

  it("derives the receipt currency from the selected workspace account", async () => {
    const data = formData();
    data.set("currency", "USD");

    await receiveInventoryReceiptAction(null, data);

    expect(mocks.receiveInventoryReceipt).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({ currency: "COP", accountId: "account-1" }),
      expect.any(Object),
      "user-1",
    );
  });

  it("releases a claimed key when the transaction fails so the user can retry", async () => {
    mocks.receiveInventoryReceipt.mockRejectedValue(new Error("transaction failed"));

    await receiveInventoryReceiptAction(null, formData());

    expect(mocks.claimIdempotency).toHaveBeenCalledWith(
      "user-1",
      "receipt-key-1",
      "receiveInventoryReceipt",
    );
    expect(mocks.releaseIdempotency).toHaveBeenCalledWith(
      "user-1",
      "receipt-key-1",
      "receiveInventoryReceipt",
    );
  });
});
