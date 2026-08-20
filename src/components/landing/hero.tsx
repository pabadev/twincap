'use client';

import Link from 'next/link';
import { useT } from '@/i18n/client';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';

export function Hero() {
  const t = useT('Landing');

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-8">
            <Logo variant="logotipo" size="lg" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            TwinCap
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-indigo-100 sm:text-xl">
            {t('heroSubtitle')}
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/register">
              <Button variant="primary" size="lg" className="bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg">
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
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent dark:from-zinc-950" />
    </section>
  );
}
