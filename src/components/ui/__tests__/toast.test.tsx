// @vitest-environment jsdom

import { act } from "react";
import { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ToastProvider, useToastContext } from "../toast-provider";

// UX-9 Slice C, R-8 (H-16): single announcement channel for toasts.
// The provider owns the ONE `aria-live="polite"` region (toast-provider.tsx
// container); individual toast items MUST NOT carry `role="alert"` because an
// alert role nested inside a polite live region produces two concurrent
// announcement signals (assertive from the node + polite from the ancestor).
// Scenarios S8.1 (automated guard) — S8.3 (screen-reader manual check) is a
// non-automatable close criterion delegated to the founder/reviewer.

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
  document.body.innerHTML = "";
});

function ToastHarness() {
  const { addToast } = useToastContext();
  const [count, setCount] = useState(0);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          addToast(`Saved item ${count}`);
          setCount((c) => c + 1);
        }}
      >
        add toast
      </button>
    </div>
  );
}

describe("Toast single announcement channel (R-8, S8.1)", () => {
  it("keeps exactly one polite live region with an accessible label", () => {
    const { container } = mount(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    const regions = container.querySelectorAll('[aria-live="polite"]');
    expect(regions.length).toBe(1);
    expect(regions[0].getAttribute("aria-label")).toBe("notifications");
  });

  it("renders toast items WITHOUT a nested role=alert inside the polite region", () => {
    const { container } = mount(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    const trigger = container.querySelector<HTMLButtonElement>("button");
    act(() => {
      trigger?.click();
    });

    const regions = container.querySelectorAll('[aria-live="polite"]');
    expect(regions.length).toBe(1);
    const region = regions[0];

    // The toast must actually be present for the absence assert to be meaningful.
    expect(region.textContent).toContain("Saved item 0");
    // No item inside the live region may declare its own alert role: the
    // polite region alone announces each toast (single channel, S8.1).
    expect(region.querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps every toast of a stack on the polite channel — no nested alerts", () => {
    const { container } = mount(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    const trigger = container.querySelector<HTMLButtonElement>("button");
    // Separate act() flushes per click so the harness state advances between
    // renders (React batches updates inside a single act block).
    act(() => {
      trigger?.click();
    });
    act(() => {
      trigger?.click();
    });
    act(() => {
      trigger?.click();
    });

    const region = container.querySelector('[aria-live="polite"]')!;
    expect(region.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(region.textContent).toContain("Saved item 0");
    expect(region.textContent).toContain("Saved item 1");
    expect(region.textContent).toContain("Saved item 2");
  });
});
