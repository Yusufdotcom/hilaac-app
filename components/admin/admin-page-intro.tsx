import { cn } from "@/lib/utils";

/** Subtitle / actions row under TopBar — no duplicate page h1. */
export function AdminPageIntro({
  children,
  className,
  actions,
}: {
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  if (!children && !actions) return null;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-start justify-between gap-3",
        className
      )}
    >
      {children ? (
        <p className="min-w-0 text-sm text-[var(--admin-muted,#64748B)] sm:text-base">
          {children}
        </p>
      ) : (
        <span />
      )}
      {actions}
    </div>
  );
}
