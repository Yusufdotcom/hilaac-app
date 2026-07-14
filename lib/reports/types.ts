export type ReportGranularity = "daily" | "weekly" | "biweekly" | "monthly";

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

export type KpiSummary = {
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  top_item_name: string;
  top_item_quantity: number;
};

export type ReportData = {
  kpi: KpiSummary;
  revenue: RevenueBucket[];
  topItems: ItemStat[];
  leastItems: ItemStat[];
  peakHours: PeakHourStat[];
  paymentSplit: PaymentSplitStat[];
  waiterPerformance: WaiterPerformanceStat[];
  meta: {
    startDate: string;
    endDate: string;
    granularity: ReportGranularity;
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
