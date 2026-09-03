import type { Metadata } from 'next';
import { getLocale, getT } from '@/i18n/server';
import { legalEs } from '@/content/legal/es';
import { legalEn } from '@/content/legal/en';
import { LegalPage } from '@/components/legal/legal-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('Metadata');
  return {
    title: t('termsTitle'),
    description: t('termsDescription'),
  };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const document = locale === 'en' ? legalEn.terms : legalEs.terms;

  return <LegalPage document={document} />;
}
