export type CustomerSegment = "vip" | "regular" | "new" | "at_risk";

export type CustomerProfileRow = {
  restaurant_id: string;
  customer_phone: string;
  total_visits: number;
  lifetime_spend: number;
  last_visit: string;
  first_visit: string;
  visits_last_30d?: number;
};

export type SegmentCounts = Record<CustomerSegment, number>;

export function assignCustomerSegment(
  profile: {
    total_visits: number;
    lifetime_spend: number;
    last_visit: string;
    first_visit: string;
    visits_last_30d: number;
  },
  now: Date = new Date()
): CustomerSegment | null {
  const visits = Number(profile.total_visits) || 0;
  const spend = Number(profile.lifetime_spend) || 0;
  const visits30 = Number(profile.visits_last_30d) || 0;
  const last = new Date(profile.last_visit).getTime();
  const first = new Date(profile.first_visit).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysSinceLast = (now.getTime() - last) / dayMs;
  const daysSinceFirst = (now.getTime() - first) / dayMs;

  // VIP first
  if (visits >= 10 || spend >= 100) return "vip";
  // At-Risk: was Regular-like (3+ lifetime visits) and quiet 30+ days
  if (visits >= 3 && daysSinceLast >= 30) return "at_risk";
  // New: first visit within last 7 days
  if (daysSinceFirst <= 7) return "new";
  // Regular: 3+ visits in last 30 days
  if (visits30 >= 3) return "regular";
  return null;
}

export function countSegments(
  profiles: {
    total_visits: number;
    lifetime_spend: number;
    last_visit: string;
    first_visit: string;
    visits_last_30d: number;
  }[],
  now: Date = new Date()
): SegmentCounts {
  const counts: SegmentCounts = { vip: 0, regular: 0, new: 0, at_risk: 0 };
  for (const p of profiles) {
    const seg = assignCustomerSegment(p, now);
    if (seg) counts[seg] += 1;
  }
  return counts;
}

export type FeedbackBuckets = {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
};

/** 4–5 positive, 3 neutral, 1–2 negative */
export function bucketRatings(ratings: number[]): FeedbackBuckets {
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  for (const r of ratings) {
    if (r >= 4) positive += 1;
    else if (r === 3) neutral += 1;
    else if (r >= 1) negative += 1;
  }
  return { positive, neutral, negative, total: positive + neutral + negative };
}

export function returningSalesShare(
  returningRevenue: number,
  totalRevenue: number
): number | null {
  if (!(totalRevenue > 0)) return null;
  return Math.round((returningRevenue / totalRevenue) * 1000) / 10;
}
