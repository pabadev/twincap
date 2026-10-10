"use client";

import Link from "next/link";
import { useT } from "@/i18n/client";
import { Logo } from "@/components/ui/logo";

export function Footer() {
  const t = useT("Landing");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <Logo variant="logotipo" size="sm" neutral />
            <p className="mt-2 text-xs text-slate-500">{t("footerTagline")}</p>
          </div>
          <nav
            aria-label={t("footerNavLabel")}
            className="flex flex-wrap justify-center gap-x-6 gap-y-3"
          >
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-cyan-800">
              {t("login")}
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium text-slate-600 hover:text-cyan-800"
            >
              {t("register")}
            </Link>
          </nav>
        </div>
        <nav
          aria-label={t("legalNavAriaLabel")}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-slate-200 pt-6"
        >
          <Link href="/privacy" className="text-xs text-slate-500 hover:text-cyan-800">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="text-xs text-slate-500 hover:text-cyan-800">
            {t("terms")}
          </Link>
          <Link href="/cookies" className="text-xs text-slate-500 hover:text-cyan-800">
            {t("cookies")}
          </Link>
          <Link href="/data-policy" className="text-xs text-slate-500 hover:text-cyan-800">
            {t("dataPolicy")}
          </Link>
        </nav>
        <p className="mt-6 text-center text-xs text-slate-500">
          {t("footerCopyright", { year: String(year) })}
        </p>
      </div>
    </footer>
  );
}
