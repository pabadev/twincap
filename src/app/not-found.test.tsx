import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server";
import { cookies } from "next/headers";
import NotFoundPage from "./not-found";

/**
 * H-04 localized not-found test (R-5/R-7, task 3.4).
 *
 * The component resolves its copy through the REAL getT (src/i18n/server.ts),
 * which reads the NEXT_LOCALE cookie — so only `next/headers` is mocked and
 * the assertions exercise the true catalog copy per locale.
 *
 * Why renderToReadableStream instead of renderToStaticMarkup: React 19's
 * legacy sync renderers cannot await async Server Components ("A component
 * suspended while responding to synchronous input"); the streaming API is
 * the RSC-capable renderer Next.js itself uses, and it resolves async
 * components natively.
 *
 * notFound() path coverage: this page is the sink for BOTH unmatched URLs
 * and `notFound()` calls from (analytics)/layout.tsx and
 * (analytics)/analytics/page.tsx — Next renders the same root not-found.tsx
 * inside the root layout for every 404, so the assertions below cover all
 * reachable 404 paths.
 */
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockCookies = vi.mocked(cookies);

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function mockLocale(locale: "es" | "en"): void {
  mockCookies.mockResolvedValue({
    get: (name: string) =>
      name === "NEXT_LOCALE" ? { name: "NEXT_LOCALE", value: locale } : undefined,
  } as unknown as CookieStore);
}

async function renderPage(): Promise<string> {
  const stream = await renderToReadableStream(createElement(NotFoundPage) as ReactElement);
  return await new Response(stream).text();
}

describe("not-found page (H-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the localized Spanish 404 copy", async () => {
    mockLocale("es");
    const html = await renderPage();

    expect(html).toContain("Página no encontrada");
    expect(html).toContain(
      "La página que buscas no existe o fue movida. Revisa la dirección o vuelve al inicio.",
    );
  });

  it("renders the localized English 404 copy", async () => {
    mockLocale("en");
    const html = await renderPage();

    expect(html).toContain("Page not found");
    expect(html).toContain(
      "The page you are looking for does not exist or was moved. Check the address or go back home.",
    );
  });

  it("links home with the localized label in both locales", async () => {
    mockLocale("es");
    const esHtml = await renderPage();
    expect(esHtml).toContain('href="/"');
    expect(esHtml).toContain("Volver al inicio");

    mockLocale("en");
    const enHtml = await renderPage();
    expect(enHtml).toContain('href="/"');
    expect(enHtml).toContain("Back to home");
  });
});
