"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import { cn, formatCurrency, formatOrderLabel } from "@/lib/utils";

type SearchResult = {
  orders: Array<{
    id: string;
    order_number: number | null;
    customer_phone: string | null;
    total: number;
  }>;
  menuItems: Array<{ id: string; name: string; price: number }>;
  staff: Array<{ id: string; full_name: string | null; phone: string | null; role: string }>;
};

function ResultsList({
  results,
  loading,
  q,
  slug,
  onNavigate,
}: {
  results: SearchResult | null;
  loading: boolean;
  q: string;
  slug: string;
  onNavigate: () => void;
}) {
  const hasHits =
    results &&
    (results.orders.length > 0 || results.menuItems.length > 0 || results.staff.length > 0);

  return (
    <div className="max-h-72 overflow-y-auto">
      {loading && (
        <p className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--admin-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching…
        </p>
      )}
      {!loading && q.trim() && !hasHits && (
        <p className="px-3 py-2 text-sm text-[var(--admin-muted)]">No matches</p>
      )}
      {!loading && results && results.orders.length > 0 && (
        <div className="mb-2">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Orders
          </p>
          {results.orders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/${slug}/orders`}
              onClick={onNavigate}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="font-medium">{formatOrderLabel(o, { prefix: false })}</span>
              <span className="ml-2 text-[var(--admin-muted)]">
                {o.customer_phone ?? "—"} · {formatCurrency(Number(o.total))}
              </span>
            </Link>
          ))}
        </div>
      )}
      {!loading && results && results.menuItems.length > 0 && (
        <div className="mb-2">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Menu
          </p>
          {results.menuItems.map((m) => (
            <Link
              key={m.id}
              href={`/admin/${slug}/menu`}
              onClick={onNavigate}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="font-medium">{m.name}</span>
              <span className="ml-2 text-[var(--admin-muted)]">
                {formatCurrency(Number(m.price))}
              </span>
            </Link>
          ))}
        </div>
      )}
      {!loading && results && results.staff.length > 0 && (
        <div>
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Staff
          </p>
          {results.staff.map((s) => (
            <Link
              key={s.id}
              href={`/admin/${slug}/staff`}
              onClick={onNavigate}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="font-medium">{s.full_name || "Unnamed"}</span>
              <span className="ml-2 capitalize text-[var(--admin-muted)]">
                {s.role}
                {s.phone ? ` · ${s.phone}` : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminSearch({
  slug,
  className,
  compact = false,
}: {
  slug: string;
  className?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) {
      setResults(null);
      return;
    }
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as SearchResult;
        if (res.ok) setResults(data);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  if (compact) {
    return (
      <div ref={rootRef} className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)]"
          aria-label="Search"
        >
          {open ? (
            <X className="h-[18px] w-[18px] text-[var(--admin-muted)]" />
          ) : (
            <Search className="h-[18px] w-[18px] text-[var(--admin-muted)]" />
          )}
        </button>
        {open && (
          <div className="admin-glass-panel absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl p-3">
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search orders, menu, staff…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <ResultsList
              results={results}
              loading={loading}
              q={q}
              slug={slug}
              onNavigate={() => setOpen(false)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3.5 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search orders, menu items, staff…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      {open && (q.trim().length > 0 || loading) && (
        <div className="admin-glass-panel absolute left-0 right-0 top-full z-50 mt-2 rounded-xl p-2">
          <ResultsList
            results={results}
            loading={loading}
            q={q}
            slug={slug}
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
