"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

const STATS = [
  { label: "Restaurants live", value: 3, prefix: "", suffix: "+" },
  { label: "Orders processed", value: 12480, prefix: "", suffix: "+" },
  { label: "Revenue tracked", value: 186, prefix: "$", suffix: "k+" },
] as const;

function AnimatedStat({
  value,
  prefix = "",
  suffix = "",
  label,
  active,
  reduce,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  active: boolean;
  reduce: boolean;
}) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) => {
    const n = Math.round(v);
    return `${prefix}${n.toLocaleString()}${suffix}`;
  });

  useEffect(() => {
    if (reduce) {
      motionValue.set(value);
      return;
    }
    motionValue.set(active ? value : 0);
  }, [active, value, motionValue, reduce]);

  return (
    <div className="text-center">
      <motion.p className="font-brand text-2xl font-extrabold tabular-nums text-hilaac-gold sm:text-3xl">
        {display}
      </motion.p>
      <p className="mt-1 font-ui text-xs text-hilaac-offwhite/65 sm:text-sm">{label}</p>
    </div>
  );
}

export function SocialProofBar() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion() === true;

  return (
    <section
      ref={ref}
      className="border-y border-hilaac-gold/15 bg-hilaac-navy-mid px-4 py-10 sm:px-6 sm:py-12"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-8">
        <p className="max-w-2xl text-center font-ui text-sm text-hilaac-offwhite/80 sm:text-base">
          Trusted by restaurants in{" "}
          <span className="font-semibold text-hilaac-gold">Mogadishu</span>
          {" · "}
          <span className="font-semibold text-hilaac-gold">Hargeisa</span>
          {" · and beyond"}
        </p>
        <div className="grid w-full max-w-3xl grid-cols-3 gap-4 sm:gap-8">
          {STATS.map((s) => (
            <AnimatedStat
              key={s.label}
              value={s.value}
              prefix={s.prefix}
              suffix={s.suffix}
              label={s.label}
              active={inView}
              reduce={reduce}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
