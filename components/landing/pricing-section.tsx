import Link from "next/link";
import { Check, Plane } from "lucide-react";
import { ComparePlansSection } from "@/components/landing/compare-plans-section";
import { LANDING_PLAN_KEYS, PLANS, type LandingPlanKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

function PlanCta({ planKey }: { planKey: LandingPlanKey }) {
  if (planKey === "somali_airlines") {
    return (
      <a href="mailto:sales@hilaac.so" className="landing-btn-gold mt-8 w-full">
        Contact Sales
      </a>
    );
  }
  return (
    <Link href="/signup" className="landing-btn-gold mt-8 w-full">
      Start Free Trial
    </Link>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-white/10 px-4 py-16 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
          Plans for every stage
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-[#94A3B8] sm:mt-4 sm:text-lg">
          Goronyo · Gorgor · Galeyr · Somali Airlines. 7-day free trial on standard plans.
        </p>

        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
          {LANDING_PLAN_KEYS.map((key) => {
            const plan = PLANS[key];
            const premium = key === "somali_airlines";
            const popular = key === "gorgor";

            return (
              <div
                key={key}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 transition-colors sm:p-7",
                  premium
                    ? "border-[#D4A373]/50 bg-gradient-to-b from-[#0B1220] via-[#111827] to-[#1E293B] shadow-lg shadow-[#D4A373]/10"
                    : popular
                      ? "border-[#D4A373]/40 bg-[#D4A373]/10 ring-1 ring-[#D4A373]/25"
                      : "border-white/10 bg-white/5 hover:border-[#D4A373]/30"
                )}
              >
                {popular ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#D4A373] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0F172A]">
                    Most popular
                  </span>
                ) : null}
                {premium ? (
                  <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#D4A373]/40 bg-[#D4A373]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#D4A373]">
                    <Plane className="h-3.5 w-3.5" aria-hidden="true" />
                    Enterprise
                  </span>
                ) : null}

                <p className="text-xs font-medium uppercase tracking-wider text-[#D4A373] sm:text-sm">
                  {plan.name}
                </p>
                <p className="mt-2 text-3xl font-bold text-white sm:text-4xl">{plan.priceLabel}</p>
                <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{plan.description}</p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.slice(0, premium ? 6 : 4).map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A373]" aria-hidden="true" />
                      {feat}
                    </li>
                  ))}
                </ul>

                <PlanCta planKey={key} />
              </div>
            );
          })}
        </div>

        <ComparePlansSection />
      </div>
    </section>
  );
}
