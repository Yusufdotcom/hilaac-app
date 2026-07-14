import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="app-light-surface flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <HilaacLogo variant="default" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-[#0F172A]">{title}</h1>
              <p className="mt-1 text-sm text-[#64748B]">{description}</p>
            </div>
            {children}
          </div>
          {footer && <div className="mt-6 text-center text-sm text-[#64748B]">{footer}</div>}
        </div>
      </div>
      <PoweredByHilaac className="pb-8" />
    </div>
  );
}
