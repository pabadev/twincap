"use client";

import { ArrowRight, ClipboardList, CircleDollarSign, CircleCheck } from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n/client";

const STEPS = [
  { key: "step1", icon: ClipboardList },
  { key: "step2", icon: CircleDollarSign },
  { key: "step3", icon: CircleCheck },
] as const;

export function Benefits() {
  const t = useT("Landing");

  return (
    <section className="bg-[#f7f9f8] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-cyan-900">{t("benefitsEyebrow")}</p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">
            {t("benefitsTitle")}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            {t("benefitsSubtitle")}
          </p>
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-14">
          {STEPS.map(({ key, icon: StepIcon }, index) => (
            <li
              key={key}
              className="relative rounded-2xl border border-slate-200 bg-white p-6 sm:p-7"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-900">
                  <StepIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-display text-sm font-semibold tabular-nums text-slate-300">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-7 font-display text-lg font-semibold tracking-tight text-slate-900">
                {t(`${key}Title`)}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                {t(`${key}Desc`)}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col gap-5 rounded-3xl bg-slate-950 px-6 py-8 text-white sm:px-9 sm:py-9 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {t("ctaTitle")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">{t("ctaSubtitle")}</p>
          </div>
          <Link
            href="/register"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-amber-300 px-6 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            {t("ctaButton")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
