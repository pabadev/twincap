import Link from "next/link";
import { getT } from "@/i18n/server";
import { Logo } from "@/components/ui/logo";

/**
 * Localized 404 page (H-04, R-5/R-6/R-7).
 *
 * Next.js 16 renders `app/not-found.tsx` INSIDE the root layout, which already
 * provides the brand shell: <html lang>, fonts, TranslationsProvider,
 * ThemeProvider and the CSP nonce. The page only renders the brand header —
 * NO app sidebar — so the intentional opacity of the (analytics) module is
 * preserved when this page is reached via `notFound()` from
 * (analytics)/layout.tsx or (analytics)/analytics/page.tsx.
 *
 * The same file covers any unmatched URL. Next injects <meta name="robots"
 * content="noindex" /> automatically for 404 responses (no experimental
 * global-not-found.js needed: the app has a single root layout).
 *
 * The home link points to "/": authed users are redirected to /dashboard
 * (app/page.tsx), guests see the landing page.
 */
export default async function NotFoundPage() {
  const t = await getT("NotFound");

  return (
    <div className="flex min-h-screen flex-col bg-surface-bg dark:bg-zinc-950">
      <header className="border-b border-surface-border bg-surface-card dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Link
            href="/"
            aria-label={t("home")}
            className="inline-flex items-center text-zinc-600 hover:text-primary dark:text-zinc-300 dark:hover:text-primary"
          >
            <Logo variant="logotipo" size="sm" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="mx-auto w-full max-w-md text-center">
          <p
            aria-hidden="true"
            className="font-display text-6xl font-bold tracking-tight text-cyan-700 dark:text-brand-gold"
          >
            404
          </p>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-white">
            {t("title")}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {t("description")}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            {t("home")}
          </Link>
        </div>
      </main>
    </div>
  );
}
