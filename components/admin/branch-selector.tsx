"use client";

import { useRouter } from "next/navigation";
import { Info, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBranchDisplayLabel, type OwnerBranch } from "@/lib/admin/owner-branches";

const BRANCH_SWITCH_INFO =
  "Switching branches will change your menu, orders, and reports to the selected location.";

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

  if (branches.length <= 1) return null;

  function handleChange(slug: string) {
    if (slug === currentSlug) return;
    router.push(`/admin/${slug}/dashboard`);
  }

  if (collapsed) {
    return (
      <div
        className="hidden border-b border-hilaac-dark px-2 py-3 md:block"
        title={`Switch branch. ${BRANCH_SWITCH_INFO}`}
      >
        <MapPin className="mx-auto h-5 w-5 text-hilaac-muted" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-hilaac-dark px-5 py-4">
      <div className="mb-2 flex items-center gap-1.5">
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
      <Select value={currentSlug} onValueChange={handleChange}>
        <SelectTrigger className="border-hilaac-dark bg-hilaac-dark text-white focus:ring-hilaac-gold">
          <SelectValue placeholder="Select branch" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.slug}>
              {getBranchDisplayLabel(branch)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-2 text-[11px] leading-snug text-hilaac-muted">{BRANCH_SWITCH_INFO}</p>
    </div>
  );
}
