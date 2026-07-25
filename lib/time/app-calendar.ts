/**
 * Canonical calendar for Hilaac day boundaries.
 * East Africa Time (no DST) — matches order timestamps observed as +03.
 * Use this everywhere: Dashboard, Reports, labels — never mix UTC midnight
 * with DB `current_date` or server-local `setHours(0,0,0,0)`.
 */
export const APP_TIMEZONE = "Africa/Nairobi";

type Ymd = { year: number; month: number; day: number };

function getZonedYmd(date: Date, timeZone: string = APP_TIMEZONE): Ymd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return { year: num("year"), month: num("month"), day: num("day") };
}

/**
 * UTC instant corresponding to local midnight (00:00:00) of Y-M-D in `timeZone`.
 */
export function zonedMidnightToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string = APP_TIMEZONE
): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  // Start with a UTC guess, then correct using the zone's wall-clock reading.
  let ms = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(ms))
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value])
    ) as Record<string, string>;

    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
    ms += desired - asUtc;
  }

  return new Date(ms);
}

function addCalendarDays(ymd: Ymd, days: number): Ymd {
  // Use UTC noon anchor to avoid DST edge issues when stepping calendar days.
  const anchor = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return {
    year: anchor.getUTCFullYear(),
    month: anchor.getUTCMonth() + 1,
    day: anchor.getUTCDate(),
  };
}

/**
 * Half-open day bounds [start, end) in absolute UTC instants for the
 * calendar day of `now` (shifted by `dayOffset`) in APP_TIMEZONE.
 */
export function getAppDayBounds(
  dayOffset = 0,
  now: Date = new Date()
): { start: Date; end: Date; ymd: Ymd } {
  const today = getZonedYmd(now);
  const ymd = addCalendarDays(today, dayOffset);
  const start = zonedMidnightToUtc(ymd.year, ymd.month, ymd.day);
  const next = addCalendarDays(ymd, 1);
  const end = zonedMidnightToUtc(next.year, next.month, next.day);
  return { start, end, ymd };
}

/** Calendar-month bounds [start, end) in APP_TIMEZONE. monthOffset: 0 = current month. */
export function getAppMonthBounds(
  monthOffset = 0,
  now: Date = new Date()
): { start: Date; end: Date } {
  const { year, month } = getZonedYmd(now);
  const totalMonths = year * 12 + (month - 1) + monthOffset;
  const startYear = Math.floor(totalMonths / 12);
  const startMonth = (totalMonths % 12) + 1;
  const endTotal = totalMonths + 1;
  const endYear = Math.floor(endTotal / 12);
  const endMonth = (endTotal % 12) + 1;
  return {
    start: zonedMidnightToUtc(startYear, startMonth, 1),
    end: zonedMidnightToUtc(endYear, endMonth, 1),
  };
}

/** Calendar-year bounds [start, end) in APP_TIMEZONE. yearOffset: 0 = current year. */
export function getAppYearBounds(
  yearOffset = 0,
  now: Date = new Date()
): { start: Date; end: Date } {
  const { year } = getZonedYmd(now);
  const y = year + yearOffset;
  return {
    start: zonedMidnightToUtc(y, 1, 1),
    end: zonedMidnightToUtc(y + 1, 1, 1),
  };
}

/** Format an instant's calendar date in APP_TIMEZONE. */
export function formatAppDate(
  isoOrDate: string | Date,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: APP_TIMEZONE }).format(d);
}

/**
 * Label for a half-open [start, end) range using APP_TIMEZONE calendar dates.
 * Single-day windows render as one date (not "Jul 25 – Jul 26").
 */
export function formatAppDateRangeLabel(startIso: string, endIsoExclusive: string): string {
  const start = new Date(startIso);
  const lastInclusive = new Date(new Date(endIsoExclusive).getTime() - 1);
  const startLabel = formatAppDate(start);
  const endLabel = formatAppDate(lastInclusive);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}

export function isInstantInAppDay(iso: string, dayOffset = 0, now: Date = new Date()): boolean {
  const { start, end } = getAppDayBounds(dayOffset, now);
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}
