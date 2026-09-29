import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../domain/errors";
import type { InventoryReceiptRepository } from "../../domain/repositories";
import { listInventoryReceiptsPage } from "./list-inventory-receipts-page";

function receiptRepo(
  findPage: InventoryReceiptRepository["findPage"] = vi
    .fn()
    .mockResolvedValue({ items: [], total: 0 }),
): InventoryReceiptRepository {
  return { findById: vi.fn(), findByWorkspaceId: vi.fn(), create: vi.fn(), findPage };
}

describe("listInventoryReceiptsPage", () => {
  it("normalizes the search and converts civil date bounds to an exclusive upper bound", async () => {
    const findPage = vi.fn().mockResolvedValue({ items: [], total: 0 });

    await listInventoryReceiptsPage(
      "workspace-1",
      { page: 2, search: "  Supplier  ", dateFrom: "2026-09-01", dateTo: "2026-09-30" },
      receiptRepo(findPage),
    );

    expect(findPage).toHaveBeenCalledWith("workspace-1", {
      page: 2,
      pageSize: 20,
      search: "Supplier",
      dateFrom: new Date("2026-09-01T00:00:00.000Z"),
      dateToExclusive: new Date("2026-10-01T00:00:00.000Z"),
    });
  });

  it("clamps a page beyond the filtered result range", async () => {
    const findPage = vi.fn().mockResolvedValue({ items: [], total: 21 });

    const result = await listInventoryReceiptsPage(
      "workspace-1",
      { page: 9 },
      receiptRepo(findPage),
    );

    expect(result.page).toBe(2);
    expect(findPage).toHaveBeenLastCalledWith("workspace-1", {
      page: 2,
      pageSize: 20,
      search: undefined,
      dateFrom: undefined,
      dateToExclusive: undefined,
    });
  });

  it("rejects invalid or reversed date ranges", async () => {
    const repo = receiptRepo();
    await expect(
      listInventoryReceiptsPage("workspace-1", { page: 1, dateFrom: "2026-02-30" }, repo),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      listInventoryReceiptsPage(
        "workspace-1",
        { page: 1, dateFrom: "2026-10-02", dateTo: "2026-10-01" },
        repo,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.findPage).not.toHaveBeenCalled();
  });
});
