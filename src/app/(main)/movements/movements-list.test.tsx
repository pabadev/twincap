// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MovementsList } from "./movements-list";
import type { SerializedMovement } from "../../../core/domain/movement";

// Product decision 2026-09-21: tables are retired — cards render on every
// breakpoint. The sort-header tests (R-10, S10.x) were removed with the
// table; the load-more regressions below remain.

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
  // One account so the scope tabs render (accounts.length > 0 gate); the load
  // more / scope pagination tests never read its fields beyond id/name/currency.
  listAccountsAction: async () => [
    {
      id: "acc-1",
      workspaceId: "ws-1",
      name: "Caja",
      currency: "COP",
      isFixed: true,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  ],
  listCategoriesAction: async () => [],
  listMovementsPagedAction: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  listAllMovementsAction: vi.fn().mockResolvedValue([]),
  exportMovementsCsvAction: async () => null,
}));

// Server-action/Modal-backed row controls are irrelevant to the pagination
// semantics; stubbed so the render stays light and focused on the trigger.
vi.mock("./delete-movement-button", () => ({ DeleteMovementButton: () => null }));
vi.mock("./edit-movement-modal", () => ({ EditMovementModal: () => null }));
vi.mock("../../../components/ui/movement-card", () => ({
  MovementCard: ({ id }: { id: string }) => <div data-movement-id={id} />,
}));

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

// H-23 (fetch-contract): the pagination reads go through /api/movements/page
// — stub global fetch and assert the REQUEST URL instead of a server action.
function stubFetch(respond: { items: SerializedMovement[]; nextCursor: null }) {
  const calls: string[] = [];
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input: URL | RequestInfo) => {
    calls.push(
      String(typeof input === "string" ? input : ((input as URL).href ?? (input as Request).url)),
    );
    return {
      ok: true,
      json: async () => respond,
    } as Response;
  });
  return { calls, spy };
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

describe("MovementsList load more (T5 regression)", () => {
  it("preserves the server order when movements share the same business date", () => {
    const { container } = mount(
      <MovementsList
        initialMovements={[
          movement({ id: "newer", createdAt: new Date("2026-09-01T12:00:00.000Z") }),
          movement({ id: "older", createdAt: new Date("2026-09-01T08:00:00.000Z") }),
        ]}
        nextCursor={null}
      />,
    );
    expect(
      Array.from(container.querySelectorAll("[data-movement-id]"), (node) =>
        node.getAttribute("data-movement-id"),
      ),
    ).toEqual(["newer", "older"]);
  });

  it("renders the load more button when nextCursor is set", () => {
    const { container } = mount(
      <MovementsList
        initialMovements={[movement()]}
        nextCursor={{
          date: "2026-09-01T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
          id: "m-1",
        }}
      />,
    );
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("loadMore"),
    );
    expect(button).toBeDefined();
  });

  it("does not render the load more button when nextCursor is null", () => {
    const { container } = mount(<MovementsList {...baseProps} />);
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("loadMore"),
    );
    expect(button).toBeUndefined();
  });

  it("calls the load more handler once when clicked", async () => {
    const { calls } = stubFetch({ items: [], nextCursor: null });

    const { container } = mount(
      <MovementsList
        initialMovements={[movement()]}
        nextCursor={{
          date: "2026-09-01T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
          id: "m-1",
        }}
      />,
    );
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("loadMore"),
    );
    expect(button).toBeDefined();
    act(() => {
      button!.click();
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/movements/page?");
    expect(calls[0]).toContain("limit=50");
  });
});

describe("MovementsList scope pagination (foundator review 2026-10-31)", () => {
  const CURSOR = {
    date: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    id: "m-1",
  };

  it('pages the ACTIVE tab context server-side ("Personal" scope reaches the action)', async () => {
    const { calls } = stubFetch({ items: [], nextCursor: null });

    const { container } = mount(
      <MovementsList initialMovements={[movement()]} nextCursor={CURSOR} initialTab="Personal" />,
    );
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("loadMore"),
    );
    act(() => {
      button!.click();
    });
    // The fetch URL carries the scoped page contract: limit + cursor + context.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/movements/page?");
    expect(calls[0]).toContain("limit=50");
    expect(calls[0]).toContain("scope=Personal");
    expect(calls[0]).toContain("cursorDate=" + encodeURIComponent(CURSOR.date));
    expect(calls[0]).toContain("cursorId=" + encodeURIComponent(CURSOR.id));
  });

  it('switching tabs refetches the new scope first page without the full fetch ("all" falls back)', async () => {
    const { calls } = stubFetch({
      items: [
        movement({ id: "p-1", context: "Personal" }),
        movement({ id: "p-2", context: "Personal" }),
      ],
      nextCursor: null,
    });
    const mockAll = await import("./actions").then((m) => m.listAllMovementsAction);
    vi.mocked(mockAll).mockClear();

    const { container } = mount(
      <MovementsList initialMovements={[movement()]} nextCursor={null} />,
    );
    // Tabs mount after the async accounts fetch resolves (listAccountsAction).
    await act(async () => {});
    const personalTab = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((t) => t.textContent?.includes("scopePersonal"));
    act(() => {
      personalTab!.click();
    });

    // Tab switch = ONE scoped first-page request, NO full-workspace fetch.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("scope=Personal");
    expect(mockAll).not.toHaveBeenCalled();
  });

  it("switching back to all requests the unscoped stream", async () => {
    const { calls } = stubFetch({ items: [], nextCursor: null });

    const { container } = mount(
      <MovementsList initialMovements={[movement()]} nextCursor={null} initialTab="Personal" />,
    );
    await act(async () => {});
    const allTab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (t) => t.textContent?.includes("scopeAll"),
    );
    act(() => {
      allTab!.click();
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("limit=50");
    expect(calls[0]).not.toContain("scope=");
  });
});
