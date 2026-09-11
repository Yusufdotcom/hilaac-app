"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { WatchDemoButton } from "@/components/landing/watch-demo-button";
import { HealthScoreDemo } from "@/components/landing/health-score-demo";
import {
  IconAiInsights,
  IconKitchenDisplay,
  IconQrOrdering,
  IconRealtimeReports,
  IconSecurePayments,
} from "@/components/landing/brand-feature-icons";

const DashboardScene = dynamic(
  () => import("./dashboard-scene").then((m) => m.DashboardScene),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-[300px] w-full overflow-hidden rounded-xl sm:h-[380px] lg:h-[440px]">
        <Image
          src="/marketing/hilaac-dashboard.png"
          alt="Hilaac admin dashboard"
          fill
          className="object-cover object-top opacity-90"
          sizes="(max-width: 1024px) 100vw, 560px"
          priority
        />
      </div>
    ),
  }
);

const FEATURES = [
  { label: "QR Ordering", Icon: IconQrOrdering },
  { label: "Kitchen Display", Icon: IconKitchenDisplay },
  { label: "Real Time Reports", Icon: IconRealtimeReports },
  { label: "AI Insights", Icon: IconAiInsights },
  { label: "Secure Payments", Icon: IconSecurePayments },
] as const;

export function LandingHero() {
  const reduceMotion = useReducedMotion();

  const fade = reduceMotion
    ? undefined
    : {
        initial: { opacity: 0, y: 28 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <section className="landing-hero relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center overflow-hidden px-4 pb-12 pt-28 sm:min-h-screen sm:px-6 sm:pb-16 sm:pt-36 md:pt-40 lg:pt-44">
      <div className="landing-hero-bg pointer-events-none" aria-hidden="true">
        <div className="landing-hero-mesh" />
        <div className="landing-hero-particles" />
      </div>

      <div className="landing-hero-content relative z-10 mx-auto grid w-full max-w-[1240px] items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10">
        <motion.div className="text-center lg:text-left" {...fade}>
          <p className="font-brand text-[11px] font-semibold uppercase tracking-[0.3em] text-hilaac-gold">
            Hilaac — Smart Restaurant Solution
          </p>
          <h1 className="mt-4 font-brand text-4xl font-extrabold tracking-tight text-hilaac-white sm:text-5xl lg:text-[3.75rem] lg:leading-[1.05]">
            Business intelligence
            <br className="hidden sm:block" /> built for Somali restaurants
          </h1>
          <p className="mt-5 font-elegant text-lg tracking-[0.4em] text-hilaac-gold sm:text-xl">
            ORDER. MANAGE. GROW.
          </p>
          <p className="mx-auto mt-5 max-w-xl font-ui text-base leading-relaxed text-hilaac-offwhite sm:text-lg lg:mx-0">
            QR ordering, live kitchen ops, and AI answers on profits, stock, and customers — in one
            platform.
          </p>
          <div className="mx-auto mt-8 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start lg:gap-4">
            <Link href="/signup" className="landing-btn-gold-lg">
              Start free trial
            </Link>
            <WatchDemoButton label="See how it works →" />
          </div>
          <p className="mt-4 text-xs text-hilaac-gold-pale/70 sm:text-sm">
            7-day free trial. No credit card required.
          </p>
        </motion.div>

        <motion.div
          className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none lg:justify-self-end"
          {...(reduceMotion
            ? {}
            : {
                initial: { opacity: 0, y: 36 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] as const },
              })}
        >
          {/* Real loaded Hilaac dashboard — product preview for advertisers */}
          <div className="relative lg:-mb-10 lg:translate-x-3 xl:translate-x-6">
            {reduceMotion ? (
              <div className="relative aspect-[14/9] w-full overflow-hidden rounded-xl border border-hilaac-gold/30 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)]">
                <Image
                  src="/marketing/hilaac-dashboard.png"
                  alt="Hilaac restaurant dashboard — live orders, revenue, and kitchen ops"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 100vw, 640px"
                  priority
                />
              </div>
            ) : (
              <DashboardScene textureUrl="/marketing/hilaac-dashboard.png" />
            )}
          </div>

          <div className="relative z-10 mx-auto mt-3 w-full max-w-[17rem] sm:absolute sm:bottom-2 sm:left-0 sm:mx-0 sm:mt-0 sm:w-[15.5rem] lg:-bottom-2">
            <HealthScoreDemo className="shadow-xl shadow-black/40" />
          </div>
        </motion.div>
      </div>

      <motion.div
        className="landing-hero-content relative z-10 mx-auto mt-16 w-full max-w-[1240px] sm:mt-20 lg:mt-24"
        {...(reduceMotion
          ? {}
          : {
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] as const },
            })}
      >
        <ul className="flex flex-wrap items-center justify-center gap-y-4 lg:justify-between">
          {FEATURES.map(({ label, Icon }, i) => (
            <li key={label} className="flex items-center">
              {i > 0 ? (
                <span
                  className="mx-3 hidden h-8 w-px bg-hilaac-gold/35 lg:mx-4 lg:block"
                  aria-hidden="true"
                />
              ) : null}
              <div className="flex items-center gap-2.5 px-2 sm:px-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-hilaac-gold/30 bg-hilaac-navy-mid/60">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-ui text-xs font-medium text-hilaac-white sm:text-sm">
                  {label}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
