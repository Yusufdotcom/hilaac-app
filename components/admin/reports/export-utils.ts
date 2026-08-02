"use client";

/**
 * =============================================================================
 * STOP — Excel / xlsx security gate (H8 accepted risk)
 * =============================================================================
 * This file may GENERATE .xlsx downloads only (book_new → json_to_sheet → writeFile).
 *
 * If you are adding a feature that parses/reads user-uploaded .xlsx files, STOP —
 * this changes the risk profile that made accepting CVE-2023-30533 and
 * CVE-2024-22363 safe. Re-evaluate before proceeding: patch (SheetJS CDN ≥0.20.2),
 * swap to ExcelJS, or otherwise mitigate.
 *
 * See docs/SECURITY-RECORD.md → H8.
 * =============================================================================
 */

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ExportOrderRow, ReportData } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils";
import { formatDateRangeLabel } from "@/lib/reports/timeframes";

const NAVY: [number, number, number] = [15, 23, 42];

async function captureChart(id: string): Promise<string | null> {
  const el = document.getElementById(id);
  if (!el) return null;
  const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
  return canvas.toDataURL("image/png");
}

async function fetchOrders(slug: string, start: string, end: string, limit?: number) {
  const params = new URLSearchParams({ slug, startDate: start, endDate: end });
  if (limit) params.set("limit", String(limit));
  const res = await fetch(`/api/admin/reports/orders?${params.toString()}`);
  if (!res.ok) {
    console.error("[reports] fetchOrders failed", { slug, start, end, status: res.status });
    throw new Error("Failed to fetch orders for export");
  }
  const json = (await res.json()) as { orders: ExportOrderRow[] };
  return json.orders;
}

export async function exportReportsPdf(options: {
  slug: string;
  restaurantName: string;
  data: ReportData;
  isPro: boolean;
}) {
  const { slug, restaurantName, data } = options;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const rangeLabel = formatDateRangeLabel(data.meta.startDate, data.meta.endDate);
  const pageW = doc.internal.pageSize.getWidth();

  // Cover
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 120, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("Hilaac Insights", 40, 48);
  doc.setFontSize(14);
  doc.text(restaurantName, 40, 72);
  doc.setFontSize(11);
  doc.text(rangeLabel, 40, 94);

  doc.setTextColor(...NAVY);
  doc.setFontSize(13);
  doc.text("Key performance", 40, 150);
  autoTable(doc, {
    startY: 160,
    head: [["Metric", "Value"]],
    body: [
      ["Total Orders", String(data.kpi.total_orders)],
      ["Total Revenue", formatCurrency(data.kpi.total_revenue)],
      ["Avg Order Value", formatCurrency(data.kpi.avg_order_value)],
      [
        "Top Selling Item",
        `${data.kpi.top_item_name} (${data.kpi.top_item_quantity} sold)`,
      ],
    ],
    headStyles: { fillColor: NAVY },
  });

  const chartSections: { id: string; title: string }[] = [
    { id: "chart-revenue", title: "Revenue trend" },
    { id: "chart-top-items", title: "Top 10 items" },
    { id: "chart-payment-split", title: "Payment split" },
    { id: "chart-waiter-performance", title: "Waiter performance" },
  ];

  for (const section of chartSections) {
    const img = await captureChart(section.id);
    if (!img) continue;
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(...NAVY);
    doc.text(section.title, 40, 40);
    doc.addImage(img, "PNG", 40, 55, 515, 260);
  }

  if (data.spikedItems.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Trending / Spiked", 40, 40);
    autoTable(doc, {
      startY: 50,
      head: [["Item", "Qty Sold", "Previous", "Growth %"]],
      body: data.spikedItems.map((i) => [
        i.item_name,
        String(i.quantity_sold),
        String(i.previous_quantity),
        `+${i.growth_percent}%`,
      ]),
      headStyles: { fillColor: NAVY },
    });
  }

  const orders = await fetchOrders(slug, data.meta.startDate, data.meta.endDate, 501);
  const truncated = orders.length > 500;
  const rows = orders.slice(0, 500);

  doc.addPage();
  doc.setFontSize(14);
  doc.text("Order logs", 40, 40);
  if (truncated) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Showing most recent 500 orders (truncated).", 40, 54);
    doc.setTextColor(...NAVY);
  }
  autoTable(doc, {
    startY: truncated ? 62 : 50,
    head: [["Order ID", "Date", "Table", "Total", "Payment", "Status"]],
    body: rows.map((o) => [
      o.id.slice(0, 8),
      new Date(o.created_at).toLocaleString(),
      o.table_number ?? "—",
      formatCurrency(o.total),
      o.payment_method?.toUpperCase() ?? "Cash",
      o.status,
    ]),
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 8 },
  });

  doc.save(`${restaurantName.replace(/\s+/g, "-").toLowerCase()}-insights.pdf`);
}

/** Export insights workbook. Write-only SheetJS usage — do not add file parsing here. */
export async function exportReportsExcel(options: {
  slug: string;
  restaurantName: string;
  data: ReportData;
  isPro: boolean;
}) {
  const { slug, restaurantName, data } = options;
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.revenue.map((r) => ({
        Period: r.period_label,
        Orders: r.order_count,
        Revenue: Number(r.revenue),
      }))
    ),
    "Revenue Breakdown"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.topItems.map((i, idx) => ({
        Rank: idx + 1,
        Item: i.item_name,
        "Qty Sold": Number(i.quantity_sold) || 0,
        Revenue: Number(i.revenue),
      }))
    ),
    "Top Items"
  );

  const orders = await fetchOrders(slug, data.meta.startDate, data.meta.endDate);
  const orderRows = orders.map((o) => ({
    "Order ID": o.id,
    Date: new Date(o.created_at).toLocaleString(),
    Table: o.table_number ?? "—",
    Total: o.total,
    "Payment Method": o.payment_method?.toUpperCase() ?? "Cash",
    Status: o.status,
    "Delivered By": o.delivered_by ?? "—",
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), "Order Logs");

  XLSX.writeFile(wb, `${restaurantName.replace(/\s+/g, "-").toLowerCase()}-insights.xlsx`);
}
