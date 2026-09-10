import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppDayBounds } from "@/lib/time/app-calendar";
import {
  buildPerformanceRows,
  type StaffPerformanceRow,
  type StaffShift,
} from "@/lib/staff/staff-performance";

export type StaffPerformanceData = {
  rows: StaffPerformanceRow[];
  shifts: StaffShift[];
};

export async function fetchStaffPerformanceData(
  supabase: SupabaseClient,
  restaurantId: string,
  staff: { id: string; full_name: string | null; role: string; is_active: boolean }[]
): Promise<StaffPerformanceData> {
  const { start } = getAppDayBounds(-29);
  const { end } = getAppDayBounds(0);

  const [waiterRes, shiftsRes] = await Promise.all([
    supabase.rpc("get_waiter_performance", {
      p_restaurant_id: restaurantId,
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
    }),
    supabase
      .from("staff_shifts")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  if (waiterRes.error) {
    console.error("[staff-perf] get_waiter_performance", waiterRes.error.message);
  }
  if (shiftsRes.error) {
    console.error("[staff-perf] staff_shifts", shiftsRes.error.message);
  }

  const waiterPerf = ((waiterRes.data as unknown[]) ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      waiter_name: String(row.waiter_name ?? "Unknown"),
      deliveries: Number(row.deliveries ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });

  const shifts = (shiftsRes.data ?? []) as StaffShift[];

  return {
    rows: buildPerformanceRows({ staff, waiterPerf, shifts }),
    shifts,
  };
}
