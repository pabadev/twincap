import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LIST_FILES = [
  "src/app/(main)/movements/movements-list.tsx",
  "src/app/(main)/transfers/transfers-list.tsx",
  "src/app/(main)/clients/clients-list.tsx",
  "src/app/(main)/accounts/page.tsx",
  "src/app/(main)/categories/page.tsx",
];

for (const file of LIST_FILES) {
  describe(`responsive card variant in ${file}`, () => {
    const source = readFileSync(resolve(process.cwd(), file), "utf-8");

    it("hides the table shell below sm (max-sm:hidden on TableShell)", () => {
      expect(source).toContain('<TableShell className="max-sm:hidden">');
    });

    it("renders the card variant on mobile (sm:hidden container)", () => {
      expect(source).toContain("sm:hidden");
      expect(source).toContain("space-y-3");
    });

    it("uses the shared MovementCard component", () => {
      expect(source).toContain("MovementCard");
    });
  });
}

describe("desktop table markup byte-identity (RCL-2)", () => {
  it("does not wrap the table internals in new responsive classes", () => {
    const files = LIST_FILES.map((f) => readFileSync(resolve(process.cwd(), f), "utf-8"));
    for (const source of files) {
      // Only the TableShell className may carry the mobile-hide utility; the
      // inner table must keep its plain layout classes (min-w keeps horizontal
      // scroll on old wide tables, the shell handles overflow).
      expect(source).not.toMatch(/<Table(?!Shell)[^>]*max-sm:hidden/);
      expect(source).not.toMatch(/<TBody[^>]*sm:hidden/);
      expect(source).not.toMatch(/<Td[^>]*sm:hidden/);
    }
  });
});
