import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { LandingHeader } from "@/components/landing/landing-header";
import { WatchDemoButton } from "@/components/landing/watch-demo-button";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { ComparePlansSection } from "@/components/landing/compare-plans-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { PLANS } from "@/lib/constants";
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
      {/* Hero — full viewport */}
      <section className="landing-hero relative flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-4 pb-20 pt-28 text-center sm:min-h-screen sm:px-6 sm:pb-32 sm:pt-36 md:pt-40 lg:pt-48">
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

        <div className="landing-hero-content relative z-10 mx-auto w-full max-w-4xl px-1">
          <h1 className="landing-display text-white">Hilaac</h1>
          <p className="landing-subtitle mx-auto mt-6 max-w-2xl text-center sm:mt-10">
            Run your restaurant smarter with QR ordering, real-time kitchen dashboards, and
            AI-powered menus.
          </p>
          <div className="mx-auto mt-10 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:mt-16 sm:max-w-none sm:flex-row sm:items-center sm:gap-5">
            <Link href="/signup" className="landing-btn-gold-lg">
              Start Free Trial
            </Link>
            <WatchDemoButton />
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

      {/* Pricing anchor */}
      <section id="pricing" className="border-t border-white/10 px-4 py-16 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Simple pricing
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#94A3B8] sm:mt-4 sm:text-lg">
            7-day free trial. No credit card required.
          </p>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 sm:gap-8">
            {Object.entries(PLANS).map(([key, plan]) => (
              <div
                key={key}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-[#D4A373]/30 sm:p-8"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-[#D4A373] sm:text-sm">
                  {plan.name}
                </p>
                <p className="mt-2 text-3xl font-bold text-white sm:text-4xl">{plan.priceLabel}</p>
                <p className="mt-3 text-[#94A3B8]">{plan.description}</p>
                <ul className="mt-8 space-y-3">
                  {plan.features.slice(0, 4).map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A373]" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="landing-btn-gold mt-8 w-full">
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>

          <ComparePlansSection />
        </div>
      </section>

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
