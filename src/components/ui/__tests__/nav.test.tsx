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

vi.mock("next/link", async () => {
  const { createElement, forwardRef } = await import("react");
  return {
    default: forwardRef(function MockLink(
      { href, children, ...rest }: { href?: unknown; children?: ReactNode; [key: string]: unknown },
      ref: unknown,
    ) {
      return createElement("a", { href: String(href), ref, ...rest }, children as ReactNode);
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
  FeedbackDialog: (props: { open?: boolean }) =>
    props?.open ? <div data-testid="feedback-dialog-open" /> : null,
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

// Four-tier IA structure (UX-10, DEC-IA-02/03/04/10). `useT` returns the key,
// so header spans assert key names and stay locale-independent.

/** Flattens the authenticated nav <ul> into an ordered sequence of entries. */
function navSequence(container: HTMLElement): Array<{ kind: "link" | "header"; value: string }> {
  const listItems = container.querySelectorAll("#mobile-nav nav > ul > li");
  const seq: Array<{ kind: "link" | "header"; value: string }> = [];
  listItems.forEach((li) => {
    const link = li.querySelector("a[href]");
    if (link) {
      seq.push({ kind: "link", value: link.getAttribute("href")! });
      return;
    }
    const span = li.querySelector("span");
    if (span && span.textContent) {
      seq.push({ kind: "header", value: span.textContent });
    }
  });
  return seq;
}

describe("MainNav four-tier structure (UX-10)", () => {
  it("renders Tier 1 links before any group header and headers lead their groups", () => {
    stubMatchMedia(true);
    const { container } = mount(<MainNav isLoggedIn email="a@b.c" canViewAnalytics={false} />);
    const seq = navSequence(container);

    // (a) Resumen + Movimientos + Transferencias come first, no header precedes them (a+c).
    expect(seq[0]).toEqual({ kind: "link", value: "/dashboard" });
    expect(seq[1]).toEqual({ kind: "link", value: "/movements" });
    expect(seq[2]).toEqual({ kind: "link", value: "/transfers" });
    expect(seq.slice(0, 3).some((e) => e.kind === "header")).toBe(false);

    // (b) Each header is immediately followed by its group's first link.
    const opIndex = seq.findIndex((e) => e.kind === "header" && e.value === "groupOperation");
    expect(seq[opIndex + 1]).toEqual({ kind: "link", value: "/pos/sales" });
    const comIndex = seq.findIndex((e) => e.kind === "header" && e.value === "groupCommitments");
    expect(seq[comIndex + 1]).toEqual({ kind: "link", value: "/credits/granted" });
    const setIndex = seq.findIndex((e) => e.kind === "header" && e.value === "groupSettings");
    expect(seq[setIndex + 1]).toEqual({ kind: "link", value: "/pos/catalog" });

    // (f) Analytics ABSENT when canViewAnalytics=false.
    expect(seq.some((e) => e.kind === "link" && e.value === "/analytics")).toBe(false);
  });

  it("appends analytics as the last Compromisos item only when authorized", () => {
    stubMatchMedia(true);
    const { container } = mount(<MainNav isLoggedIn email="a@b.c" canViewAnalytics={true} />);
    const seq = navSequence(container);
    const links = seq.filter((e) => e.kind === "link").map((e) => e.value);
    const analyticsIdx = links.indexOf("/analytics");
    expect(analyticsIdx).toBeGreaterThan(-1);
    // Analytics sits between the Compromisos group's first link and the
    // Configuración group's first link.
    const grantedIdx = links.indexOf("/credits/granted");
    const catalogIdx = links.indexOf("/pos/catalog");
    expect(analyticsIdx).toBeGreaterThan(grantedIdx);
    expect(analyticsIdx).toBeLessThan(catalogIdx);
    // Analytics is the LAST item of Compromisos: no links after it inside the
    // group (the Configuración header + /pos/catalog follow immediately).
    expect(links.slice(analyticsIdx + 1, catalogIdx)).toEqual([]);
  });

  it("keeps /help and the feedback button inside Configuración; footer drops profile/feedback", () => {
    stubMatchMedia(true);
    const { container } = mount(<MainNav isLoggedIn email="a@b.c" canViewAnalytics={false} />);
    const seq = navSequence(container);
    const setIndex = seq.findIndex((e) => e.kind === "header" && e.value === "groupSettings");
    const settingsHrefs = seq
      .slice(setIndex + 1)
      .filter((e) => e.kind === "link")
      .map((e) => e.value);
    // (d) /help belongs to Configuración; profile moved into the group.
    expect(settingsHrefs).toContain("/help");
    expect(settingsHrefs).toContain("/profile");

    // (h) Feedback button lives inside the group and still opens the dialog.
    const feedbackBtn = container.querySelector<HTMLButtonElement>('[aria-label="feedback"]')!;
    expect(feedbackBtn).toBeTruthy();
    expect(container.querySelector("#mobile-nav nav")!.contains(feedbackBtn)).toBe(true);
    act(() => feedbackBtn.click());
    expect(container.querySelector('[data-testid="feedback-dialog-open"]')).toBeTruthy();

    // (g) Footer: email + theme + lang + logout only — no profile, no feedback.
    const footer = container.querySelector("#mobile-nav div.mt-auto")!;
    expect(footer.querySelector('a[href="/profile"]')).toBe(null);
    expect(footer.querySelectorAll('[aria-label="feedback"]').length).toBe(0);
    expect(footer.textContent).toContain("a@b.c");
    const logoutBtn = Array.from(footer.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("exit"),
    );
    expect(logoutBtn).toBeTruthy();
  });

  it("marks only the active route with aria-current and keeps headers non-focusable", () => {
    stubMatchMedia(true);
    const { container } = mount(<MainNav isLoggedIn email="a@b.c" canViewAnalytics={false} />);
    // (i) aria-current only on the active-route item (mocked pathname=/dashboard).
    const current = container.querySelectorAll('[aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].getAttribute("href")).toBe("/dashboard");

    // (k) Header spans are non-focusable and no <hr> remains.
    container.querySelectorAll("#mobile-nav nav > ul > li > span").forEach((span) => {
      expect(span.tagName).toBe("SPAN");
    });
    expect(container.querySelector("#mobile-nav hr")).toBe(null);

    // (j) First focusable anchor in the nav is /dashboard.
    const firstAnchor = container.querySelector<HTMLAnchorElement>("#mobile-nav nav a[href]")!;
    expect(firstAnchor.getAttribute("href")).toBe("/dashboard");
  });
});
