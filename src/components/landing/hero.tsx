"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck, WalletCards } from "lucide-react";
import { useT } from "@/i18n/client";
import { Logo } from "@/components/ui/logo";

export function Hero() {
  const t = useT("Landing");

  return (
    <section className="relative isolate overflow-hidden bg-[#f7f9f8]">
      <div
        className="pointer-events-none absolute -right-40 -top-48 -z-10 h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.13),rgba(20,184,166,0)_68%)]"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <header className="flex h-[4.5rem] items-center justify-between border-b border-slate-200/80 sm:h-20">
          <Logo variant="logotipo" size="md" neutral />
          <nav aria-label={t("mainNavLabel")} className="flex items-center gap-4 sm:gap-7">
            <a
              href="#funciones"
              className="hidden text-sm font-medium text-slate-600 transition hover:text-cyan-900 sm:inline"
            >
              {t("featuresNav")}
            </a>
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 transition hover:text-cyan-900"
            >
              <span className="hidden sm:inline">{t("login")}</span>
              <span className="sm:hidden">{t("loginShort")}</span>
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-cyan-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900 sm:min-h-11 sm:px-5"
            >
              {t("heroCta")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </nav>
        </header>

        <div className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-900">
              <span className="h-px w-7 bg-amber-500" aria-hidden="true" />
              {t("heroEyebrow")}
            </p>
            <h1 className="font-display text-[2.55rem] font-semibold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.8rem]">
              {t("heroTitle")}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              {t("heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-900 px-6 text-base font-semibold text-white shadow-md shadow-cyan-950/10 transition hover:-translate-y-0.5 hover:bg-cyan-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
              >
                {t("heroCta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#funciones"
                className="inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold text-slate-700 transition hover:bg-white hover:text-cyan-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
              >
                {t("exploreFeatures")}
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
              <CircleCheck className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
              {t("heroFootnote")}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
            <div
              className="absolute -left-8 top-16 h-28 w-28 rounded-full bg-amber-200/50 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="absolute -right-4 bottom-8 h-40 w-40 rounded-full bg-teal-200/50 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative rounded-[1.75rem] border border-slate-200/90 bg-white p-5 shadow-[0_32px_90px_-42px_rgba(15,23,42,0.35)] sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {t("previewLabel")}
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    {t("previewTitle")}
                  </h2>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                  {t("previewTag")}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4 sm:p-5">
                  <p className="text-xs font-medium text-slate-500">{t("previewSalesLabel")}</p>
                  <p className="mt-2 font-display text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                    {t("previewSalesValue")}
                  </p>
                </div>
                <div className="rounded-2xl bg-cyan-50/80 p-4 sm:p-5">
                  <p className="text-xs font-medium text-cyan-900/70">
                    {t("previewReceivableLabel")}
                  </p>
                  <p className="mt-2 font-display text-lg font-semibold tracking-tight text-cyan-950 sm:text-xl">
                    {t("previewReceivableValue")}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {t("previewResultLabel")}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{t("previewResultHelp")}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    {t("previewResultValue")}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
                  <WalletCards className="h-4 w-4 shrink-0 text-cyan-800" aria-hidden="true" />
                  {t("previewPersonalNote")}
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500">{t("previewCaption")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
