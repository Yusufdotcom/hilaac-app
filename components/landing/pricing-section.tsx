"use client";

import Link from "next/link";
import { Check, Plane } from "lucide-react";
import { motion } from "framer-motion";
import { ComparePlansSection } from "@/components/landing/compare-plans-section";
import { Reveal } from "@/components/landing/reveal";
import { LANDING_PLAN_KEYS, PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Bird silhouette — grows from ground-bound to soaring across tiers. */
function TierBird({ stage }: { stage: 0 | 1 | 2 | 3 }) {
  const sizes = [18, 22, 26, 32];
  const lifts = [0, -4, -10, -16];
  const s = sizes[stage];
  return (
    <motion.div
      className="mb-3 flex justify-center text-hilaac-gold"
      initial={false}
      animate={{ y: lifts[stage], scale: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      aria-hidden="true"
    >
      <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor">
        <path d="M4 18c6-2 10-8 12-14 1 5 4 9 10 11-4 1-7 4-8 8-3-3-7-4-14-5zm14 2c2 3 5 5 9 6-3-4-5-8-6-12-1 2-2 4-3 6z" />
      </svg>
    </motion.div>
  );
}

function PlanCta() {
  return (
    <Link href="/signup" className="landing-btn-gold mt-8 w-full">
      Start Free Trial
    </Link>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-hilaac-gold/10 px-4 py-16 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <h2 className="text-center font-elegant text-3xl font-semibold text-hilaac-white sm:text-4xl lg:text-5xl">
            Plans for every stage
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center font-brand text-sm tracking-[0.2em] text-hilaac-gold sm:mt-4 sm:text-base">
            Goronyo · Gorgor · Galeyr · Somali Airlines
          </p>
          <p className="mx-auto mt-2 max-w-lg text-center font-ui text-sm text-hilaac-offwhite/65">
            From the ground to the sky — grow with Hilaac. 7-day free trial on standard plans.
          </p>
        </Reveal>

        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
          {LANDING_PLAN_KEYS.map((key, index) => {
            const plan = PLANS[key];
            const premium = key === "somali_airlines";
            const popular = key === "gorgor";
            const stage = index as 0 | 1 | 2 | 3;

            return (
              <Reveal key={key} delay={index * 0.1}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border p-6 transition-colors sm:p-7",
                    premium && "landing-sa-card border-transparent bg-[#070E1A]",
                    popular &&
                      "z-10 -translate-y-2 border-hilaac-gold/50 bg-hilaac-gold/10 shadow-[0_0_40px_rgba(201,168,76,0.18)] ring-1 ring-hilaac-gold/30",
                    !premium &&
                      !popular &&
                      "border-hilaac-gold/25 bg-hilaac-navy-mid/60 hover:border-hilaac-gold/40"
                  )}
                >
                  {premium ? <div className="landing-sa-shimmer" aria-hidden="true" /> : null}

                  {popular ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-hilaac-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-hilaac-navy">
                      Most popular
                    </span>
                  ) : null}

                  <TierBird stage={stage} />

                  {premium ? (
                    <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-hilaac-gold/40 bg-hilaac-gold/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-hilaac-gold">
                      <Plane className="h-3.5 w-3.5" aria-hidden="true" />
                      Enterprise
                    </span>
                  ) : null}

                  <p className="font-brand text-xs font-semibold uppercase tracking-wider text-hilaac-gold sm:text-sm">
                    {plan.name}
                  </p>
                  <p className="mt-2 font-brand text-3xl font-extrabold text-hilaac-white sm:text-4xl">
                    {plan.priceLabel}
                  </p>
                  <p className="mt-3 font-ui text-sm leading-relaxed text-hilaac-offwhite/70">
                    {plan.description}
                  </p>

                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.slice(0, premium ? 6 : 4).map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-2 font-ui text-sm text-hilaac-offwhite/75"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-hilaac-gold"
                          aria-hidden="true"
                        />
                        {feat}
                      </li>
                    ))}
                  </ul>

                  <PlanCta />
                </div>
              </Reveal>
            );
          })}
        </div>

        <ComparePlansSection />
      </div>
    </section>
  );
}
