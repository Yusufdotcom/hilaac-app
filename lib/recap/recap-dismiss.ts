import { getZonedYmd, type Ymd } from "../time/app-calendar";

/** YYYY-MM-DD in APP_TIMEZONE for daily dismiss keys. */
export function appDayKey(now: Date = new Date()): string {
  const { year, month, day } = getZonedYmd(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * ISO-like week key (YYYY-Www) in APP_TIMEZONE.
 * Weeks start Monday (ISO). Used so the longer recap reappears weekly after dismiss.
 */
export function appWeekKey(now: Date = new Date()): string {
  const ymd = getZonedYmd(now);
  return isoWeekKeyFromYmd(ymd);
}

function isoWeekKeyFromYmd(ymd: Ymd): string {
  // Convert Y-M-D to a UTC noon Date, then ISO week number.
  const utc = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12, 0, 0));
  const day = utc.getUTCDay() || 7; // Mon=1 … Sun=7
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weekYear = utc.getUTCFullYear();
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

export function recapDismissStorageKey(
  restaurantId: string,
  kind: "daily" | "weekly",
  periodKey: string
): string {
  return `hilaac-recap-dismissed:${restaurantId}:${kind}:${periodKey}`;
}

export function isRecapDismissed(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function dismissRecap(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, "1");
  } catch {
    // private mode / quota
  }
}
