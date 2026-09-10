import {
  APP_TIMEZONE,
  addCalendarDays,
  formatAppDate,
  getAppDayBounds,
  getZonedYmd,
  zonedMidnightToUtc,
  zonedWallTimeToUtc,
  type Ymd,
} from "@/lib/time/app-calendar";

export type BusinessHours = {
  openingTime: string | null;
  closingTime: string | null;
  /** 0=Sunday … 6=Saturday. Null or 7 unique days = every day. */
  businessDays: number[] | null;
};

export type BusinessDayWindow = {
  start: Date;
  end: Date;
  ymd: Ymd;
  label: string;
  usesCustomHours: boolean;
  hoursLabel: string;
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function parseTimeHm(raw: string | null | undefined): { hour: number; minute: number } | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function hasCustomBusinessHours(hours: BusinessHours): boolean {
  return Boolean(parseTimeHm(hours.openingTime) && parseTimeHm(hours.closingTime));
}

export function hoursFromRestaurant(row: {
  opening_time?: string | null;
  closing_time?: string | null;
  business_days?: number[] | null;
}): BusinessHours {
  return {
    openingTime: row.opening_time ?? null,
    closingTime: row.closing_time ?? null,
    businessDays: row.business_days ?? null,
  };
}

function weekdaySun0(ymd: Ymd): number {
  const midnight = zonedMidnightToUtc(ymd.year, ymd.month, ymd.day);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).format(midnight);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

function isOpenOn(ymd: Ymd, hours: BusinessHours): boolean {
  const days = hours.businessDays?.filter((d) => d >= 0 && d <= 6);
  if (!days || days.length === 0 || days.length >= 7) return true;
  return days.includes(weekdaySun0(ymd));
}

function formatHm(hour: number, minute: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${twelve}:00 ${suffix}` : `${twelve}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatHoursLabel(hours: BusinessHours): string {
  const open = parseTimeHm(hours.openingTime);
  const close = parseTimeHm(hours.closingTime);
  if (!open || !close) return "24-hour calendar day (East Africa Time)";
  const overnight = close.hour * 60 + close.minute <= open.hour * 60 + open.minute;
  const range = `${formatHm(open.hour, open.minute)} – ${formatHm(close.hour, close.minute)}`;
  return overnight ? `${range} (overnight)` : range;
}

export function boundsForBusinessDate(
  ymd: Ymd,
  hours: BusinessHours
): { start: Date; end: Date } | null {
  if (!isOpenOn(ymd, hours)) return null;

  const open = parseTimeHm(hours.openingTime);
  const close = parseTimeHm(hours.closingTime);
  if (!open || !close) {
    const start = zonedMidnightToUtc(ymd.year, ymd.month, ymd.day);
    const next = addCalendarDays(ymd, 1);
    const end = zonedMidnightToUtc(next.year, next.month, next.day);
    return { start, end };
  }

  const start = zonedWallTimeToUtc(ymd.year, ymd.month, ymd.day, open.hour, open.minute);
  const overnight = close.hour * 60 + close.minute <= open.hour * 60 + open.minute;
  if (overnight) {
    const next = addCalendarDays(ymd, 1);
    const end = zonedWallTimeToUtc(next.year, next.month, next.day, close.hour, close.minute);
    return { start, end };
  }
  const end = zonedWallTimeToUtc(ymd.year, ymd.month, ymd.day, close.hour, close.minute);
  return { start, end };
}

function windowFromYmd(ymd: Ymd, hours: BusinessHours): BusinessDayWindow | null {
  const bounds = boundsForBusinessDate(ymd, hours);
  if (!bounds) return null;
  return {
    ...bounds,
    ymd,
    label: formatAppDate(bounds.start, { weekday: "short", month: "short", day: "numeric" }),
    usesCustomHours: hasCustomBusinessHours(hours),
    hoursLabel: formatHoursLabel(hours),
  };
}

/** Most recently finished business day (today is excluded until closing time). */
export function lastCompletedBusinessDay(
  hours: BusinessHours,
  now: Date = new Date()
): BusinessDayWindow {
  const today = getZonedYmd(now);
  for (let back = 0; back <= 21; back += 1) {
    const ymd = addCalendarDays(today, -back);
    const win = windowFromYmd(ymd, hours);
    if (!win) continue;
    if (now.getTime() >= win.end.getTime()) return win;
  }
  const fallback = getAppDayBounds(-1, now);
  return {
    start: fallback.start,
    end: fallback.end,
    ymd: fallback.ymd,
    label: formatAppDate(fallback.start, { weekday: "short", month: "short", day: "numeric" }),
    usesCustomHours: false,
    hoursLabel: formatHoursLabel({ openingTime: null, closingTime: null, businessDays: null }),
  };
}

export function previousCompletedBusinessDay(
  hours: BusinessHours,
  after: BusinessDayWindow,
  now: Date = new Date()
): BusinessDayWindow | null {
  for (let back = 1; back <= 21; back += 1) {
    const ymd = addCalendarDays(after.ymd, -back);
    const win = windowFromYmd(ymd, hours);
    if (!win) continue;
    if (now.getTime() >= win.end.getTime()) return win;
  }
  return null;
}

export { ALL_DAYS };
