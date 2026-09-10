export type AlertSeverity = "urgent" | "important" | "normal";

export type RestaurantAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  whyItMatters: string;
  actionLabel: string;
  href: string;
  /** Higher = show first within same severity. */
  rank: number;
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  urgent: 0,
  important: 1,
  normal: 2,
};

export function sortAlerts(alerts: RestaurantAlert[]): RestaurantAlert[] {
  return [...alerts].sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return b.rank - a.rank;
  });
}
