import { Phone } from "lucide-react";
import { formatCustomerPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function OrderCustomerPhone({
  phone,
  className,
  variant = "default",
}: {
  phone: string | null | undefined;
  className?: string;
  variant?: "default" | "badge" | "compact";
}) {
  const formatted = formatCustomerPhone(phone);
  if (!formatted) return null;

  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600",
          className
        )}
      >
        <Phone className="h-3 w-3" aria-hidden="true" />
        Phone: {formatted}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <p className={cn("flex items-center gap-1 text-xs text-[#64748B]", className)}>
        <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {formatted}
      </p>
    );
  }

  return (
    <p className={cn("flex items-center gap-1.5 text-sm text-[#64748B]", className)}>
      <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{formatted}</span>
    </p>
  );
}
