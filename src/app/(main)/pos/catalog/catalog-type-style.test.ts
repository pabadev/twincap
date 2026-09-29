import { describe, expect, it } from "vitest";
import { catalogTypeBadgeClasses } from "./catalog-type-style";

describe("catalog type badge styles", () => {
  it("distinguishes products in light and dark themes", () => {
    const classes = catalogTypeBadgeClasses("product");
    expect(classes).toContain("bg-blue-50");
    expect(classes).toContain("dark:bg-blue-950/50");
    expect(classes).not.toContain("violet");
  });

  it("distinguishes services in light and dark themes", () => {
    const classes = catalogTypeBadgeClasses("service");
    expect(classes).toContain("bg-violet-50");
    expect(classes).toContain("dark:bg-violet-950/50");
    expect(classes).not.toContain("blue");
  });
});
