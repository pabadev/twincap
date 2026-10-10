"use client";

import { ChevronDown } from "lucide-react";
import { useT } from "@/i18n/client";

const FAQ_ITEMS = [
  { q: "faq1Question", a: "faq1Answer" },
  { q: "faq2Question", a: "faq2Answer" },
  { q: "faq3Question", a: "faq3Answer" },
  { q: "faq4Question", a: "faq4Answer" },
  { q: "faq5Question", a: "faq5Answer" },
] as const;

export function Faq() {
  const t = useT("Landing");

  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-800">
            {t("faqEyebrow")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {t("faqTitle")}
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-2xl border border-slate-200 bg-white px-5 open:border-cyan-200 open:bg-cyan-50/40 sm:px-6"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-semibold text-slate-900 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-800 [&::-webkit-details-marker]:hidden">
                {t(q)}
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-5 pr-8 text-sm leading-6 text-slate-600">{t(a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
