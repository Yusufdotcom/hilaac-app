import Link from "next/link";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";

export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-light-surface min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <header className="border-b border-[#E2E8F0] bg-[#0F172A]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" aria-label="Hilaac home">
            <HilaacLogo variant="light" />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-[#D4A373] transition-colors hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D4A373]">
          Hilaac Smart Solution
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#64748B]">Last updated: {lastUpdated}</p>

        <div className="prose-legal mt-10 space-y-8 text-[15px] leading-relaxed text-[#334155]">
          {children}
        </div>

        <div className="mt-12 border-t border-[#E2E8F0] pt-8 text-center">
          <Link
            href="/"
            className="inline-flex rounded-lg bg-[#D4A373] px-5 py-2.5 text-sm font-semibold text-[#0F172A] transition-opacity hover:opacity-90"
          >
            Return to homepage
          </Link>
        </div>
      </main>

      <PoweredByHilaac className="pb-10" />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[#0F172A]">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
