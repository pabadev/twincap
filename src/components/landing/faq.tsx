'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  { q: 'faq1Question', a: 'faq1Answer' },
  { q: 'faq2Question', a: 'faq2Answer' },
  { q: 'faq3Question', a: 'faq3Answer' },
  { q: 'faq4Question', a: 'faq4Answer' },
] as const;

export function Faq() {
  const t = useT('Landing');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-white py-20 dark:bg-zinc-950 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          {t('faqTitle')}
        </h2>
        <div className="mt-12 space-y-4">
          {FAQ_ITEMS.map(({ q, a }, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={q}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left text-base font-medium text-zinc-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                  aria-expanded={isOpen}
                >
                  <span>{t(q)}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {t(a)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
