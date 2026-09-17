// @vitest-environment jsdom

import { act } from "react";
import { type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainNav } from "../../../app/(main)/nav";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => {
  const { createElement, forwardRef } = require("react");
  return {
    default: forwardRef(function MockLink(
      { href, children, ...rest }: Record<string, unknown>,
      ref: unknown,
    ) {
      return createElement("a", { href: String(href), ref, ...rest }, children);
    }),
  };
});

vi.mock("../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

vi.mock("../../../components/theme-provider", () => ({
  useTheme: () => ({ theme: "light", setTheme: () => {} }),
}));

vi.mock("../../../app/(auth)/actions", () => ({
  logoutAction: () => {},
}));

// FeedbackDialog pulls the feedback server action which boots the auth/env
// stack (getCurrentUser + env parsing) — irrelevant to the drawer trap, so
// replace it with a stub that renders nothing.
vi.mock("../../../components/feedback/feedback-widget", () => ({
  FeedbackDialog: () => null,
}));

// Mobile drawer focus trap + inert behavior (UX-9 Slice A, R-3).
// Scenarios: S3.1 (trap open), S3.2 (inert closed on mobile), S3.3 (lg+ no inert).

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
  vi.unstubAllGlobals();
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

/** Stub window.matchMedia so the drawer can read the lg breakpoint. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: "(min-width: 1024px)",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    },
    dispatchEvent: () => false,
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return {
    mql,
    setMatches(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
  };
}

const ASIDE_SELECTOR = "a[href], button:not([disabled])";

describe("MainNav mobile drawer (R-3)", () => {
  it("cycles Tab inside the aside, closes on Escape and restores focus to the hamburger (S3.1)", () => {
    stubMatchMedia(false);
    const { container } = mount(<MainNav isLoggedIn email="a@b.c" canViewAnalytics={false} />);
    const hamburger = container.querySelector<HTMLButtonElement>('[aria-label="openMenu"]')!;
    act(() => hamburger.focus());
    act(() => hamburger.click());

    const aside = container.querySelector("#mobile-nav")!;
    // Focus lands on the first nav link when the drawer opens.
    expect((document.activeElement as HTMLElement).getAttribute("href")).toBe("/dashboard");

    // Tab from the last focusable wraps back to the first.
    const focusable = Array.from(aside.querySelectorAll<HTMLElement>(ASIDE_SELECTOR));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    act(() => last.focus());
    pressKey("Tab");
    expect(document.activeElement).toBe(first);

    // Escape closes the drawer; focus returns to the hamburger (re-query:
    // the button unmounts while open, so a fresh node remounts on close).
    pressKey("Escape");
    expect(aside.className).toContain("-translate-x-full");
    const reopenedHamburger =
      container.querySelector<HTMLButtonElement>('[aria-label="openMenu"]')!;
    expect(document.activeElement).toBe(reopenedHamburger);
  });

  it("renders the closed mobile drawer as inert — not focusable, hidden from AT (S3.2)", () => {
    stubMatchMedia(false);
    const { container } = mount(<MainNav isLoggedIn email="a@b.c" canViewAnalytics={false} />);
    const aside = container.querySelector("#mobile-nav")!;
    expect(aside.hasAttribute("inert")).toBe(true);
  });

  it("keeps the aside visible and focusable at lg+ even when closed (no inert) (S3.3)", () => {
    stubMatchMedia(true);
    const { container } = mount(<MainNav isLoggedIn email="a@b.c" canViewAnalytics={false} />);
    const aside = container.querySelector("#mobile-nav")!;
    expect(aside.hasAttribute("inert")).toBe(false);
  });
});
