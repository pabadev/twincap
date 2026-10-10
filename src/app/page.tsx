import { redirect } from "next/navigation";
import { getCurrentUser } from "@/infrastructure/auth/getCurrentUser";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Benefits } from "@/components/landing/benefits";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="landing-page min-h-screen flex-1 bg-slate-50 text-slate-900">
      <Hero />
      <Features />
      <Benefits />
      <Faq />
      <Footer />
    </main>
  );
}
