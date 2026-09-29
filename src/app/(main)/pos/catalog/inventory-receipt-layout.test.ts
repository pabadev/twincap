import { describe, expect, it } from "vitest";
import {
  RECEIPT_LINE_DESKTOP_HEADER_CLASSES,
  RECEIPT_LINE_GRID_CLASSES,
  RECEIPT_LINE_ITEM_CELL_CLASSES,
  RECEIPT_LINE_MOBILE_HEADER_CLASSES,
} from "./inventory-receipt-layout";

describe("inventory receipt line layout", () => {
  it("stacks the item selector above compact mobile fields and uses one desktop grid row", () => {
    expect(RECEIPT_LINE_ITEM_CELL_CLASSES).toContain("col-span-4");
    expect(RECEIPT_LINE_ITEM_CELL_CLASSES).toContain("sm:col-span-1");
    expect(RECEIPT_LINE_GRID_CLASSES).toContain("grid-cols-[60px_74px_minmax(82px,1fr)_40px]");
    expect(RECEIPT_LINE_GRID_CLASSES).toContain("gap-1.5");
    expect(RECEIPT_LINE_GRID_CLASSES).toContain(
      "sm:grid-cols-[minmax(0,2fr)_72px_108px_minmax(120px,1fr)_40px]",
    );
  });

  it("shows a single shared column header at each responsive layout", () => {
    expect(RECEIPT_LINE_DESKTOP_HEADER_CLASSES).toContain("hidden");
    expect(RECEIPT_LINE_DESKTOP_HEADER_CLASSES).toContain("sm:grid");
    expect(RECEIPT_LINE_MOBILE_HEADER_CLASSES).toContain("sm:hidden");
  });
});
