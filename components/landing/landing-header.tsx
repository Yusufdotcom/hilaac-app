"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { TryDemoButton } from "@/components/landing/try-demo-button";
import { cn } from "@/lib/utils";

type NavDropdownProps = {
  label: string;
  items: { label: string; href: string }[];
};

function NavDropdown({ label, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="landing-nav-link flex items-center gap-1"
        aria-expanded={open}
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 min-w-[200px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#1E293B] py-2 shadow-xl">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2.5 text-sm text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function LandingHeader({ dashboardHref = null }: { dashboardHref?: string | null }) {
  const isLoggedIn = Boolean(dashboardHref);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#334155]/60 bg-hilaac-navy backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-2 px-4 sm:h-[4.5rem] sm:gap-3 sm:px-6 lg:grid lg:h-20 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
        <div className="flex min-w-0 flex-1 justify-start overflow-hidden sm:flex-none">
          <HilaacLogo
            href="/"
            variant="light"
            showWordmark
            src="/logo-icon.png"
            className="min-w-0"
            wordmarkClassName="truncate text-base sm:text-lg"
          />
        </div>

        {/* Center — nav (desktop lg+) */}
        <nav className="hidden items-center justify-center gap-8 lg:flex">
          <Link href="#features" className="landing-nav-link">
            Features
          </Link>
          <Link href="#pricing" className="landing-nav-link">
            Pricing
          </Link>
          <NavDropdown
            label="Platform"
            items={[
              { label: "QR Ordering", href: "#features" },
              { label: "Kitchen Display", href: "#features" },
              { label: "AI Menu Generator", href: "#features" },
            ]}
          />
          <NavDropdown
            label="Resources"
            items={[
              { label: "Documentation", href: "#" },
              { label: "Privacy", href: "#privacy" },
              { label: "Terms", href: "#terms" },
            ]}
          />
        </nav>

        {/* Right — actions (desktop md+) */}
        <div className="hidden shrink-0 items-center justify-end gap-1.5 sm:gap-2 md:flex md:gap-3">
          {isLoggedIn ? (
            <Link href={dashboardHref!} className="landing-btn-nav-pill whitespace-nowrap text-xs sm:text-sm">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="landing-btn-text hidden text-sm sm:inline-flex">
                Log in
              </Link>
              <a
                href="mailto:sales@hilaac.so"
                className="landing-btn-ghost-nav hidden text-sm md:inline-flex"
              >
                Contact Sales
              </a>
              <TryDemoButton className="landing-btn-nav-pill px-3 text-xs disabled:opacity-60 sm:px-4 sm:text-sm" />
            </>
          )}
        </div>

        {/* Mobile hamburger (below md) */}
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <X className="h-6 w-6 text-[#D4A373]" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile menu overlay + panel */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 top-16 z-40 bg-black/50 animate-in fade-in duration-200 md:hidden sm:top-[4.5rem]"
            onClick={closeMobileMenu}
          />
          <nav
            className={cn(
              "fixed inset-x-4 top-[4.25rem] z-50 mx-auto max-w-sm rounded-2xl border border-white/10 bg-[#0F172A] p-4 shadow-2xl md:hidden",
              "animate-in slide-in-from-top-2 fade-in duration-300 sm:top-[4.75rem]"
            )}
          >
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <ul className="space-y-1">
              <li>
                <Link
                  href="#features"
                  onClick={closeMobileMenu}
                  className="block rounded-lg px-4 py-3 text-base font-medium text-white transition-colors hover:bg-white/5"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="#pricing"
                  onClick={closeMobileMenu}
                  className="block rounded-lg px-4 py-3 text-base font-medium text-white transition-colors hover:bg-white/5"
                >
                  Pricing
                </Link>
              </li>
              {isLoggedIn ? (
                <li>
                  <Link
                    href={dashboardHref!}
                    onClick={closeMobileMenu}
                    className="mt-2 block rounded-full bg-[#D4A373] px-4 py-3 text-center text-base font-semibold text-[#0F172A] transition-opacity hover:opacity-90"
                  >
                    Go to Dashboard
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link
                      href="/login"
                      onClick={closeMobileMenu}
                      className="block rounded-lg px-4 py-3 text-base font-medium text-white transition-colors hover:bg-white/5"
                    >
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/signup"
                      onClick={closeMobileMenu}
                      className="mt-2 block rounded-full bg-[#D4A373] px-4 py-3 text-center text-base font-semibold text-[#0F172A] transition-opacity hover:opacity-90"
                    >
                      Start Free Trial
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </>
      )}
    </header>
  );
}
