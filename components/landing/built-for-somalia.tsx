"use client";

import { Reveal } from "@/components/landing/reveal";
import {
  IconAiInsights,
  IconKitchenDisplay,
  IconQrOrdering,
  IconRealtimeReports,
  IconSecurePayments,
} from "@/components/landing/brand-feature-icons";

const BULLETS = [
  "EVC Plus payments",
  "eDahab payments",
  "M-Pesa ready flows",
  "Somali language throughout",
  "Ramadan package management",
  "Diaspora remote ownership",
  "Deyn (credit customer) ledger",
] as const;

const ICON_FEATURES = [
  { label: "QR Ordering", desc: "Guests order from the table", Icon: IconQrOrdering },
  { label: "Kitchen Display", desc: "Tickets hit the line instantly", Icon: IconKitchenDisplay },
  { label: "Real Time Reports", desc: "Know today before tomorrow", Icon: IconRealtimeReports },
  { label: "AI Insights", desc: "Ask in Somali or English", Icon: IconAiInsights },
  { label: "Secure Payments", desc: "EVC · eDahab · Deyn", Icon: IconSecurePayments },
] as const;

const PINS = [
  { name: "Mogadishu", x: 58, y: 72, delay: 0.15 },
  { name: "Hargeisa", x: 48, y: 38, delay: 0.35 },
  { name: "Nairobi", x: 42, y: 88, delay: 0.55 },
] as const;

export function BuiltForSomaliaSection() {
  return (
    <section className="relative overflow-hidden border-t border-hilaac-gold/10 px-4 py-16 sm:px-6 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-hilaac-navy via-hilaac-navy-mid/80 to-hilaac-navy" />

      <div className="relative mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <h2 className="font-elegant text-3xl font-semibold text-hilaac-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              The only system built for how Somali restaurants actually work
            </h2>
            <p className="mt-3 font-ui text-sm text-hilaac-offwhite/70 sm:text-base">
              <span className="text-hilaac-gold">Nidaamka kaliya ee loo dhisay</span> sida
              makhaayadaha Soomaaliyeed u shaqeeyaan — English + Soomaali.
            </p>
          </Reveal>

          <ul className="mt-8 space-y-3">
            {BULLETS.map((b, i) => (
              <Reveal key={b} delay={i * 0.06}>
                <li className="flex items-center gap-3 font-ui text-sm text-hilaac-offwhite sm:text-base">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-hilaac-gold" />
                  {b}
                </li>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={0.4}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <p className="font-ui text-xs uppercase tracking-wider text-hilaac-gold-pale/60">
                Powered by
              </p>
              {["EVC Plus", "eDahab", "M-Pesa"].map((name) => (
                <span
                  key={name}
                  className="rounded-lg border border-hilaac-gold/35 bg-hilaac-gold/10 px-3 py-1.5 font-brand text-xs font-semibold tracking-wide text-hilaac-gold-light shadow-[0_0_20px_rgba(201,168,76,0.15)]"
                >
                  {name}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md lg:max-w-none">
            {/* Horn of Africa silhouette (decorative) */}
            <svg
              viewBox="0 0 200 260"
              className="absolute inset-0 h-full w-full text-hilaac-gold/20"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M110 18c18 6 38 22 48 48 8 20 6 42-4 62 12 8 22 22 24 38 2 18-6 34-20 44 4 14-2 30-16 38-10 6-24 6-34-2-8 16-24 28-44 28-22 0-40-14-46-34-10-4-18-14-18-28 0-12 6-22 16-28-8-14-10-32-4-48 8-22 28-36 50-40 6-18 22-32 48-38z"
                opacity="0.35"
              />
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                d="M108 22c16 5 34 20 44 44 7 18 5 38-4 56m20 10c10 7 18 18 20 32 2 14-4 28-16 36m-8 8c-8 14-22 24-40 24-18 0-34-10-40-26m-12-8c-8-3-14-12-14-22 0-10 5-18 13-23m-6-10c-6-12-8-28-2-42 7-18 24-30 44-34"
              />
            </svg>

            {PINS.map((pin) => (
              <div
                key={pin.name}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              >
                <span className="landing-map-pin relative flex h-3.5 w-3.5 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-hilaac-gold/40" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-hilaac-gold shadow-[0_0_12px_rgba(201,168,76,0.8)]" />
                </span>
                <span className="mt-1.5 whitespace-nowrap rounded-md border border-hilaac-gold/25 bg-hilaac-navy/90 px-2 py-0.5 font-ui text-[10px] font-medium text-hilaac-gold-pale">
                  {pin.name}
                </span>
              </div>
            ))}

            <div className="absolute bottom-0 left-0 right-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ICON_FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2.5 rounded-xl border border-hilaac-gold/20 bg-hilaac-navy/85 px-3 py-2 backdrop-blur-sm"
                >
                  <f.Icon className="h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-brand text-xs font-semibold text-hilaac-white">
                      {f.label}
                    </p>
                    <p className="truncate font-ui text-[10px] text-hilaac-offwhite/60">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
