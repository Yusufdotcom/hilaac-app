"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2, Lock, Star } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { canUseFeature, type TierFeature } from "@/lib/billing/tier-capabilities";
import { downloadCsv, slugFilename } from "@/lib/reports/export-csv";
import type { LibraryReportId, LibraryReportPayload } from "@/lib/reports/fetch-library-report";
import { formatCurrency } from "@/lib/utils";

type CardDef = {
  id: LibraryReportId | "suppliers";
  title: string;
  blurb: string;
  gate?: TierFeature;
  hidden?: boolean;
};

const CARDS: CardDef[] = [
  { id: "daily_sales", title: "Daily Sales", blurb: "Today’s orders, revenue, and top items." },
  {
    id: "weekly_sales",
    title: "Weekly Sales",
    blurb: "Last 7 days KPIs and payment mix.",
    gate: "advanced_reports",
  },
  { id: "monthly_sales", title: "Monthly Sales", blurb: "Trailing 30-day sales snapshot." },
  {
    id: "profitability",
    title: "Profitability",
    blurb: "Revenue, COGS, and estimated profit.",
    gate: "expenses_pnl",
  },
  {
    id: "employees",
    title: "Employees",
    blurb: "Staff sales and hours (30 days).",
    gate: "staff_performance",
  },
  {
    id: "customers",
    title: "Customers",
    blurb: "Segments, feedback, and top products.",
    gate: "customer_intelligence",
  },
  {
    id: "expenses",
    title: "Expenses",
    blurb: "This month’s expense lines and totals.",
    gate: "expenses_pnl",
  },
  {
    id: "waste",
    title: "Waste",
    blurb: "Logged waste losses this month.",
    gate: "inventory",
  },
  {
    id: "suppliers",
    title: "Suppliers",
    blurb: "Not available yet — no supplier records.",
    hidden: true,
  },
  {
    id: "locations",
    title: "Locations",
    blurb: "Use the Locations tab for live comparison.",
    gate: "multi_branch_comparison",
  },
  {
    id: "menu",
    title: "Menu",
    blurb: "Item classifications and margins.",
    gate: "menu_profitability",
  },
];

function moneyish(header: string, value: string | number) {
  if (typeof value !== "number") return String(value);
  if (/revenue|amount|spend|profit|loss|cogs|total|sales|avg/i.test(header)) {
    return formatCurrency(value);
  }
  return String(value);
}

function exportLibraryPdf(restaurantName: string, payload: LibraryReportPayload) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(payload.title, 40, 40);
  doc.setFontSize(11);
  doc.text(restaurantName, 40, 58);

  let y = 80;
  for (const table of payload.tables) {
    doc.setFontSize(12);
    doc.text(table.title, 40, y);
    autoTable(doc, {
      startY: y + 8,
      head: [table.headers],
      body: table.rows.map((row) =>
        row.map((cell, i) => moneyish(table.headers[i] ?? "", cell))
      ),
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 9 },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 28;
    if (y > 720) {
      doc.addPage();
      y = 40;
    }
  }

  doc.save(slugFilename(restaurantName, `${payload.id}.pdf`));
}

function exportLibraryCsv(restaurantName: string, payload: LibraryReportPayload) {
  const flatHeaders = ["Section", "Field", "Value", "Extra"];
  const flatRows: (string | number)[][] = [];
  for (const table of payload.tables) {
    for (const row of table.rows) {
      flatRows.push([
        table.title,
        String(row[0] ?? ""),
        row[1] ?? "",
        row.slice(2).join(" | "),
      ]);
    }
  }
  downloadCsv(slugFilename(restaurantName, `${payload.id}.csv`), flatHeaders, flatRows);
}

export function ReportsLibrary({
  slug,
  subscriptionTier,
}: {
  slug: string;
  subscriptionTier: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(reportId: LibraryReportId) {
    const res = await fetch("/api/admin/reports/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, reportId }),
    });
    const json = (await res.json()) as {
      data?: LibraryReportPayload;
      restaurantName?: string;
      error?: string;
    };
    if (!res.ok || !json.data) throw new Error(json.error || "Failed to load report");
    return { data: json.data, restaurantName: json.restaurantName || "Restaurant" };
  }

  async function handleExport(reportId: LibraryReportId, format: "pdf" | "csv") {
    setBusyId(`${reportId}-${format}`);
    try {
      const { data, restaurantName } = await load(reportId);
      if (format === "pdf") exportLibraryPdf(restaurantName, data);
      else exportLibraryCsv(restaurantName, data);
      toast.success(`${data.title} ${format.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusyId(null);
    }
  }

  const visible = CARDS.filter((c) => !c.hidden);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-muted,#64748B)]">
        Downloadable report packs — separate from the live Insights view. Every figure comes from
        your live data.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => {
          const locked = Boolean(
            card.gate && !canUseFeature(subscriptionTier, card.gate)
          );
          return (
            <div
              key={card.id}
              className="flex flex-col rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
                  {card.title}
                </h3>
                {locked ? (
                  <Lock className="h-4 w-4 text-[var(--admin-muted,#64748B)]" aria-hidden="true" />
                ) : null}
              </div>
              <p className="mt-1 flex-1 text-xs text-[var(--admin-muted,#64748B)]">{card.blurb}</p>
              {locked ? (
                <p className="mt-3 text-xs text-[var(--admin-muted,#64748B)]">
                  Upgrade required for this report.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId !== null || card.id === "suppliers"}
                    className="gap-1.5"
                    onClick={() =>
                      void handleExport(card.id as LibraryReportId, "pdf")
                    }
                  >
                    {busyId === `${card.id}-pdf` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId !== null || card.id === "suppliers"}
                    className="gap-1.5"
                    onClick={() =>
                      void handleExport(card.id as LibraryReportId, "csv")
                    }
                  >
                    {busyId === `${card.id}-csv` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                    CSV
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-[var(--admin-muted,#64748B)]">
        <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
        Suppliers report is hidden until supplier records exist.
      </p>
    </div>
  );
}
