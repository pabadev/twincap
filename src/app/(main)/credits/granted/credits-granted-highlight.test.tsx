// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreditsGrantedList } from "./credits-granted-list";
import type { SerializedCreditGranted } from "../../../../core/domain/credit-granted";

vi.mock("../../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

vi.mock("./credit-form", () => ({ CreditForm: () => null }));
vi.mock("./abono-form", () => ({ AbonoForm: () => null }));
vi.mock("./edit-abono-form", () => ({ EditAbonoForm: () => null }));
vi.mock("./edit-credit-form", () => ({ EditCreditForm: () => null }));
vi.mock("./delete-credit-button", () => ({ DeleteCreditButton: () => null }));
vi.mock("./delete-abono-button", () => ({ DeleteAbonoButton: () => null }));
vi.mock("./mark-as-paid-button", () => ({ MarkAsPaidButton: () => null }));
vi.mock("./write-off-button", () => ({ WriteOffButton: () => null }));
vi.mock("../../../../components/ui/modal", () => ({ Modal: () => null }));

const credit = {
  id: "credit-target",
  workspaceId: "workspace-1",
  counterparty: "Cliente de prueba",
  principal: { amount: 10000, currency: "COP" },
  accountId: "account-1",
  date: new Date("2026-09-01T12:00:00.000Z"),
  installments: undefined,
  frequency: undefined,
  installmentValue: undefined,
  totalToPay: 10000,
  saleId: "sale-1",
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  version: 0,
  pending: 10000,
  abonos: [],
} as unknown as SerializedCreditGranted;

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
const originalAnimationFrame = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(
  window,
  "cancelAnimationFrame",
);
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches }),
  });
}

function mockAnimationFrame() {
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: vi.fn((frame: FrameRequestCallback) => {
      frame(0);
      return 1;
    }),
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value: vi.fn(),
  });
}

function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  mounted.push({ root, container });
  return container;
}

afterEach(() => {
  mounted.splice(0).forEach(({ root, container }) => {
    act(() => root.unmount());
    container.remove();
  });
  vi.restoreAllMocks();
  vi.useRealTimers();
  restoreProperty(window, "matchMedia", originalMatchMedia);
  restoreProperty(window, "requestAnimationFrame", originalAnimationFrame);
  restoreProperty(window, "cancelAnimationFrame", originalCancelAnimationFrame);
  restoreProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  window.history.replaceState(null, "", "/");
});

describe("CreditsGrantedList sale-credit highlight", () => {
  it("scrolls to and highlights the exact linked credit for three seconds", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/credits/granted?highlight=credit-target");
    mockMatchMedia(false);
    const scrollIntoView = vi.fn();
    mockAnimationFrame();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    const container = mount(<CreditsGrantedList accounts={[]} credits={[credit]} />);
    const target = container.querySelector<HTMLElement>('[data-credit-id="credit-target"]');

    expect(target?.className).toContain("animate-pulse");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });

    act(() => vi.advanceTimersByTime(2999));
    expect(target?.className).toContain("animate-pulse");
    act(() => vi.advanceTimersByTime(1));
    expect(target?.className).not.toContain("animate-pulse");
  });

  it("ignores an ID that does not exist in the current workspace list", () => {
    window.history.replaceState(null, "", "/credits/granted?highlight=other-workspace-credit");
    const requestFrame = vi.fn();
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: requestFrame,
    });
    const container = mount(<CreditsGrantedList accounts={[]} credits={[credit]} />);

    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it("uses non-animated scrolling when reduced motion is preferred", () => {
    window.history.replaceState(null, "", "/credits/granted?highlight=credit-target");
    mockMatchMedia(true);
    const scrollIntoView = vi.fn();
    mockAnimationFrame();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    mount(<CreditsGrantedList accounts={[]} credits={[credit]} />);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });
});

function restoreProperty(target: object, key: PropertyKey, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
}
