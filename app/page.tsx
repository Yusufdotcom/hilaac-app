import Link from "next/link";
import Image from "next/image";
import { Check, QrCode, ChefHat, Sparkles } from "lucide-react";
import { LandingHeader } from "@/components/landing/landing-header";
import { WatchDemoButton } from "@/components/landing/watch-demo-button";
import { PLANS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginPath } from "@/lib/admin/resolve-user-restaurant";

const FEATURES = [
  {
    icon: QrCode,
    title: "QR Ordering",
    description: "Customers scan, browse, and order from their phone — no app required.",
  },
  {
    icon: ChefHat,
    title: "Kitchen Display",
    description: "Real-time tickets from New → Preparing → Ready with one tap.",
  },
  {
    icon: Sparkles,
    title: "AI Menu",
    description: "Generate mouth-watering dish photos for your menu in seconds.",
  },
];

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
    <div className="landing-page min-h-screen">
      <LandingHeader dashboardHref={dashboardHref} />
      {/* Hero — full viewport */}
      <section className="landing-hero relative flex min-h-screen flex-col items-center justify-center px-6 pb-32 pt-36 text-center sm:pt-40 lg:pt-48">
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

        <div className="landing-hero-content relative z-10 mx-auto max-w-4xl">
          <h1 className="landing-display text-white">Hilaac</h1>
          <p className="landing-subtitle mx-auto mt-10 max-w-2xl text-center">
            Run your restaurant smarter with QR ordering, real-time kitchen dashboards, and
            AI-powered menus.
          </p>
          <div className="mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <Link href="/signup" className="landing-btn-gold-lg">
              Start Free Trial
            </Link>
            <WatchDemoButton />
          </div>
        </div>
      </section>

      {/* Product showcase */}
      <section id="showcase" className="px-6 py-20">
        <div className="mx-auto max-w-[1200px] text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            The complete restaurant OS.
          </h2>
          <p className="landing-subtitle mx-auto mt-4 max-w-2xl">
            One platform for your customers, your kitchen, and your staff.
          </p>
          <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] p-2 shadow-2xl shadow-hilaac-gold/20 sm:p-3">
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

      {/* Features anchor */}
      <section id="features" className="border-t border-white/10 px-6 py-28">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built for modern restaurants
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed text-[#94A3B8]">
            Everything you need to take orders, run the kitchen, and get paid — in one platform.
          </p>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-8 transition-colors hover:border-[#D4A373]/40"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4A373]/15 text-[#D4A373]">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-white">{f.title}</h3>
                <p className="mt-3 leading-relaxed text-[#94A3B8]">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing anchor */}
      <section id="pricing" className="border-t border-white/10 px-6 py-28">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Simple pricing
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-[#94A3B8]">
            7-day free trial. No credit card required.
          </p>
          <div className="mx-auto mt-16 grid max-w-3xl gap-8 sm:grid-cols-2">
            {Object.entries(PLANS).map(([key, plan]) => (
              <div
                key={key}
                className="rounded-2xl border border-white/10 bg-white/5 p-8 transition-colors hover:border-[#D4A373]/30"
              >
                <p className="text-sm font-medium uppercase tracking-wider text-[#D4A373]">
                  {plan.name}
                </p>
                <p className="mt-2 text-4xl font-bold text-white">{plan.priceLabel}</p>
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
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-12">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 sm:flex-row">
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
      </footer>
    </div>
  );
}
