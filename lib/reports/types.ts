export type ReportGranularity = "daily" | "weekly" | "monthly" | "yearly";

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
};

export type KpiSummary = {
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  /** Null when nothing was sold in the selected timeframe. */
  top_item_name: string | null;
  top_item_quantity: number;
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
