import { describe, expect, it } from "vitest";
import { categorySectionSurface } from "./category-section-style";

describe("category section surfaces", () => {
  it("uses a subtle green surface for income in both themes", () => {
    const classes = categorySectionSurface("income");
    expect(classes).toContain("bg-emerald-50/85");
    expect(classes).toContain("dark:bg-emerald-950/20");
    expect(classes).not.toContain("rose");
  });

  it("uses a subtle red surface for expenses in both themes", () => {
    const classes = categorySectionSurface("expense");
    expect(classes).toContain("bg-rose-50/75");
    expect(classes).toContain("dark:bg-rose-950/15");
    expect(classes).not.toContain("emerald");
  });
});
