import {
  formatTodayLabel,
  getTimeOfDayGreeting,
  greetingDisplayName,
} from "@/lib/time/greeting";

export function DashboardGreeting({
  fullName,
}: {
  fullName: string | null | undefined;
}) {
  const greeting = getTimeOfDayGreeting();
  const name = greetingDisplayName(fullName);
  const today = formatTodayLabel();

  return (
    <div className="min-w-0">
      <h2 className="text-2xl font-bold tracking-tight text-[var(--admin-text,#0F172A)] sm:text-3xl">
        {greeting}, {name}
      </h2>
      <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">{today}</p>
    </div>
  );
}
