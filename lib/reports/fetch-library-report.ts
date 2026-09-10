import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCustomerIntelligence } from "@/lib/customers/fetch-customer-intelligence";
import { fetchExpensesPageData } from "@/lib/expenses/fetch-expenses";
import { fetchInventoryPageData } from "@/lib/inventory/fetch-inventory";
import { fetchMenuIntelligence } from "@/lib/menu/fetch-menu-intelligence";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import type { ReportGranularity } from "@/lib/reports/types";
import { fetchStaffPerformanceData } from "@/lib/staff/fetch-staff-performance";
import type { MenuItem } from "@/types/database";

export const LIBRARY_REPORT_IDS = [
  "daily_sales",
  "weekly_sales",
  "monthly_sales",
  "profitability",
  "employees",
  "customers",
  "expenses",
  "waste",
  "locations",
  "menu",
] as const;

export type LibraryReportId = (typeof LIBRARY_REPORT_IDS)[number];

export type LibraryTable = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
};

export type LibraryReportPayload = {
  id: LibraryReportId;
  title: string;
  tables: LibraryTable[];
};

function salesGranularity(id: LibraryReportId): ReportGranularity | null {
  if (id === "daily_sales") return "daily";
  if (id === "weekly_sales") return "weekly";
  if (id === "monthly_sales") return "monthly";
  return null;
}

export async function fetchLibraryReport(
  supabase: SupabaseClient,
  restaurantId: string,
  reportId: LibraryReportId
): Promise<LibraryReportPayload> {
  const salesG = salesGranularity(reportId);
  if (salesG) {
    const data = await fetchReportData(supabase, restaurantId, salesG, 0);
    return {
      id: reportId,
      title:
        reportId === "daily_sales"
          ? "Daily Sales"
          : reportId === "weekly_sales"
            ? "Weekly Sales"
            : "Monthly Sales",
      tables: [
        {
          title: "KPIs",
          headers: ["Metric", "Value"],
          rows: [
            ["Orders", data.kpi.total_orders],
            ["Revenue", data.kpi.total_revenue],
            ["Avg order value", data.kpi.avg_order_value],
            ["Items sold", data.kpi.items_sold],
            ["Top item", data.kpi.top_item_name ?? "—"],
          ],
        },
        {
          title: "Top items",
          headers: ["Item", "Qty", "Revenue"],
          rows: data.topItems.map((i) => [i.item_name, i.quantity_sold, i.revenue]),
        },
        {
          title: "Payment split",
          headers: ["Method", "Orders", "Revenue"],
          rows: data.paymentSplit.map((p) => [p.payment_method, p.order_count, p.revenue]),
        },
      ],
    };
  }

  if (reportId === "profitability" || reportId === "expenses") {
    const data = await fetchExpensesPageData(supabase, restaurantId);
    return {
      id: reportId,
      title: reportId === "profitability" ? "Profitability" : "Expenses",
      tables: [
        {
          title: "P&L summary",
          headers: ["Metric", "Value"],
          rows: [
            ["Revenue", data.waterfall.revenue],
            ["COGS", data.waterfall.cogs],
            ["Labor", data.waterfall.labor],
            ["Operating", data.waterfall.operating],
            ["Est. profit", data.waterfall.estProfit],
            ["Gross margin %", data.margins.grossMarginPct ?? "—"],
            ["Net margin %", data.margins.netMarginPct ?? "—"],
            ["Month expenses", data.monthExpenseTotal],
            ["Prev month expenses", data.prevMonthExpenseTotal],
          ],
        },
        {
          title: "Expense lines (this month)",
          headers: ["Date", "Category", "Amount", "Note"],
          rows: data.expenses.map((e) => [
            e.date,
            e.category,
            e.amount,
            e.note ?? "",
          ]),
        },
      ],
    };
  }

  if (reportId === "employees") {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("restaurant_id", restaurantId)
      .in("role", ["waiter", "kitchen", "cashier", "manager"]);
    const perf = await fetchStaffPerformanceData(supabase, restaurantId, staff ?? []);
    return {
      id: reportId,
      title: "Employees",
      tables: [
        {
          title: "Staff performance (30 days)",
          headers: ["Name", "Role", "Sales", "Orders", "Hours", "Attendance %"],
          rows: perf.rows.map((r) => [
            r.name,
            r.role,
            r.salesAttributed ?? "—",
            r.ordersAttributed ?? "—",
            r.hoursWorked,
            r.attendancePct,
          ]),
        },
      ],
    };
  }

  if (reportId === "customers") {
    const data = await fetchCustomerIntelligence(supabase, restaurantId);
    return {
      id: reportId,
      title: "Customers",
      tables: [
        {
          title: "Summary",
          headers: ["Metric", "Value"],
          rows: [
            ["Total customers", data.totalCustomers],
            ["New this month", data.newThisMonth],
            ["Returning", data.returningCount],
            ["Avg spend", data.avgSpend],
            ["Returning sales %", data.returningSalesPct ?? "—"],
            ["VIP", data.segments.vip],
            ["Regular", data.segments.regular],
            ["New", data.segments.new],
            ["At risk", data.segments.at_risk],
            ["Ratings total", data.feedback.total],
            ["Positive (4–5)", data.feedback.positive],
            ["Neutral (3)", data.feedback.neutral],
            ["Negative (1–2)", data.feedback.negative],
          ],
        },
        {
          title: "Top products",
          headers: ["Product", "Qty", "Revenue"],
          rows: data.topProducts.map((p) => [p.name, p.quantity, p.revenue]),
        },
      ],
    };
  }

  if (reportId === "waste") {
    const data = await fetchInventoryPageData(supabase, restaurantId);
    return {
      id: reportId,
      title: "Waste",
      tables: [
        {
          title: "Waste this month",
          headers: ["Date", "Item", "Amount", "Loss USD", "Note"],
          rows:
            data.wasteThisMonth.length > 0
              ? data.wasteThisMonth.map((w) => [
                  w.date,
                  w.productName,
                  w.amount,
                  w.lossUsd,
                  w.note ?? "",
                ])
              : [["—", "No waste logged", "—", data.monthlyWasteTotal, ""]],
        },
      ],
    };
  }

  if (reportId === "menu") {
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId);
    const intel = await fetchMenuIntelligence(
      supabase,
      restaurantId,
      (menuItems ?? []) as MenuItem[]
    );
    return {
      id: reportId,
      title: "Menu",
      tables: [
        {
          title: "Classifications",
          headers: ["Item", "Class", "Units", "Margin %", "Est. profit"],
          rows: intel.items.map((i) => [
            i.name,
            i.classification,
            i.unitsSold,
            i.marginPct,
            i.estProfit,
          ]),
        },
        {
          title: "Summary",
          headers: ["Metric", "Value"],
          rows: [
            ["Has cost prices", intel.hasCostPrices ? "yes" : "no"],
            ["Stars", intel.counts.stars],
            ["Sellers", intel.counts.sellers],
            ["High profit", intel.counts.high_profit],
            ["Slow", intel.counts.slow],
            ["Most ordered", intel.summary.mostOrdered?.name ?? "—"],
            ["Most profitable", intel.summary.mostProfitable?.name ?? "—"],
          ],
        },
      ],
    };
  }

  // locations — placeholder table; comparison lives in Locations tab
  return {
    id: "locations",
    title: "Locations",
    tables: [
      {
        title: "Note",
        headers: ["Info"],
        rows: [["Use the Locations tab for live multi-branch comparison."]],
      },
    ],
  };
}
