"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Info, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBranchDisplayLabel, type OwnerBranch } from "@/lib/admin/owner-branches";

const BRANCH_SWITCH_INFO =
  "Switching branches will change your menu, orders, and reports to the selected location.";

function BranchOption({
  branch,
  isSelected,
  onSelect,
}: {
  branch: OwnerBranch;
  isSelected: boolean;
  onSelect: (slug: string) => void;
}) {
  const label = getBranchDisplayLabel(branch);

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      title={label}
      onClick={() => onSelect(branch.slug)}
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors duration-150",
        isSelected
          ? "bg-[#D4A373]/15 text-white"
          : "text-hilaac-muted hover:bg-slate-800/80 hover:text-white"
      )}
    >
      <MapPin
        className={cn("h-4 w-4 shrink-0", isSelected ? "text-[#D4A373]" : "text-hilaac-muted")}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isSelected && (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[#D4A373]">
          Active
        </span>
      )}
    </button>
  );
}

export function BranchSelector({
  branches,
  currentSlug,
  collapsed,
}: {
  branches: OwnerBranch[];
  currentSlug: string;
  collapsed: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const currentBranch = branches.find((branch) => branch.slug === currentSlug);
  const currentLabel = currentBranch ? getBranchDisplayLabel(currentBranch) : "Select branch";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (branches.length <= 1) return null;

  function handleSelect(slug: string) {
    setOpen(false);
    if (slug === currentSlug) return;
    router.push(`/admin/${slug}/dashboard`);
  }

  if (collapsed) {
    return (
      <div
        className="hidden shrink-0 overflow-visible border-b border-hilaac-dark px-2 py-3 md:block"
        title={`Switch branch. ${BRANCH_SWITCH_INFO}`}
      >
        <MapPin className="mx-auto h-5 w-5 text-hilaac-muted" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0 overflow-visible border-b border-hilaac-dark px-4 py-4"
    >
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-hilaac-muted">Branch</p>
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-hilaac-muted transition-colors hover:bg-slate-800 hover:text-white"
          title={BRANCH_SWITCH_INFO}
          aria-label={BRANCH_SWITCH_INFO}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#D4A373]/25 bg-[#0F172A] shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="branch-selector-list"
          title={currentLabel}
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-slate-800/50"
        >
          <MapPin className="h-4 w-4 shrink-0 text-[#D4A373]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-medium">{currentLabel}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-hilaac-muted transition-transform duration-200 ease-in-out",
              open && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>

        <div
          className={cn(
            "grid transition-all duration-200 ease-in-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div
              id="branch-selector-list"
              role="listbox"
              aria-label="Branches"
              className="max-h-48 overflow-y-auto border-t border-[#D4A373]/15"
            >
              {branches.map((branch) => (
                <BranchOption
                  key={branch.id}
                  branch={branch}
                  isSelected={branch.slug === currentSlug}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-2 px-1 text-xs leading-snug text-muted-foreground">{BRANCH_SWITCH_INFO}</p>
    </div>
  );
}
