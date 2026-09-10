export type HealthStatus = "HEALTHY" | "NEEDS ATTENTION" | "CRITICAL";

export type BusinessHealthInput = {
  /** Percent change today vs yesterday; null if unavailable. */
  revenueDeltaPct: number | null;
  ordersDeltaPct: number | null;
  awaitingPaymentConfirmation: number;
  revenueAvailable: boolean;
  ordersAvailable: boolean;
  backlogAvailable: boolean;
};

export type BusinessHealthResult = {
  score: number;
  status: HealthStatus;
  explanation: string;
  parts: {
    revenuePts: number | null;
    ordersPts: number | null;
    backlogPts: number | null;
  };
};

/**
 * Map a percent change into [0, maxPts].
 * -100% → 0, 0% → maxPts/2, +100% or more → maxPts (clamped).
 */
function trendPoints(deltaPct: number, maxPts: number): number {
  const clamped = Math.max(-100, Math.min(100, deltaPct));
  const ratio = (clamped + 100) / 200;
  return Math.round(ratio * maxPts);
}

function backlogPoints(count: number): number {
  if (count <= 0) return 30;
  if (count <= 2) return 20;
  if (count <= 5) return 10;
  return 0;
}

function statusFor(score: number): HealthStatus {
  if (score >= 70) return "HEALTHY";
  if (score >= 40) return "NEEDS ATTENTION";
  return "CRITICAL";
}

export function computeBusinessHealth(input: BusinessHealthInput): BusinessHealthResult {
  const revenuePts =
    input.revenueAvailable && input.revenueDeltaPct != null
      ? trendPoints(input.revenueDeltaPct, 40)
      : null;
  const ordersPts =
    input.ordersAvailable && input.ordersDeltaPct != null
      ? trendPoints(input.ordersDeltaPct, 30)
      : null;
  const backlogPts = input.backlogAvailable
    ? backlogPoints(input.awaitingPaymentConfirmation)
    : null;

  const earned =
    (revenuePts ?? 0) + (ordersPts ?? 0) + (backlogPts ?? 0);
  const maxPossible =
    (revenuePts != null ? 40 : 0) +
    (ordersPts != null ? 30 : 0) +
    (backlogPts != null ? 30 : 0);

  const score =
    maxPossible === 0 ? 0 : Math.round((earned / maxPossible) * 100);

  const incomplete =
    !input.revenueAvailable || !input.ordersAvailable || !input.backlogAvailable;

  const explanation = buildExplanation({
    revenuePts,
    ordersPts,
    backlogPts,
    revenueDeltaPct: input.revenueDeltaPct,
    ordersDeltaPct: input.ordersDeltaPct,
    awaiting: input.awaitingPaymentConfirmation,
    incomplete,
  });

  return {
    score,
    status: statusFor(score),
    explanation,
    parts: { revenuePts, ordersPts, backlogPts },
  };
}

function buildExplanation(args: {
  revenuePts: number | null;
  ordersPts: number | null;
  backlogPts: number | null;
  revenueDeltaPct: number | null;
  ordersDeltaPct: number | null;
  awaiting: number;
  incomplete: boolean;
}): string {
  if (args.incomplete && args.revenuePts == null && args.ordersPts == null && args.backlogPts == null) {
    return "Health score is incomplete — some dashboard metrics could not be loaded.";
  }

  const deficits: { key: string; gap: number; sentence: string }[] = [];

  if (args.backlogPts != null && args.backlogPts < 30) {
    deficits.push({
      key: "backlog",
      gap: 30 - args.backlogPts,
      sentence:
        args.awaiting === 1
          ? "1 order is still awaiting payment confirmation."
          : `${args.awaiting} orders are still awaiting payment confirmation.`,
    });
  }
  if (args.revenuePts != null && args.revenuePts < 20 && args.revenueDeltaPct != null) {
    deficits.push({
      key: "revenue",
      gap: 40 - args.revenuePts,
      sentence:
        args.revenueDeltaPct < 0
          ? `Revenue is down ${Math.abs(Math.round(args.revenueDeltaPct))}% vs yesterday.`
          : "Revenue growth is soft compared with yesterday.",
    });
  }
  if (args.ordersPts != null && args.ordersPts < 15 && args.ordersDeltaPct != null) {
    deficits.push({
      key: "orders",
      gap: 30 - args.ordersPts,
      sentence:
        args.ordersDeltaPct < 0
          ? `Order volume is down ${Math.abs(Math.round(args.ordersDeltaPct))}% vs yesterday.`
          : "Order volume growth is soft compared with yesterday.",
    });
  }

  deficits.sort((a, b) => b.gap - a.gap);

  if (deficits.length > 0) {
    const base = deficits[0].sentence;
    return args.incomplete
      ? `${base} (Some metrics were unavailable, so this score is partial.)`
      : base;
  }

  if (args.awaiting === 0 && (args.revenueDeltaPct ?? 0) >= 0 && (args.ordersDeltaPct ?? 0) >= 0) {
    return args.incomplete
      ? "Business looks steady on the metrics we could load."
      : "Revenue and orders are holding up, and payments are clear.";
  }

  return args.incomplete
    ? "Overall health looks okay on the metrics we could load."
    : "Business health looks solid across revenue, orders, and payments.";
}
