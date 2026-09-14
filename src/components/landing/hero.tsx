'use client';

import Link from 'next/link';
import { useT } from '@/i18n/client';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';

export function Hero() {
  const t = useT('Landing');

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-teal via-brand-teal to-brand-gold">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      {/* Contrast scrim: keeps white copy AA-compliant over the brand gradient
          (DEC-DS-03 §2.4 — brand tokens only, no raw indigo/zinc). */}
      <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-8">
            <Logo variant="logotipo" size="lg" />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl">
            {t('heroSubtitle')}
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/register">
              <Button variant="inverse" size="lg" className="shadow-lg">
                {t('heroCta')}
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="lg" className="text-white hover:bg-white/10">
                {t('login')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
