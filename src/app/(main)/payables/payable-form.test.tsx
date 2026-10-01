// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PayableForm } from "./payable-form";
import type { SerializedAccount } from "../../../core/domain/account";

// EXC-1 (ronda final pre-beta, fundador 2026-09-30): the payable form asks the
// user for the Personal/Business classification (neutral start) and no longer
// shows an independent currency picker — the selected account decides (§4).

vi.mock("./actions", () => ({
  createPayableAction: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

vi.mock("../../../lib/hooks/use-toast", () => ({
  useToast: () => ({ addToast: () => {} }),
}));

vi.mock("../../../lib/use-action-error", () => ({
  useActionError: () => (error: string) => error,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => {},
    push: () => {},
    replace: () => {},
    back: () => {},
    prefetch: () => {},
  }),
}));

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];

function mount(node: ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  mountedRoots.push(root);
  return container;
}

const accounts: SerializedAccount[] = [
  {
    id: "acc-1",
    workspaceId: "ws-1",
    name: "Efectivo",
    currency: "COP",
    isFixed: false,
    createdAt: new Date("2026-01-01"),
    version: 0,
  },
  {
    id: "acc-2",
    workspaceId: "ws-1",
    name: "Dólares",
    currency: "USD",
    isFixed: false,
    createdAt: new Date("2026-01-01"),
    version: 0,
  },
];

describe("PayableForm", () => {
  afterEach(() => {
    mountedRoots.splice(0).forEach((root) => act(() => root.unmount()));
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("asks the user for the Personal/Business context (neutral open)", () => {
    const container = mount(<PayableForm accounts={accounts} />);
    const select = container.querySelector<HTMLSelectElement>('select[name="context"]')!;
    expect(select).not.toBeNull();
    // Neutral start (PROJECT-RULES §15): placeholder, no silent preload.
    expect(select.value).toBe("");
    const values = [...select.options].map((o) => o.value);
    expect(values).toContain("Personal");
    expect(values).toContain("Business");
  });

  it("renders NO independent currency picker (the account decides — §4)", () => {
    const container = mount(<PayableForm accounts={accounts} />);
    expect(container.querySelector('select[name="currency"]')).toBeNull();
  });
});
