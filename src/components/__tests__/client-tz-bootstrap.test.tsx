// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ClientTzBootstrap } from "../client-tz-bootstrap";

// Founder bug fix (2026-09-30): the dashboard's initial server render needed
// the client's civil clock; this bootstrap publishes it via cookie before any
// server round-trip can consume it (NEXT_LOCALE precedent).

interface Mounted {
  root: ReturnType<typeof createRoot>;
  container: HTMLElement;
}
const mounted: Mounted[] = [];

function mount(node: ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  mounted.push({ root, container });
  return { root, container };
}

afterEach(() => {
  mounted.splice(0).forEach((entry) => act(() => entry.root.unmount()));
  document.body.innerHTML = "";
  // Clean the cookie the component writes.
  document.cookie = "CLIENT_TZ_OFFSET=;path=/;max-age=0";
});

describe("ClientTzBootstrap", () => {
  it("writes CLIENT_TZ_OFFSET as a 1-year sameSite=Lax cookie on mount", () => {
    mount(<ClientTzBootstrap />);
    const cookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("CLIENT_TZ_OFFSET="))!;
    expect(cookie).toBeDefined();
    const value = Number(cookie.split("=")[1]);
    expect(Number.isInteger(value)).toBe(true);
    // 300 (UTC-5) or 0 (UTC test hosts) both parse; bounds respected.
    expect(value).toBeGreaterThanOrEqual(-840);
    expect(value).toBeLessThanOrEqual(840);
  });
});
