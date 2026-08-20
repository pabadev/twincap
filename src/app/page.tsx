import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Benefits } from '@/components/landing/benefits';
import { Faq } from '@/components/landing/faq';
import { Footer } from '@/components/landing/footer';

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Features />
      <Benefits />
      <Faq />
      <Footer />
    </main>
  );
}
