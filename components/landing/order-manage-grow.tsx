"use client";

import { Reveal } from "@/components/landing/reveal";
import {
  IconAiInsights,
  IconKitchenDisplay,
  IconQrOrdering,
} from "@/components/landing/brand-feature-icons";

const PILLARS = [
  {
    title: "ORDER",
    Icon: IconQrOrdering,
    body: "QR code on every table. Customers order from their phone. Kitchen sees it immediately. Zero hardware required.",
    bullets: ["Table QR ordering", "Live kitchen tickets", "No tablets to buy"],
  },
  {
    title: "MANAGE",
    Icon: IconKitchenDisplay,
    body: "Kitchen, Waiter, and Cashier dashboards all live. Staff performance tracked. Inventory monitored. Deyn (credit) customers managed. All in one system.",
    bullets: ["Kitchen · Waiter · Cashier", "Inventory + Deyn ledger", "Staff performance"],
  },
  {
    title: "GROW",
    Icon: IconAiInsights,
    body: "AI chatbot answers \"how's my business?\" in Somali or English. Menu profitability matrix. Customer re-engagement. Daily WhatsApp briefing every morning.",
    bullets: ["AI chatbot (SO / EN)", "Menu profitability", "Daily WhatsApp briefing"],
  },
] as const;

export function OrderManageGrowSection() {
  return (
    <section id="features" className="border-t border-hilaac-gold/10 bg-hilaac-navy-mid/40 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <p className="text-center font-elegant text-2xl tracking-[0.35em] text-hilaac-gold sm:text-3xl">
            ORDER. MANAGE. GROW.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-center font-ui text-sm text-hilaac-offwhite/70 sm:text-base">
            Three pillars. One platform built for how Somali restaurants actually run.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 0.1}>
              <article className="flex h-full flex-col rounded-2xl border border-hilaac-gold/20 bg-hilaac-navy/80 p-6 sm:p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-hilaac-gold/30 bg-hilaac-gold/10">
                  <pillar.Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-brand text-xl font-extrabold tracking-wide text-hilaac-white">
                  {pillar.title}
                </h3>
                <p className="mt-3 flex-1 font-ui text-sm leading-relaxed text-hilaac-offwhite/75">
                  {pillar.body}
                </p>
                <ul className="mt-5 space-y-2 border-t border-hilaac-gold/15 pt-4">
                  {pillar.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 font-ui text-sm text-hilaac-gold-pale/90">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-hilaac-gold" />
                      {b}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
