import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCustomerIntelligence } from "@/lib/customers/fetch-customer-intelligence";
import { fetchExpensesPageData } from "@/lib/expenses/fetch-expenses";
import { fetchInventoryPageData } from "@/lib/inventory/fetch-inventory";
import { fetchMenuIntelligence } from "@/lib/menu/fetch-menu-intelligence";
import { fetchStaffPerformanceData } from "@/lib/staff/fetch-staff-performance";
import type { ReportGranularity } from "@/lib/reports/types";
import { getDateRange, fillRevenueBuckets } from "@/lib/reports/timeframes";
import { getAppDayBounds } from "@/lib/time/app-calendar";
import type { MenuItem } from "@/types/database";

const timeframeSchema = z
  .enum(["daily", "weekly", "monthly"])
  .describe("daily = today, weekly = last 7 days, monthly = last 30 days");

function rpcWindow(granularity: ReportGranularity, restaurantId: string) {
  const { start, end } = getDateRange(granularity, 0);
  return {
    p_restaurant_id: restaurantId,
    p_start_date: start.toISOString(),
    p_end_date: end.toISOString(),
    label: `${granularity} (${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)})`,
  };
}

function mapKpi(row: Record<string, unknown> | undefined) {
  return {
    total_orders: Number(row?.total_orders ?? 0) || 0,
    total_revenue: Number(row?.total_revenue ?? 0) || 0,
    avg_order_value: Number(row?.avg_order_value ?? row?.average_order_value ?? 0) || 0,
  };
}

function mapItems(rows: unknown[]) {
  return (rows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      item_name: String(row.item_name ?? row.name ?? "Unknown"),
      quantity_sold: Number(row.quantity_sold ?? row.quantity ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });
}

/**
 * AI tools that answer exclusively from live restaurant queries / RPCs.
 * Every figure returned here is from the database for this restaurant only.
 */
export function buildChatbotTools(supabase: SupabaseClient, restaurantId: string) {
  return {
    getKPISummary: tool({
      description: "Get orders, revenue, and average order value for a timeframe.",
      inputSchema: z.object({ timeframe: timeframeSchema }),
      execute: async ({ timeframe }) => {
        const win = rpcWindow(timeframe, restaurantId);
        const { data, error } = await supabase.rpc("get_kpi_summary", {
          p_restaurant_id: win.p_restaurant_id,
          p_start_date: win.p_start_date,
          p_end_date: win.p_end_date,
        });
        if (error) {
          console.error("[chatbot] get_kpi_summary", error.message);
          return { error: error.message, window: win.label };
        }
        const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
        return { window: win.label, ...mapKpi(row), source: "get_kpi_summary" };
      },
    }),

    getRevenueTrend: tool({
      description: "Get daily revenue and order counts for the last N days.",
      inputSchema: z.object({
        days: z.number().int().min(3).max(30).describe("Number of trailing days (3–30)"),
      }),
      execute: async ({ days }) => {
        const { end } = getAppDayBounds(0);
        const { start } = getAppDayBounds(-(days - 1));
        const params = {
          p_restaurant_id: restaurantId,
          p_start_date: start.toISOString(),
          p_end_date: end.toISOString(),
          p_granularity: "daily" as const,
        };
        const { data, error } = await supabase.rpc("get_revenue_by_period", params);
        if (error) {
          console.error("[chatbot] get_revenue_by_period", error.message);
          return { error: error.message, source: "get_revenue_by_period" };
        }
        const buckets = fillRevenueBuckets(
          ((data as unknown[]) ?? []).map((raw) => {
            const row = raw as Record<string, unknown>;
            return {
              period_start: String(row.period_start ?? ""),
              period_label: String(row.period_label ?? ""),
              order_count: Number(row.order_count ?? 0) || 0,
              revenue: Number(row.revenue ?? 0) || 0,
            };
          }),
          start,
          end,
          "daily"
        );
        return {
          days,
          buckets: buckets.map((b) => ({
            label: b.period_label,
            orders: b.order_count,
            revenue: b.revenue,
          })),
          source: "get_revenue_by_period",
        };
      },
    }),

    getTopItems: tool({
      description: "Get best-selling menu items by quantity for a timeframe.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(15).default(5),
        timeframe: timeframeSchema.default("weekly"),
      }),
      execute: async ({ limit, timeframe }) => {
        const win = rpcWindow(timeframe, restaurantId);
        const { data, error } = await supabase.rpc("get_top_items", {
          p_restaurant_id: win.p_restaurant_id,
          p_start_date: win.p_start_date,
          p_end_date: win.p_end_date,
          p_limit: limit,
        });
        if (error) {
          console.error("[chatbot] get_top_items", error.message);
          return { error: error.message, window: win.label };
        }
        return {
          window: win.label,
          items: mapItems(data ?? []).slice(0, limit),
          source: "get_top_items",
        };
      },
    }),

    getPeakHours: tool({
      description: "Get busiest hours of day for a timeframe.",
      inputSchema: z.object({ timeframe: timeframeSchema.default("weekly") }),
      execute: async ({ timeframe }) => {
        const win = rpcWindow(timeframe, restaurantId);
        const { data, error } = await supabase.rpc("get_peak_hours", {
          p_restaurant_id: win.p_restaurant_id,
          p_start_date: win.p_start_date,
          p_end_date: win.p_end_date,
        });
        if (error) {
          console.error("[chatbot] get_peak_hours", error.message);
          return { error: error.message, window: win.label };
        }
        const hours = ((data as unknown[]) ?? [])
          .map((raw) => {
            const row = raw as Record<string, unknown>;
            return {
              hour_of_day: Number(row.hour_of_day ?? 0),
              order_count: Number(row.order_count ?? 0) || 0,
              revenue: Number(row.revenue ?? 0) || 0,
            };
          })
          .sort((a, b) => b.order_count - a.order_count)
          .slice(0, 8);
        return { window: win.label, peak_hours: hours, source: "get_peak_hours" };
      },
    }),

    getPaymentSplit: tool({
      description: "Get payment method mix (EVC, eDahab, Cash) for a timeframe.",
      inputSchema: z.object({ timeframe: timeframeSchema.default("monthly") }),
      execute: async ({ timeframe }) => {
        const win = rpcWindow(timeframe, restaurantId);
        const { data, error } = await supabase.rpc("get_payment_split", {
          p_restaurant_id: win.p_restaurant_id,
          p_start_date: win.p_start_date,
          p_end_date: win.p_end_date,
        });
        if (error) {
          console.error("[chatbot] get_payment_split", error.message);
          return { error: error.message, window: win.label };
        }
        const split = ((data as unknown[]) ?? []).map((raw) => {
          const row = raw as Record<string, unknown>;
          const method = String(row.payment_method ?? "CASH").toUpperCase();
          return {
            payment_method:
              method === "EDAHAB" ? "eDahab" : method === "EVC" ? "EVC" : method === "CASH" ? "Cash" : method,
            order_count: Number(row.order_count ?? 0) || 0,
            revenue: Number(row.revenue ?? 0) || 0,
          };
        });
        return { window: win.label, split, source: "get_payment_split" };
      },
    }),

    getMenuProfitability: tool({
      description: "Get menu item profitability classifications (stars, sellers, high margin, slow).",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: menuItems, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", restaurantId);
        if (error) {
          console.error("[chatbot] menu_items", error.message);
          return { error: error.message, source: "menu_items" };
        }
        const result = await fetchMenuIntelligence(
          supabase,
          restaurantId,
          (menuItems ?? []) as MenuItem[]
        );
        return {
          hasCostPrices: result.hasCostPrices,
          counts: result.counts,
          summary: result.summary,
          topItems: result.items.slice(0, 8).map((i) => ({
            name: i.name,
            classification: i.classification,
            unitsSold: i.unitsSold,
            marginPct: i.marginPct,
            estProfit: i.estProfit,
          })),
          source: "fetchMenuIntelligence",
        };
      },
    }),

    getInventorySummary: tool({
      description: "Get inventory KPIs, low-stock items, and waste this month.",
      inputSchema: z.object({}),
      execute: async () => {
        const data = await fetchInventoryPageData(supabase, restaurantId);
        return {
          kpis: data.kpis,
          reorderNeeded: data.actionRows.slice(0, 10).map((r) => ({
            name: r.name,
            status: r.status,
            onHand: r.current_stock,
            reorderAt: r.reorder_level,
          })),
          monthlyWasteTotal: data.monthlyWasteTotal,
          wasteTrendingUp: data.wasteTrendingUp,
          source: "fetchInventoryPageData",
        };
      },
    }),

    getExpensesPnL: tool({
      description: "Get this month's expense total, category mix, and P&L margins.",
      inputSchema: z.object({}),
      execute: async () => {
        const data = await fetchExpensesPageData(supabase, restaurantId);
        return {
          monthExpenseTotal: data.monthExpenseTotal,
          prevMonthExpenseTotal: data.prevMonthExpenseTotal,
          expenseDeltaPct: data.expenseDeltaPct,
          waterfall: data.waterfall,
          margins: data.margins,
          insightCategory: data.insightCategory,
          source: "fetchExpensesPageData",
        };
      },
    }),

    getStaffPerformance: tool({
      description: "Get staff / waiter performance for the last 30 days.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: staff, error } = await supabase
          .from("profiles")
          .select("id, full_name, role, is_active")
          .eq("restaurant_id", restaurantId)
          .in("role", ["waiter", "kitchen", "cashier", "manager"]);
        if (error) {
          console.error("[chatbot] staff profiles", error.message);
          return { error: error.message, source: "profiles" };
        }
        const perf = await fetchStaffPerformanceData(supabase, restaurantId, staff ?? []);
        return {
          rows: perf.rows.slice(0, 15).map((r) => ({
            name: r.name,
            role: r.role,
            salesAttributed: r.salesAttributed,
            ordersAttributed: r.ordersAttributed,
            hoursWorked: r.hoursWorked,
            attendancePct: r.attendancePct,
          })),
          source: "get_waiter_performance + staff_shifts",
        };
      },
    }),

    getCustomerIntelligence: tool({
      description: "Get customer segments, feedback ratings, and top products by guests.",
      inputSchema: z.object({}),
      execute: async () => {
        const data = await fetchCustomerIntelligence(supabase, restaurantId);
        return {
          totalCustomers: data.totalCustomers,
          newThisMonth: data.newThisMonth,
          returningCount: data.returningCount,
          avgSpend: data.avgSpend,
          segments: data.segments,
          returningSalesPct: data.returningSalesPct,
          feedback: data.feedback,
          topProducts: data.topProducts.slice(0, 8),
          source: "fetchCustomerIntelligence",
        };
      },
    }),
  };
}

export type ChatbotTools = ReturnType<typeof buildChatbotTools>;
