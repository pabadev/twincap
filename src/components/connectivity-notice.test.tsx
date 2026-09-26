// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectivityNotice } from "./connectivity-notice";

vi.mock("../i18n/client", () => ({
  useT: () => (key: string) => key,
}));

describe("ConnectivityNotice", () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    vi.useRealTimers();
  });

  function setOnline(isOnline: boolean) {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: isOnline });
  }

  function render(node: ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(node));
    return container;
  }

  it("shows an offline status and announces recovery", () => {
    setOnline(false);
    const view = render(<ConnectivityNotice />);
    expect(view.textContent).toContain("offline");

    setOnline(true);
    act(() => window.dispatchEvent(new Event("online")));
    expect(view.textContent).toContain("connectionRestored");
  });

  it("stays hidden while online and shows a status when connection drops", () => {
    setOnline(true);
    const view = render(<ConnectivityNotice />);
    expect(view.textContent).toBe("");

    setOnline(false);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(view.textContent).toContain("offline");
  });

  it("clears the recovery message after a short announcement", () => {
    vi.useFakeTimers();
    setOnline(false);
    const view = render(<ConnectivityNotice />);
    setOnline(true);
    act(() => window.dispatchEvent(new Event("online")));
    expect(view.textContent).toContain("connectionRestored");

    act(() => vi.advanceTimersByTime(4000));
    expect(view.textContent).toBe("");
  });
});
