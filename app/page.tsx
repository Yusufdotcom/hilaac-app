import Link from "next/link";
import Image from "next/image";
import { LandingHeader } from "@/components/landing/landing-header";
import { WatchDemoButton } from "@/components/landing/watch-demo-button";
import { HealthScoreDemo } from "@/components/landing/health-score-demo";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { FeaturesSection } from "@/components/landing/features-section";
import { PricingSection } from "@/components/landing/pricing-section";
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
    <div className="landing-page min-h-screen overflow-x-hidden">
      <LandingHeader dashboardHref={dashboardHref} />

      {/* Hero — BI positioning + Health Score demo */}
      <section className="landing-hero relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-4 pb-16 pt-28 sm:min-h-screen sm:px-6 sm:pb-24 sm:pt-36 md:pt-40 lg:pt-44">
        <div className="landing-hero-bg pointer-events-none" aria-hidden="true">
          <Image
            src="/dashboard-bg.png"
            alt=""
            fill
            priority
            className="landing-hero-bg__image"
            sizes="100vw"
          />
        </div>

        <div className="landing-hero-content relative z-10 mx-auto grid w-full max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4A373]">
              Hilaac
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Business intelligence built for Somali restaurants
            </h1>
            <p className="landing-subtitle mx-auto mt-5 max-w-xl lg:mx-0 lg:mt-6">
              QR ordering, live kitchen ops, and AI answers on profits, stock, and customers — in
              one platform.
            </p>
            <div className="mx-auto mt-8 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start lg:gap-4">
              <Link href="/signup" className="landing-btn-gold-lg">
                Start Free Trial
              </Link>
              <WatchDemoButton />
            </div>
            <p className="mt-4 text-xs text-[#64748B] sm:text-sm">
              7-day free trial. No credit card required.
            </p>
          </div>

          <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
            <HealthScoreDemo />
          </div>
        </div>
      </section>

      {/* Product showcase */}
      <section id="showcase" className="px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[1200px] text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-5xl">
            The complete restaurant OS.
          </h2>
          <p className="landing-subtitle mx-auto mt-3 max-w-2xl sm:mt-4">
            One platform for your customers, your kitchen, and your staff.
          </p>
          <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#1E293B] p-1.5 shadow-2xl shadow-hilaac-gold/20 sm:mt-12 sm:rounded-2xl sm:p-2 md:p-3">
            <Image
              src="/hero-mockup.png"
              alt="Hilaac restaurant dashboard mockup"
              width={1600}
              height={900}
              priority
              className="h-auto w-full rounded-xl"
              sizes="(max-width: 640px) 100vw, (max-width: 1200px) 90vw, 1152px"
            />
          </div>
        </div>
      </section>

      <FeaturesSection />
      <PricingSection />

      {/* Footer */}
      <footer className="border-t border-white/10 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 sm:flex-row sm:gap-6">
          <p className="text-sm text-[#94A3B8]">
            &copy; {new Date().getFullYear()} Hilaac. All rights reserved.
          </p>
          <div className="flex items-center gap-8 text-sm">
            <Link
              id="privacy"
              href="#"
              className="text-[#94A3B8] transition-colors duration-200 hover:text-white"
            >
              Privacy
            </Link>
            <Link
              id="terms"
              href="#"
              className="text-[#94A3B8] transition-colors duration-200 hover:text-white"
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
