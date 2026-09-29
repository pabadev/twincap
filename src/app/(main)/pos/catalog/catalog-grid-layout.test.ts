import { describe, expect, it } from "vitest";
import { CATALOG_GRID_CLASSES } from "./catalog-grid-layout";

describe("catalog responsive card grid", () => {
  it("uses one column on mobile, two on tablet, and three on desktop", () => {
    expect(CATALOG_GRID_CLASSES).toContain("grid-cols-1");
    expect(CATALOG_GRID_CLASSES).toContain("md:grid-cols-2");
    expect(CATALOG_GRID_CLASSES).toContain("lg:grid-cols-3");
    expect(CATALOG_GRID_CLASSES).toContain("items-stretch");
  });
});
