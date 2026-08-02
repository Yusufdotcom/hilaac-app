export type ReportGranularity = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export type RevenueBucket = {
  period_start: string;
  period_label: string;
  order_count: number;
  revenue: number;
};

export type ItemStat = {
  item_name: string;
  quantity_sold: number;
  revenue: number;
};

export type PeakHourStat = {
  hour_of_day: number;
  order_count: number;
  revenue: number;
};

export type PeakDayStat = {
  day_of_week: number;
  day_label: string;
  order_count: number;
  revenue: number;
};

export type PaymentSplitStat = {
  payment_method: string;
  order_count: number;
  revenue: number;
};

export type WaiterPerformanceStat = {
  waiter_name: string;
  deliveries: number;
  revenue: number;
};

export type KpiTrend = {
  percent: number | null;
  direction: "up" | "down" | "flat";
  current: number;
  previous: number;
  /**
   * True when the period has barely started and has no orders yet —
   * UI shows a neutral "Not enough data" state instead of a stark −100%.
   */
  insufficientData?: boolean;
};

export type KpiSummary = {
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  /** Null when nothing was sold in the selected timeframe. */
  top_item_name: string | null;
  top_item_quantity: number;
  /** Sum of order_items.quantity for paid orders in range (sanity ≥ total_orders). */
  items_sold: number;
  trends: {
    orders: KpiTrend;
    revenue: KpiTrend;
    aov: KpiTrend;
  };
};

export type SpikedItem = {
  item_name: string;
  quantity_sold: number;
  previous_quantity: number;
  growth_percent: number;
};

export type ReportInsightType =
  | "trending_up"
  | "underperforming"
  | "peak_hours"
  | "payment_concentration"
  | "revenue_trend";

export type ReportInsight = {
  id: string;
  type: ReportInsightType;
  title: string;
  message: string;
  /** Higher = show first. */
  importance: number;
  meta?: Record<string, string | number | null | undefined>;
};

export type ReportData = {
  kpi: KpiSummary;
  revenue: RevenueBucket[];
  previousRevenue: RevenueBucket[];
  topItems: ItemStat[];
  leastItems: ItemStat[];
  peakHours: PeakHourStat[];
  peakDays: PeakDayStat[];
  paymentSplit: PaymentSplitStat[];
  waiterPerformance: WaiterPerformanceStat[];
  spikedItems: SpikedItem[];
  /** Rule-based recommendations — empty when no rule triggers. */
  insights: ReportInsight[];
  meta: {
    startDate: string;
    endDate: string;
    granularity: ReportGranularity;
    periodOffset: number;
  };
};

export type ExportOrderRow = {
  id: string;
  created_at: string;
  table_number: string | null;
  total: number;
  payment_method: string | null;
  status: string;
  delivered_by: string | null;
};
