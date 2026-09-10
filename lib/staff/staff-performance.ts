export type StaffShift = {
  id: string;
  restaurant_id: string;
  profile_id: string | null;
  staff_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
};

export type StaffPerformanceRow = {
  id: string;
  name: string;
  role: string;
  salesAttributed: number | null;
  ordersAttributed: number | null;
  hoursWorked: number;
  attendancePct: number;
  overtimeHours: number;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function dayLabel(dayOfWeek: number): string {
  return DAY_LABELS[((dayOfWeek % 7) + 7) % 7] ?? "Mon";
}

/** Hours between HH:MM / HH:MM:SS times (same calendar day). */
export function shiftHours(startTime: string, endTime: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const diff = toMin(endTime) - toMin(startTime);
  return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
}

export function buildPerformanceRows(args: {
  staff: { id: string; full_name: string | null; role: string; is_active: boolean }[];
  waiterPerf: { waiter_name: string; deliveries: number; revenue: number }[];
  shifts: Pick<StaffShift, "profile_id" | "staff_name" | "start_time" | "end_time" | "day_of_week">[];
}): StaffPerformanceRow[] {
  const active = args.staff.filter((s) => s.is_active !== false);

  return active.map((s) => {
    const name = s.full_name?.trim() || "Staff";
    const nameKey = name.toLowerCase();
    const match = args.waiterPerf.find(
      (w) => w.waiter_name.trim().toLowerCase() === nameKey
    );

    const mine = args.shifts.filter(
      (sh) =>
        sh.profile_id === s.id ||
        sh.staff_name.trim().toLowerCase() === nameKey
    );
    const hoursWorked = mine.reduce(
      (sum, sh) => sum + shiftHours(sh.start_time, sh.end_time),
      0
    );
    // Template week: attendance = share of days with at least one shift (scheduled presence).
    const daysWithShift = new Set(mine.map((sh) => sh.day_of_week)).size;
    const attendancePct =
      mine.length === 0 ? 0 : Math.round((daysWithShift / 7) * 1000) / 10;
    const overtimeHours = Math.max(0, Math.round((hoursWorked - 40) * 10) / 10);

    return {
      id: s.id,
      name,
      role: s.role,
      salesAttributed: match ? Number(match.revenue) || 0 : null,
      ordersAttributed: match ? Number(match.deliveries) || 0 : null,
      hoursWorked,
      attendancePct,
      overtimeHours,
    };
  });
}

export function groupShiftsByDay(
  shifts: StaffShift[]
): Record<number, StaffShift[]> {
  const out: Record<number, StaffShift[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };
  for (const sh of shifts) {
    const d = ((sh.day_of_week % 7) + 7) % 7;
    out[d] = [...(out[d] ?? []), sh];
  }
  for (const d of Object.keys(out)) {
    out[Number(d)]!.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  return out;
}

export function formatShiftRange(startTime: string, endTime: string): string {
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(":");
    let h = Number(hStr) || 0;
    const m = Number(mStr) || 0;
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
  };
  return `${fmt(startTime)} – ${fmt(endTime)}`;
}
