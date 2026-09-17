// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MovementsList } from "./movements-list";
import type { SerializedMovement } from "../../../core/domain/movement";

// UX-9 Slice D, R-10 (H-18 bonus): the sort headers expose aria-sort coherent
// with the current sort state (ascending/descending on the active column,
// "none" elsewhere). Scenarios S10.1, S10.2.

vi.mock("../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

vi.mock("../../../lib/hooks/use-toast", () => ({
  useToast: () => ({ addToast: () => {} }),
}));

vi.mock("../global-movement-provider", () => ({
  useQuickMovement: () => ({ openQuickMovement: () => {} }),
}));

vi.mock("./actions", () => ({
  listAccountsAction: async () => [],
  listCategoriesAction: async () => [],
  listMovementsPagedAction: async () => ({ items: [], nextCursor: null }),
  exportMovementsCsvAction: async () => null,
}));

// Server-action/Modal-backed row controls are irrelevant to the header sort
// semantics; stubbed so the render stays light and focused on the THead.
vi.mock("./delete-movement-button", () => ({ DeleteMovementButton: () => null }));
vi.mock("./edit-movement-modal", () => ({ EditMovementModal: () => null }));
vi.mock("../../../components/ui/movement-card", () => ({ MovementCard: () => null }));

function movement(overrides: Partial<SerializedMovement> = {}): SerializedMovement {
  return {
    id: "m-1",
    workspaceId: "ws-1",
    accountId: "acc-1",
    categoryId: "cat-1",
    type: "expense",
    amount: { amount: 15000, currency: "COP" },
    signedAmount: -15000,
    date: new Date("2026-09-01T00:00:00.000Z"),
    note: "Almuerzo",
    context: "Personal",
    link: undefined,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 0,
    ...overrides,
  };
}

const baseProps = {
  initialMovements: [movement()],
  nextCursor: null,
};

interface Mounted {
  root: ReturnType<typeof createRoot>;
  container: HTMLElement;
  unmount: () => void;
}

const mounted: Mounted[] = [];

function mount(node: ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  const entry: Mounted = {
    root,
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
  mounted.push(entry);
  return entry;
}

afterEach(() => {
  mounted.splice(0).forEach((entry) => entry.unmount());
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function headerCell(container: HTMLElement, label: string): HTMLTableCellElement {
  const th = Array.from(container.querySelectorAll("th")).find((c) =>
    c.textContent?.includes(label),
  );
  if (!th) throw new Error(`header cell "${label}" not found`);
  return th as HTMLTableCellElement;
}

describe("MovementsList sort headers (R-10, H-18)", () => {
  it("defaults to descending on the date column (S10.1 initial state)", () => {
    const { container } = mount(<MovementsList {...baseProps} />);
    expect(headerCell(container, "date").getAttribute("aria-sort")).toBe("descending");
    expect(headerCell(container, "amount").getAttribute("aria-sort")).toBe("none");
    expect(headerCell(container, "category").getAttribute("aria-sort")).toBe("none");
  });

  it("marks the active date header ascending and the rest none after toggling (S10.1)", () => {
    const { container } = mount(<MovementsList {...baseProps} />);
    act(() => {
      headerCell(container, "date").querySelector("button")!.click();
    });
    expect(headerCell(container, "date").getAttribute("aria-sort")).toBe("ascending");
    expect(headerCell(container, "amount").getAttribute("aria-sort")).toBe("none");
    expect(headerCell(container, "category").getAttribute("aria-sort")).toBe("none");
  });

  it("marks the amount header descending when amount sorting is active (S10.2)", () => {
    const { container } = mount(<MovementsList {...baseProps} />);
    act(() => {
      headerCell(container, "amount").querySelector("button")!.click();
    });
    expect(headerCell(container, "amount").getAttribute("aria-sort")).toBe("descending");
    expect(headerCell(container, "date").getAttribute("aria-sort")).toBe("none");
    expect(headerCell(container, "category").getAttribute("aria-sort")).toBe("none");
  });
});
