import { describe, expect, it, vi, beforeEach } from "vitest";

// Founder bug fix (2026-09-30, ronda final pre-beta): the dashboard's initial
// server render derived the current civil month from the server's UTC clock,
// rolling to the NEXT month at month-end evenings (21:33 UTC-5 = 02:33 UTC on
// the next day). The fix: the client's `getTimezoneOffset()` travels in the
// CLIENT_TZ_OFFSET cookie ("NEXT_LOCALE" precedent) and this reader sanitizes it.

function mockCookieValue(value?: string) {
  vi.doMock("next/headers", () => ({
    cookies: async () => ({
      get: (name: string) =>
        name === "CLIENT_TZ_OFFSET" && value !== undefined ? { value } : undefined,
    }),
  }));
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("getClientTzOffsetMinutes — client civil clock via cookie", () => {
  it("returns the parsed offset when the cookie holds an integer (300 for UTC-5)", async () => {
    mockCookieValue("300");
    const { getClientTzOffsetMinutes: read } = await import("./client-tz");
    expect(await read()).toBe(300);
  });

  it("returns 0 when the cookie is absent (first visit — A2 mount-sync corrects the paint)", async () => {
    mockCookieValue(undefined);
    const { getClientTzOffsetMinutes: read } = await import("./client-tz");
    expect(await read()).toBe(0);
  });

  it("rejects non-integer and out-of-range values (sanitized to 0)", async () => {
    for (const hostile of ["abc", "7200", "-100000", "1.5", ""]) {
      mockCookieValue(hostile);
      const { getClientTzOffsetMinutes: read } = await import("./client-tz");
      expect(await read()).toBe(0);
    }
  });

  it("accepts the ±14h boundary (840 minutes)", async () => {
    mockCookieValue("840");
    const { getClientTzOffsetMinutes: read } = await import("./client-tz");
    expect(await read()).toBe(840);
  });
});
