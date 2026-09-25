import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Product decision 2026-09-21 (docs/Ronda POST-UX.md §19/§20): most lists use
// cards on every breakpoint. Categories use compact rows per the owner decision
// on 2026-09-24: bottom border per row, with actions aligned to the right.

const CARD_LIST_FILES = [
  "src/app/(main)/movements/movements-list.tsx",
  "src/app/(main)/transfers/transfers-list.tsx",
  "src/app/(main)/clients/clients-list.tsx",
  "src/app/(main)/accounts/page.tsx",
];

const CATEGORY_LIST_FILE = "src/app/(main)/categories/page.tsx";

// Beta round 4 (owner decision 2026-09-23 merged in 03e716d context): the
// accounts module adopted the dashboard account-card format (ui Card with
// title/currency/balance), replacing the MovementCard variant. Intent is
// unchanged: cards on every breakpoint, no desktop table.
const CARD_MARKER: Record<string, string> = {
  "src/app/(main)/accounts/page.tsx": "<Card",
};
function cardMarkerFor(file: string): string {
  return CARD_MARKER[file] ?? "MovementCard";
}

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
      expect(src).toContain(cardMarkerFor(file));
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

describe(`compact category rows in ${CATEGORY_LIST_FILE}`, () => {
  const src = source(CATEGORY_LIST_FILE);

  it("renders semantic tables with a bottom border per row", () => {
    expect(src).toContain("<table aria-label={title}");
    expect(src).toContain("border-b border-surface-border");
    expect(src).not.toContain("<Card");
  });

  it("places row actions at the right", () => {
    expect(src).toContain("items-center justify-end gap-1");
    expect(src).toContain("RenameCategoryButton");
    expect(src).toContain("DeleteCategoryButton");
  });
});

describe("account and client card density", () => {
  const accounts = source("src/app/(main)/accounts/page.tsx");
  const clients = source("src/app/(main)/clients/clients-list.tsx");

  it("shows two account columns on mobile and four on desktop with compact card padding", () => {
    expect(accounts).toContain("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4");
    expect(accounts).toContain('headerClassName="!px-3 !py-2"');
    expect(accounts).toContain('contentClassName="p-3"');
  });

  it("keeps every client field row visible, including empty values", () => {
    expect(clients).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3");
    expect(clients).toContain('value: client.phone || "—"');
    expect(clients).toContain('value: client.email || "—"');
    expect(clients).toContain('value: client.note || "—"');
    expect(clients).not.toContain("...(client.phone ?");
    expect(clients).not.toContain("...(client.email ?");
    expect(clients).not.toContain("...(client.note ?");
  });
});
