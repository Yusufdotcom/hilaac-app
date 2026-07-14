import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/constants";

type ComparisonRow = {
  feature: string;
  starter: string | boolean;
  pro: string | boolean;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "Table Limit", starter: "Up to 15 tables", pro: "Unlimited tables" },
  { feature: "Kitchen Display", starter: "1 screen", pro: "Unlimited screens" },
  { feature: "USSD Payments (Manual)", starter: true, pro: true },
  { feature: "API Auto-Pay (Automatic)", starter: false, pro: true },
  { feature: "AI Image Generator", starter: false, pro: true },
  { feature: "Staff Accounts", starter: "1 (Owner only)", pro: "Unlimited staff" },
  { feature: "Waiter Performance Tracking", starter: false, pro: true },
  { feature: "Real-time Kitchen & Waiter Dashboards", starter: true, pro: true },
  { feature: "QR Code Ordering", starter: true, pro: true },
  { feature: "Custom Branding", starter: false, pro: true },
  { feature: "Priority Support", starter: false, pro: true },
];

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <CheckCircle2 className="mx-auto h-5 w-5 text-[#D4A373]" aria-label="Included" />
    ) : (
      <XCircle className="mx-auto h-5 w-5 text-[#64748B]" aria-label="Not included" />
    );
  }

  return <span className="text-sm leading-snug text-[#94A3B8]">{value}</span>;
}

function MobilePlanCard({
  planKey,
  planName,
  priceLabel,
  highlight,
}: {
  planKey: "starter" | "pro";
  planName: string;
  priceLabel: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border p-5 sm:p-6",
        highlight
          ? "border-[#D4A373]/50 bg-[#D4A373]/10 pt-8 ring-1 ring-[#D4A373]/30"
          : "border-white/10 bg-white/5"
      )}
    >
      {highlight && (
        <span className="absolute left-1/2 top-20 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#D4A373] px-3 py-1 text-xs font-semibold text-[#0F172A] shadow-md">
          Most Popular
        </span>
      )}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#D4A373]">{planName}</p>
          <p className="mt-1 text-2xl font-bold text-white">{priceLabel}</p>
        </div>
      </div>

      <ul className="space-y-4">
        {COMPARISON_ROWS.map((row) => {
          const value = row[planKey];
          return (
            <li key={row.feature} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-white">{row.feature}</p>
              <div className="mt-2 flex items-center gap-2">
                {typeof value === "boolean" ? (
                  <>
                    {value ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4A373]" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden="true" />
                    )}
                    <span className="text-sm text-[#94A3B8]">{value ? "Included" : "Not included"}</span>
                  </>
                ) : (
                  <span className="text-sm text-[#94A3B8]">{value}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {highlight && (
        <Link href="/signup" className="landing-btn-gold mt-6 w-full">
          Upgrade to Pro
        </Link>
      )}
    </div>
  );
}

export function ComparePlansSection() {
  return (
    <div className="mx-auto mt-16 max-w-5xl sm:mt-20">
      <div className="text-center">
        <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Compare plans</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[#94A3B8] sm:text-base">
          See exactly what you get with Starter vs Pro — side by side.
        </p>
      </div>

      {/* Mobile: stacked plan cards */}
      <div className="mt-8 grid grid-cols-1 gap-8 md:hidden">
        <MobilePlanCard
          planKey="starter"
          planName={PLANS.starter.name}
          priceLabel={PLANS.starter.priceLabel}
        />
        <MobilePlanCard
          planKey="pro"
          planName={PLANS.pro.name}
          priceLabel={PLANS.pro.priceLabel}
          highlight
        />
      </div>

      {/* Desktop: comparison table */}
      <div className="relative mt-8 hidden overflow-visible rounded-2xl border border-white/10 bg-[#0F172A] pt-5 shadow-xl shadow-black/20 md:block">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-[#1E293B]/80">
                <th className="p-5 text-sm font-semibold text-[#94A3B8]">Feature</th>
                <th className="p-5 text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#D4A373]">
                    {PLANS.starter.name}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">{PLANS.starter.priceLabel}</p>
                </th>
                <th className="relative bg-[#D4A373]/10 p-5 pt-6 text-center ring-1 ring-inset ring-[#D4A373]/30">
                  <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#D4A373] px-3 py-1 text-xs font-semibold text-[#0F172A] shadow-md">
                    Most Popular
                  </span>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wider text-[#D4A373]">
                    {PLANS.pro.name}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">{PLANS.pro.priceLabel}</p>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, index) => (
                <tr
                  key={row.feature}
                  className={cn(
                    "border-b border-white/5 transition-colors hover:bg-white/[0.02]",
                    index % 2 === 1 && "bg-white/[0.02]"
                  )}
                >
                  <td className="p-5 text-sm font-medium text-white">{row.feature}</td>
                  <td className="p-5 text-center">
                    <ComparisonCell value={row.starter} />
                  </td>
                  <td className="bg-[#D4A373]/5 p-5 text-center">
                    <ComparisonCell value={row.pro} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className="p-5" />
                <td className="p-5 text-center">
                  <Link href="/signup" className="landing-btn-ghost-lg inline-flex h-11 min-w-0 px-6 text-sm">
                    Start Free Trial
                  </Link>
                </td>
                <td className="bg-[#D4A373]/5 p-5 text-center">
                  <Link href="/signup" className="landing-btn-gold inline-flex h-11 min-w-0 px-6 text-sm">
                    Upgrade to Pro
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
