import Link from "next/link";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { SocialProofBar } from "@/components/landing/social-proof-bar";
import { ProblemSection } from "@/components/landing/problem-section";
import { OrderManageGrowSection } from "@/components/landing/order-manage-grow";
import { BuiltForSomaliaSection } from "@/components/landing/built-for-somalia";
import { PricingSection } from "@/components/landing/pricing-section";
import { ClosingCtaSection } from "@/components/landing/closing-cta";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginPath } from "@/lib/admin/resolve-user-restaurant";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dashboardHref: string | null = null;

  if (user) {
    dashboardHref = await getPostLoginPath(supabase, user.id);
  }

  return (
    <div className="landing-page min-h-screen overflow-x-clip">
      <LandingHeader dashboardHref={dashboardHref} />
      <LandingHero />
      <SocialProofBar />
      <ProblemSection />
      <OrderManageGrowSection />
      <BuiltForSomaliaSection />
      <PricingSection />
      <ClosingCtaSection />

      <footer className="border-t border-hilaac-gold/10 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 sm:flex-row sm:gap-6">
          <p className="font-ui text-sm text-hilaac-offwhite/55">
            &copy; {new Date().getFullYear()} Hilaac. All rights reserved.
          </p>
          <div className="flex items-center gap-8 text-sm">
            <Link
              id="privacy"
              href="#"
              className="text-hilaac-offwhite/55 transition-colors duration-200 hover:text-hilaac-gold"
            >
              Privacy
            </Link>
            <Link
              id="terms"
              href="#"
              className="text-hilaac-offwhite/55 transition-colors duration-200 hover:text-hilaac-gold"
            >
              Terms
            </Link>
          </div>
        </div>
        <PoweredByHilaac variant="dark" className="mt-8" />
      </footer>
    </div>
  );
}
