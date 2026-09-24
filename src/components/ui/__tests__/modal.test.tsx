// @vitest-environment jsdom

import { act } from "react";
import { useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "../focus-trap";
import { Modal } from "../modal";
import { MoneyActionConfirmation } from "../money-action-confirmation";

// Focus trap / modal behavior tests (UX-9 Slice A, R-1..R-2, R-4).
// Scenarios: S1.1-S1.3 (hook), S2.1-S2.3 (Modal), S4.1 (MoneyActionConfirmation
// delegates Tab handling to the Modal trap — no double trap).

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

function pressKey(key: string, opts: { shiftKey?: boolean } = {}) {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        shiftKey: opts.shiftKey ?? false,
      }),
    );
  });
}

function TrappedRegion({
  active,
  initialFocus,
}: {
  active: boolean;
  initialFocus?: () => HTMLElement | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(containerRef, { active, initialFocus });
  return (
    <div ref={containerRef}>
      <button type="button" data-name="first">
        first
      </button>
      <button type="button" data-name="last">
        last
      </button>
    </div>
  );
}

function ModalHarness({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div>
      <button type="button" data-name="trigger" onClick={() => setOpen(true)}>
        open
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Dialog title">
        <button type="button" data-name="content-first">
          content first
        </button>
        <button type="button" data-name="content-last">
          content last
        </button>
      </Modal>
    </div>
  );
}

function MacHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" data-name="mac-trigger" onClick={() => setOpen(true)}>
        run action
      </button>
      <MoneyActionConfirmation
        open={open}
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        title="Confirm action"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        variant="normal"
        detailRows={[{ label: "Amount", value: "50,000" }]}
      />
    </div>
  );
}

describe("useFocusTrap", () => {
  it("moves focus to the first focusable when active and records the previously focused element (S1.1)", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    mount(<TrappedRegion active />);
    expect(document.activeElement).toBe(document.body.querySelector('[data-name="first"]'));
    expect(document.body.querySelector('[data-name="first"]')).not.toBe(trigger);
    trigger.remove();
  });

  it("honors initialFocus when provided instead of the first focusable (S1.1)", () => {
    mount(
      <TrappedRegion
        active
        initialFocus={() => document.body.querySelector('[data-name="last"]')}
      />,
    );
    expect(document.activeElement).toBe(document.body.querySelector('[data-name="last"]'));
  });

  it("wraps Tab from the last focusable to the first and Shift+Tab from the first to the last (S1.2)", () => {
    mount(<TrappedRegion active />);
    const first = document.body.querySelector<HTMLButtonElement>('[data-name="first"]')!;
    const last = document.body.querySelector<HTMLButtonElement>('[data-name="last"]')!;
    act(() => last.focus());
    pressKey("Tab");
    expect(document.activeElement).toBe(first);
    act(() => first.focus());
    pressKey("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("restores focus to the previously focused element when deactivated (S1.3)", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { root } = mount(<TrappedRegion active />);
    expect(document.activeElement).not.toBe(trigger);
    act(() => root.render(<TrappedRegion active={false} />));
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

describe("Modal", () => {
  it("moves focus inside the dialog when it opens, not behind it (S2.1)", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    mount(<ModalHarness initialOpen />);
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(trigger);
    trigger.remove();
  });

  it("cycles Tab and Shift+Tab within the dialog (S2.2)", () => {
    mount(<ModalHarness initialOpen />);
    const dialog = document.body.querySelector('[role="dialog"]')!;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(focusable.length).toBeGreaterThanOrEqual(3);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    act(() => last.focus());
    pressKey("Tab");
    expect(document.activeElement).toBe(first);
    act(() => first.focus());
    pressKey("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("restores focus to the trigger when closed via Escape (S2.3)", () => {
    const { container } = mount(<ModalHarness initialOpen={false} />);
    const trigger = container.querySelector<HTMLButtonElement>('[data-name="trigger"]')!;
    act(() => trigger.focus());
    act(() => trigger.click());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    pressKey("Escape");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

// C12-1: onRequestClose intercepts ESC/X/backdrop so the consumer can gate
// close attempts (e.g. dirty-check confirmation). When omitted, onClose fires
// directly — backward-compatible.
describe("Modal onRequestClose (C12-1)", () => {
  function GuardedHarness({ initialOpen }: { initialOpen: boolean }) {
    const [open, setOpen] = useState(initialOpen);
    const [guarded, setGuarded] = useState(false);
    return (
      <div>
        <button type="button" data-name="trigger" onClick={() => setOpen(true)}>
          open
        </button>
        <span data-name="guarded">{guarded ? "yes" : "no"}</span>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          onRequestClose={() => setGuarded(true)}
          title="Guarded dialog"
        >
          <p>content</p>
        </Modal>
      </div>
    );
  }

  it("routes ESC through onRequestClose instead of onClose", () => {
    const { container } = mount(<GuardedHarness initialOpen />);
    expect(container.querySelector('[data-name="guarded"]')!.textContent).toBe("no");
    pressKey("Escape");
    // onClose was NOT called (dialog still open), onRequestClose was called.
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector('[data-name="guarded"]')!.textContent).toBe("yes");
  });

  it("routes backdrop click through onRequestClose instead of onClose", () => {
    const { container } = mount(<GuardedHarness initialOpen />);
    const backdrop = container.querySelector(".absolute.inset-0.bg-black\\/50")!;
    act(() => {
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector('[data-name="guarded"]')!.textContent).toBe("yes");
  });

  it("routes X button click through onRequestClose instead of onClose", () => {
    const { container } = mount(<GuardedHarness initialOpen />);
    const xButton = container.querySelector<HTMLButtonElement>('[aria-label="close"]')!;
    act(() => {
      xButton.click();
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector('[data-name="guarded"]')!.textContent).toBe("yes");
  });

  it("falls back to onClose when onRequestClose is not provided", () => {
    const { container } = mount(<ModalHarness initialOpen />);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    pressKey("Escape");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe("MoneyActionConfirmation focus reconciliation (R-4)", () => {
  it("keeps initial focus on the confirm button (S4.1)", () => {
    const { container } = mount(<MacHarness />);
    const trigger = container.querySelector<HTMLButtonElement>('[data-name="mac-trigger"]')!;
    act(() => trigger.click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLElement).textContent?.trim()).toBe("Confirm");
  });

  it("registers a single document keydown handler pair for an open dialog — Escape plus one Tab loop (no double trap) (S4.1)", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const { container } = mount(<MacHarness />);
    const trigger = container.querySelector<HTMLButtonElement>('[data-name="mac-trigger"]')!;
    act(() => trigger.click());
    const keydownRegistrations = addSpy.mock.calls.filter(([type]) => type === "keydown");
    // Modal owns both listeners (handleKeyDown + useFocusTrap). The local trap
    // removed from MoneyActionConfirmation (R-4) would make this 3.
    expect(keydownRegistrations.length).toBe(2);
  });

  it("keeps the Tab loop working through MoneyActionConfirmation via the Modal trap (S4.1)", () => {
    const { container } = mount(<MacHarness />);
    const trigger = container.querySelector<HTMLButtonElement>('[data-name="mac-trigger"]')!;
    act(() => trigger.click());
    const dialog = container.querySelector('[role="dialog"]')!;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    act(() => last.focus());
    pressKey("Tab");
    expect(document.activeElement).toBe(first);
  });
});
