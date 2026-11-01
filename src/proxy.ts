import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "./infrastructure/db/connection";
import { reportUnexpectedErrorAndWait } from "./lib/report-unexpected-error";

const DEFAULT_LOCALE = "es";
const LOCALES = ["es", "en"];

function getLocaleFromRequest(request: NextRequest): string {
  // 1. Check cookie
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && LOCALES.includes(cookieLocale)) return cookieLocale;

  // 2. Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim().substring(0, 2))
      .find((lang) => LOCALES.includes(lang));
    if (preferred) return preferred;
  }

  return DEFAULT_LOCALE;
}

/**
 * Builds the Content-Security-Policy for one request. The nonce is generated
 * per request (the inline theme script in the root layout carries it), so this
 * header cannot live in next.config.ts — it is emitted here, before rendering.
 *
 * Production keeps `<style>` blocks and stylesheet loads nonce-gated
 * (`style-src 'self' 'nonce-…'`). React also sets inline `style` properties
 * (monthly-chart bars, global-error); those map to the `style` attribute, which
 * only `style-src-attr 'unsafe-inline'` can allow (Baseline, Dec 2022) — a
 * scoped exception that cannot execute code. Dev tooling (React DevTools,
 * Turbopack HMR) injects `<style>` elements, so dev uses `'unsafe-inline'`
 * there per the Next.js CSP guide.
 */
function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const isProd = process.env.NODE_ENV === "production";

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    ...(isDev ? [] : ["style-src-attr 'unsafe-inline'"]),
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // All client fetches are same-origin (API routes / server actions).
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Service workers are fetched as scripts, but 'strict-dynamic' ignores
    // host sources for worker destinations — allow the same-origin PWA worker.
    "worker-src 'self'",
    // Only in production: the app is served over HTTPS (Vercel); on a local
    // http://localhost it would break asset loading.
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

export async function proxy(request: NextRequest) {
  // Ensure DB connection is established before any route handler runs.
  // This prevents the "Cannot call findOne() before initial connection"
  // error on Turbopack cold start.
  try {
    await connectDb();
  } catch (error) {
    // Report the startup/connection failure (fail-safe, best-effort), then
    // preserve the original behavior: let the exception propagate so Next
    // fails the request exactly as it did before (no try/catch existed).
    await reportUnexpectedErrorAndWait(error);
    throw error;
  }

  const locale = getLocaleFromRequest(request);

  // Per-request CSP nonce. Next.js parses 'nonce-…' from the Content-Security
  // Policy and applies it automatically to its own scripts/inline styles; the
  // inline theme script in the root layout reads it from the x-nonce header.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = buildCspHeader(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("x-locale", locale);
  // H-23 (fundador 2026-10-31 round 2): re-issuing the NEXT_LOCALE cookie on
  // EVERY response MUTATED cookies on server-action responses — and a
  // mutating cookie on an action response makes the Next 16 router re-render
  // the current route in that same roundtrip (docs/server-actions.md). A
  // read-only action (the movements "Cargar más") then carried a full page
  // flight whose segment swap remounted the list and reset the accumulated
  // pagination state ("first click refreshes without appending"). Skip the
  // redundant set: the cookie is already at the resolved locale (1-year
  // maxAge from the first page load); re-issue ONLY when the resolved locale
  // actually differs from the stored one (the language toggle still
  // persists its switch).
  if (request.cookies.get("NEXT_LOCALE")?.value !== locale) {
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      // Same route coverage as before (pages only, excluding api/_next/files)
      // — INCLUDING server-action POSTs (they match the page path), which
      // REQUIRE this proxy: the CSP nonce + x-locale feed the in-response
      // route re-renders of revalidating actions. A round-1 fix excluded
      // next-action requests and BROKE every revalidating action's payload
      // (dialogs never closed — no CSP/nonce coherence). The redundant
      // cookie-set removal above is the actual surgical fix for the
      // read-only pagination flight bug.
      source: "/((?!api|_next|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
