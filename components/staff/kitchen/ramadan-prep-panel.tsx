import { Moon } from "lucide-react";
import type { KitchenPrepData } from "@/lib/somali-airlines/season-ops";

export function RamadanPrepPanel({ prep }: { prep: KitchenPrepData }) {
  const label = prep.season === "eid" ? "Eid" : "Ramadan";

  return (
    <section className="mb-4 rounded-2xl border border-[#D4A373]/30 bg-[#0F172A] p-4 text-white sm:p-5">
      <div className="flex items-center gap-2">
        <Moon className="h-4 w-4 text-[#D4A373]" aria-hidden="true" />
        <h2 className="text-sm font-bold tracking-wide">
          Tonight&apos;s {label} package prep — {prep.date}
        </h2>
      </div>

      {prep.normal.length === 0 && prep.buffet.length === 0 ? (
        <p className="mt-3 text-sm text-slate-300">No active packages for this season.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {prep.normal.map((row) => (
            <div
              key={row.packageName}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <p className="font-semibold">
                {row.packageName}{" "}
                <span className="text-sm font-normal text-[#D4A373]">× {row.count} checked in</span>
              </p>
              {row.mealType ? (
                <p className="mt-0.5 text-xs capitalize text-slate-400">{row.mealType}</p>
              ) : null}
              {row.items.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-slate-200">
                  {row.items.map((item) => (
                    <li key={item}>• {item} × {row.count}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-400">No menu lines set on this package.</p>
              )}
            </div>
          ))}

          {prep.buffet.map((row) => (
            <div
              key={row.packageName}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <p className="font-semibold">{row.packageName} (Buffet)</p>
              {row.window ? (
                <p className="mt-0.5 text-xs text-slate-400">Window: {row.window}</p>
              ) : null}
              <p className="mt-2 text-sm text-slate-200">
                Passes sold: {row.passesSold}
                {row.maxCapacity != null ? ` · Cap ${row.maxCapacity}` : ""}
              </p>
              <p className="text-sm text-[#D4A373]">
                Checked in tonight: {row.checkedIn}
                {row.maxCapacity != null
                  ? ` · ${Math.max(0, row.maxCapacity - row.checkedIn)} spots left`
                  : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
