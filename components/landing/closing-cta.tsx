"use client";

import Link from "next/link";
import { HealthScoreDemo } from "@/components/landing/health-score-demo";
import { Reveal } from "@/components/landing/reveal";

export function ClosingCtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-hilaac-gold/15 px-4 py-20 sm:px-6 sm:py-28">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.12),transparent_60%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-[900px] flex-col items-center text-center">
        <Reveal>
          <h2 className="font-elegant text-3xl font-semibold text-hilaac-white sm:text-4xl lg:text-5xl">
            Your restaurant. Your data. Your decisions.
          </h2>
          <p className="mt-4 font-brand text-sm font-semibold uppercase tracking-[0.25em] text-hilaac-gold sm:text-base">
            Start free. No card required.
          </p>
        </Reveal>

        <Reveal delay={0.12}>
          <Link
            href="/signup"
            className="landing-btn-gold mt-10 inline-flex h-14 min-w-[16rem] items-center justify-center px-10 text-base"
          >
            Start free trial
          </Link>
          <p className="mt-4 font-ui text-sm text-hilaac-offwhite/65">
            Join restaurants in Mogadishu and Hargeisa already using Hilaac
          </p>
        </Reveal>

        <Reveal delay={0.2} className="mt-10 w-full max-w-sm">
          <HealthScoreDemo />
        </Reveal>
      </div>
    </section>
  );
}
