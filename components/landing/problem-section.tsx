"use client";

import { Reveal } from "@/components/landing/reveal";
import {
  IconAiInsights,
  IconKitchenDisplay,
  IconQrOrdering,
  IconRealtimeReports,
  IconSecurePayments,
} from "@/components/landing/brand-feature-icons";

const PAIN_POINTS = [
  {
    text: "You don't know which dish actually makes you money",
    Icon: IconRealtimeReports,
  },
  {
    text: "You find out ingredients ran out when the customer is already waiting",
    Icon: IconKitchenDisplay,
  },
  {
    text: "Your manager tells you what happened — you have no way to verify",
    Icon: IconAiInsights,
  },
  {
    text: "Payment collection is tracked in WhatsApp messages and notebooks",
    Icon: IconSecurePayments,
  },
  {
    text: "You discover problems after they've already cost you",
    Icon: IconQrOrdering,
  },
] as const;

export function ProblemSection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[900px]">
        <Reveal>
          <h2 className="text-center font-elegant text-3xl font-semibold text-hilaac-white sm:text-4xl lg:text-5xl">
            Running a restaurant in Somalia is hard enough.
          </h2>
        </Reveal>

        <ul className="mt-10 space-y-4 sm:mt-14">
          {PAIN_POINTS.map((item, i) => (
            <Reveal key={item.text} delay={i * 0.08}>
              <li className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3.5 sm:gap-4 sm:px-5">
                <span className="mt-0.5 font-brand text-sm font-bold text-red-400/90" aria-hidden="true">
                  ✕
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-ui text-sm leading-relaxed text-hilaac-offwhite sm:text-base">
                    {item.text}
                  </p>
                </div>
                <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hilaac-gold/20 bg-hilaac-navy-mid sm:flex">
                  <item.Icon className="h-4 w-4 opacity-70" />
                </span>
              </li>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.35}>
          <p className="mt-10 text-center font-brand text-sm font-semibold tracking-wide text-hilaac-gold sm:mt-12 sm:text-base">
            Hilaac fixes all five. From day one.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
