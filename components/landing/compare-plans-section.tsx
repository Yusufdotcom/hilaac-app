import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/constants";

type PlanKey = "goronyo" | "gorgor" | "galeyr";

type ComparisonRow = {
  feature: string;
  goronyo: string | boolean;
  gorgor: string | boolean;
  galeyr: string | boolean;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "QR ordering + staff dashboards", goronyo: true, gorgor: true, galeyr: true },
  { feature: "USSD payments (manual)", goronyo: true, gorgor: true, galeyr: true },
  { feature: "Loyalty + WhatsApp order alerts", goronyo: true, gorgor: true, galeyr: true },
  { feature: "Basic reports (Daily + Monthly)", goronyo: true, gorgor: true, galeyr: true },
  { feature: "Staff accounts", goronyo: "Up to 3", gorgor: "Unlimited", galeyr: "Unlimited" },
  { feature: "API auto-payment", goronyo: false, gorgor: true, galeyr: true },
  { feature: "AI menu image generator", goronyo: false, gorgor: true, galeyr: true },
  { feature: "Advanced reports + Insights", goronyo: false, gorgor: true, galeyr: true },
  { feature: "Recap email delivery", goronyo: false, gorgor: true, galeyr: true },
  { feature: "Multi-branch", goronyo: false, gorgor: true, galeyr: true },
  { feature: "AI Business Chatbot", goronyo: false, gorgor: false, galeyr: true },
  { feature: "Expenses / P&L", goronyo: false, gorgor: false, galeyr: true },
  { feature: "Staff + customer intelligence", goronyo: false, gorgor: false, galeyr: true },
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
  planKey: PlanKey;
  planName: string;
  priceLabel: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-visible rounded-2xl border p-5 sm:p-6",
        highlight
          ? "border-[#D4A373]/50 bg-[#D4A373]/10 ring-1 ring-[#D4A373]/30"
          : "border-white/10 bg-white/5"
      )}
    >
      {highlight && (
        <div className="mb-4 flex justify-center">
          <span className="z-20 whitespace-nowrap rounded-full bg-[#D4A373] px-3 py-1 text-xs font-semibold text-[#0F172A] shadow-md">
            Most Popular
          </span>
        </div>
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
          Start Free Trial
        </Link>
      )}
    </div>
  );
}

export function ComparePlansSection() {
  return (
    <div className="mx-auto mt-16 max-w-6xl sm:mt-20">
      <div className="text-center">
        <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Compare plans</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[#94A3B8] sm:text-base">
          Goronyo, Gorgor, and Galeyr side by side. Somali Airlines is custom — contact sales.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:hidden">
        <MobilePlanCard
          planKey="goronyo"
          planName={PLANS.goronyo.name}
          priceLabel={PLANS.goronyo.priceLabel}
        />
        <MobilePlanCard
          planKey="gorgor"
          planName={PLANS.gorgor.name}
          priceLabel={PLANS.gorgor.priceLabel}
          highlight
        />
        <MobilePlanCard
          planKey="galeyr"
          planName={PLANS.galeyr.name}
          priceLabel={PLANS.galeyr.priceLabel}
        />
      </div>

      <div className="relative mt-8 hidden overflow-visible rounded-2xl border border-white/10 bg-[#0F172A] shadow-xl shadow-black/20 lg:block">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-[#1E293B]/80">
                <th className="p-5 text-sm font-semibold text-[#94A3B8]">Feature</th>
                {(["goronyo", "gorgor", "galeyr"] as const).map((key) => (
                  <th
                    key={key}
                    className={cn(
                      "p-5 text-center",
                      key === "gorgor" &&
                        "overflow-visible bg-[#D4A373]/10 ring-1 ring-inset ring-[#D4A373]/30"
                    )}
                  >
                    {key === "gorgor" && (
                      <span className="relative z-20 mx-auto mb-3 inline-block whitespace-nowrap rounded-full bg-[#D4A373] px-3 py-1 text-xs font-semibold text-[#0F172A] shadow-md">
                        Most Popular
                      </span>
                    )}
                    <p className="text-xs font-medium uppercase tracking-wider text-[#D4A373]">
                      {PLANS[key].name}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-white">{PLANS[key].priceLabel}</p>
                  </th>
                ))}
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
                    <ComparisonCell value={row.goronyo} />
                  </td>
                  <td className="bg-[#D4A373]/5 p-5 text-center">
                    <ComparisonCell value={row.gorgor} />
                  </td>
                  <td className="p-5 text-center">
                    <ComparisonCell value={row.galeyr} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className="p-5" />
                {(["goronyo", "gorgor", "galeyr"] as const).map((key) => (
                  <td key={key} className="p-5 text-center">
                    <Link
                      href="/signup"
                      className={
                        key === "gorgor"
                          ? "landing-btn-gold inline-flex h-11 min-w-0 px-6 text-sm"
                          : "landing-btn-ghost-lg inline-flex h-11 min-w-0 px-6 text-sm"
                      }
                    >
                      Start Free Trial
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
