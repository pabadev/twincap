import { ValidationError } from "../../domain/errors";
import type { InventoryReceiptRepository } from "../../domain/repositories";
import type { InventoryReceipt } from "../../domain/inventory-receipt";

export const INVENTORY_RECEIPTS_PAGE_SIZE = 20;

export interface ListInventoryReceiptsPageInput {
  page: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ListInventoryReceiptsPageResult {
  items: InventoryReceipt[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function parseCivilDate(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${field} must be a calendar date`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`${field} must be a valid calendar date`);
  }
  return date;
}

export async function listInventoryReceiptsPage(
  workspaceId: string,
  input: ListInventoryReceiptsPageInput,
  receiptRepo: InventoryReceiptRepository,
): Promise<ListInventoryReceiptsPageResult> {
  if (!Number.isSafeInteger(input.page) || input.page < 1 || input.page > 100_000) {
    throw new ValidationError("Inventory receipt page must be a positive integer");
  }
  const dateFrom = parseCivilDate(input.dateFrom, "Start date");
  const dateTo = parseCivilDate(input.dateTo, "End date");
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ValidationError("Start date cannot be after end date");
  }

  const normalizedSearch = input.search?.trim().slice(0, 100) || undefined;
  const pageSize = INVENTORY_RECEIPTS_PAGE_SIZE;
  let result = await receiptRepo.findPage(workspaceId, {
    page: input.page,
    pageSize,
    search: normalizedSearch,
    dateFrom,
    dateToExclusive: dateTo ? new Date(dateTo.getTime() + 86_400_000) : undefined,
  });
  let totalPages = Math.max(1, Math.ceil(result.total / pageSize));
  let page = Math.min(input.page, totalPages);
  if (page !== input.page) {
    result = await receiptRepo.findPage(workspaceId, {
      page,
      pageSize,
      search: normalizedSearch,
      dateFrom,
      dateToExclusive: dateTo ? new Date(dateTo.getTime() + 86_400_000) : undefined,
    });
    totalPages = Math.max(1, Math.ceil(result.total / pageSize));
    page = Math.min(page, totalPages);
  }

  return { ...result, page, pageSize, totalPages };
}
