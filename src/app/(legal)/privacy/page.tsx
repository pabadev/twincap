import type { Metadata } from 'next';
import { getLocale, getT } from '@/i18n/server';
import { legalEs } from '@/content/legal/es';
import { legalEn } from '@/content/legal/en';
import { LegalPage } from '@/components/legal/legal-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('Metadata');
  return {
    title: t('privacyTitle'),
    description: t('privacyDescription'),
  };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const document = locale === 'en' ? legalEn.privacy : legalEs.privacy;

  return <LegalPage document={document} />;
}
