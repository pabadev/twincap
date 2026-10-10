"use client";

import { BadgeCheck, Boxes, ReceiptText, WalletCards } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/i18n/client";

const FEATURES = [
  { key: "feature1", icon: WalletCards, accent: "bg-cyan-100 text-cyan-900" },
  { key: "feature2", icon: ReceiptText, accent: "bg-amber-100 text-amber-900" },
  { key: "feature3", icon: Boxes, accent: "bg-teal-100 text-teal-900" },
] as const;

export function Features() {
  const t = useT("Landing");

  return (
    <section id="funciones" className="scroll-mt-8 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-cyan-900">{t("featuresEyebrow")}</p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">
              {t("featuresTitle")}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            {t("featuresSubtitle")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-14">
          {FEATURES.map(({ key, icon, accent }) => (
            <article
              key={key}
              className="rounded-2xl border border-slate-200/90 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_48px_-32px_rgba(15,23,42,0.3)] sm:p-7"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
                <Icon icon={icon} size="md" />
              </div>
              <h3 className="mt-7 font-display text-lg font-semibold tracking-tight text-slate-900">
                {t(`${key}Title`)}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                {t(`${key}Desc`)}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-slate-500">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
          <span>{t("featuresNote")}</span>
        </p>
      </div>
    </section>
  );
}
