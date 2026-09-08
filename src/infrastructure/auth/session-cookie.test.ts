import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { setSessionCookie, getSessionCookie, deleteSessionCookie } from "./session-cookie";
import type { SessionClaims, SessionManager } from "../../core/application/ports";

/** The canonical session cookie name (R14-M §21: gm_session -> twincap_session). */
const COOKIE_NAME = "twincap_session";

type CookieStore = {
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function mockStore(): CookieStore {
  const store = {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  };
  vi.mocked(cookies).mockResolvedValue(store as never);
  return store;
}

const CLAIMS: SessionClaims = {
  sub: "user-1",
  email: "user@example.com",
  workspaceId: "ws-1",
  sessionVersion: 0,
};

function fakeSessionManager(overrides: Partial<SessionManager> = {}): SessionManager {
  return {
    create: vi.fn().mockResolvedValue("token-123"),
    verify: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("session-cookie (R14-M)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the session cookie under the twincap_session name with the issued token", async () => {
    const store = mockStore();
    const sessionManager = fakeSessionManager();

    await setSessionCookie(sessionManager, CLAIMS);

    expect(store.set).toHaveBeenCalledTimes(1);
    const [name, token, options] = store.set.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(token).toBe("token-123");
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("reads the twincap_session cookie and verifies its token", async () => {
    const store = mockStore();
    store.get.mockReturnValue({ name: COOKIE_NAME, value: "token-123" });
    const sessionManager = fakeSessionManager({
      verify: vi.fn().mockResolvedValue(CLAIMS),
    });

    const result = await getSessionCookie(sessionManager);

    expect(store.get).toHaveBeenCalledWith(COOKIE_NAME);
    expect(sessionManager.verify).toHaveBeenCalledWith("token-123");
    expect(result).toEqual(CLAIMS);
  });

  it("returns null when the twincap_session cookie is absent", async () => {
    const store = mockStore();
    store.get.mockReturnValue(undefined);

    const result = await getSessionCookie(fakeSessionManager());

    expect(store.get).toHaveBeenCalledWith(COOKIE_NAME);
    expect(result).toBeNull();
  });

  it("deletes the twincap_session cookie on logout", async () => {
    const store = mockStore();

    await deleteSessionCookie();

    expect(store.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});
