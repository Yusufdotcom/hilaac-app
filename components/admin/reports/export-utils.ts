"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ExportOrderRow, ReportData } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils";
import { formatDateRangeLabel } from "@/lib/reports/timeframes";

const NAVY: [number, number, number] = [15, 23, 42];
const GOLD: [number, number, number] = [212, 163, 115];

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
  if (!res.ok) throw new Error("Failed to fetch orders for export");
  const json = (await res.json()) as { orders: ExportOrderRow[] };
  return json.orders;
}

export async function exportReportsPdf(options: {
  slug: string;
  restaurantName: string;
  data: ReportData;
  isPro: boolean;
}) {
  const { slug, restaurantName, data, isPro } = options;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const rangeLabel = formatDateRangeLabel(data.meta.startDate, data.meta.endDate);

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("Hilaac Analytics Report", 40, 45);
  doc.setFontSize(11);
  doc.text(restaurantName, 40, 62);
  doc.text(rangeLabel, 40, 76);

  doc.setTextColor(...NAVY);
  doc.setFontSize(12);
  doc.text(`Total Revenue: ${formatCurrency(data.kpi.total_revenue)}`, 40, 110);
  doc.text(`Total Orders: ${data.kpi.total_orders}`, 40, 128);
  doc.text(`AOV: ${formatCurrency(data.kpi.avg_order_value)}`, 40, 146);
  doc.text(`Top Item: ${data.kpi.top_item_name}`, 40, 164);

  if (isPro) {
    const chartIds = [
      "chart-revenue",
      "chart-top-items",
      "chart-peak-hours",
      "chart-payment-split",
      "chart-waiter-performance",
    ];

    for (const chartId of chartIds) {
      const img = await captureChart(chartId);
      if (!img) continue;
      doc.addPage();
      doc.setFontSize(14);
      doc.text(chartId.replace("chart-", "").replace(/-/g, " "), 40, 40);
      doc.addImage(img, "PNG", 40, 55, 515, 260);
    }

    doc.addPage();
    doc.setFontSize(14);
    doc.text("Least ordered items", 40, 40);
    autoTable(doc, {
      startY: 50,
      head: [["Item", "Qty Sold", "Revenue"]],
      body: data.leastItems.map((i) => [
        i.item_name,
        String(i.quantity_sold),
        formatCurrency(Number(i.revenue)),
      ]),
      headStyles: { fillColor: NAVY },
    });

    const orders = await fetchOrders(slug, data.meta.startDate, data.meta.endDate, 501);
    const truncated = orders.length > 500;
    const rows = orders.slice(0, 500);

    doc.addPage();
    doc.setFontSize(14);
    doc.text("Recent orders", 40, 40);
    if (truncated) {
      doc.setFontSize(10);
      doc.text("Showing most recent 500 orders (truncated).", 40, 54);
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
  } else {
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Top 5 items", 40, 40);
    autoTable(doc, {
      startY: 50,
      head: [["Item", "Qty Sold"]],
      body: data.topItems.slice(0, 5).map((i) => [i.item_name, String(i.quantity_sold)]),
      headStyles: { fillColor: NAVY },
    });
  }

  doc.save(`${restaurantName.replace(/\s+/g, "-").toLowerCase()}-report.pdf`);
}

export async function exportReportsExcel(options: {
  slug: string;
  restaurantName: string;
  data: ReportData;
  isPro: boolean;
}) {
  const { slug, restaurantName, data, isPro } = options;
  const wb = XLSX.utils.book_new();

  const orders = await fetchOrders(
    slug,
    data.meta.startDate,
    data.meta.endDate,
    isPro ? undefined : 1001
  );
  const truncated = !isPro && orders.length > 1000;
  const orderRows = (isPro ? orders : orders.slice(0, 1000)).map((o) => ({
    "Order ID": o.id,
    Date: new Date(o.created_at).toLocaleString(),
    Table: o.table_number ?? "—",
    Total: o.total,
    "Payment Method": o.payment_method?.toUpperCase() ?? "Cash",
    Status: o.status,
    "Delivered By": o.delivered_by ?? "—",
  }));

  if (truncated) {
    orderRows.push({
      "Order ID": "NOTE",
      Date: "Export capped at 1,000 most recent orders.",
      Table: "",
      Total: 0,
      "Payment Method": "",
      Status: "",
      "Delivered By": "",
    });
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), "Orders");

  if (isPro) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        data.revenue.map((r) => ({
          Period: r.period_label,
          Orders: r.order_count,
          Revenue: Number(r.revenue),
        }))
      ),
      "Revenue"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        data.topItems.map((i, idx) => ({
          Rank: idx + 1,
          Item: i.item_name,
          "Qty Sold": i.quantity_sold,
          Revenue: Number(i.revenue),
        }))
      ),
      "Top Items"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        data.peakHours.map((h) => ({
          Hour: `${String(h.hour_of_day).padStart(2, "0")}:00`,
          Orders: h.order_count,
          Revenue: Number(h.revenue),
        }))
      ),
      "Peak Hours"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        data.waiterPerformance.map((w) => ({
          Waiter: w.waiter_name,
          Deliveries: w.deliveries,
          Revenue: Number(w.revenue),
        }))
      ),
      "Waiter Performance"
    );
  }

  XLSX.writeFile(wb, `${restaurantName.replace(/\s+/g, "-").toLowerCase()}-report.xlsx`);
}
