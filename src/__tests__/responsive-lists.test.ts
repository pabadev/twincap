import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Product decision 2026-09-21 (docs/Ronda POST-UX.md §19/§20): table views are
// retired on every breakpoint — lists render MovementCard-style cards only,
// and credits/payables cards may arrange in a 2-column grid on PC.

const CARD_LIST_FILES = [
  "src/app/(main)/movements/movements-list.tsx",
  "src/app/(main)/transfers/transfers-list.tsx",
  "src/app/(main)/clients/clients-list.tsx",
  "src/app/(main)/accounts/page.tsx",
  "src/app/(main)/categories/page.tsx",
];

const GRID_LIST_FILES = [
  "src/app/(main)/credits/received/credits-received-list.tsx",
  "src/app/(main)/credits/granted/credits-granted-list.tsx",
  "src/app/(main)/payables/payables-list.tsx",
];

function source(file: string): string {
  return readFileSync(resolve(process.cwd(), file), "utf-8");
}

for (const file of CARD_LIST_FILES) {
  describe(`cards-only list representation in ${file}`, () => {
    const src = source(file);

    it("retires the desktop table variant (no TableShell/THead markup)", () => {
      expect(src).not.toContain("<TableShell");
      expect(src).not.toContain("<THead");
    });

    it("renders cards on every breakpoint (no mobile-only hiding)", () => {
      expect(src).toContain("MovementCard");
      expect(src).not.toContain("space-y-3 sm:hidden");
      expect(src).not.toContain('className="sm:hidden"');
    });
  });
}

for (const file of GRID_LIST_FILES) {
  describe(`cards list with 2-column PC grid in ${file}`, () => {
    const src = source(file);

    it("uses a responsive grid (2 columns on PC)", () => {
      expect(src).toContain("md:grid-cols-2");
    });

    it("does not use a TableShell variant", () => {
      expect(src).not.toContain("<TableShell");
    });
  });
}
