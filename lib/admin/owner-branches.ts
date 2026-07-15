import type { SupabaseClient } from "@supabase/supabase-js";

export type OwnerBranch = {
  id: string;
  name: string;
  slug: string;
  branch_name: string | null;
  address: string | null;
};

export function getBranchLabel(branch: Pick<OwnerBranch, "name" | "branch_name">): string {
  const label = branch.branch_name?.trim();
  return label || branch.name;
}

/** City or last segment of the address, e.g. "Mogadishu" from "Hodan, Mogadishu". */
export function getBranchLocation(address: string | null | undefined): string | null {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/** Display label for branch selectors, e.g. "Boba Grill - Mogadishu". */
export function getBranchDisplayLabel(
  branch: Pick<OwnerBranch, "name" | "branch_name" | "address">
): string {
  const name = getBranchLabel(branch);
  const location = getBranchLocation(branch.address);
  return location ? `${name} - ${location}` : name;
}

export async function getOwnerBranches(
  supabase: SupabaseClient,
  ownerId: string
): Promise<OwnerBranch[]> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, branch_name, address")
    .eq("owner_id", ownerId)
    .order("name");

  if (error) {
    console.error("getOwnerBranches failed:", error.message);
    return [];
  }

  return (data ?? []) as OwnerBranch[];
}

export async function ownerCanAccessSlug(
  supabase: SupabaseClient,
  ownerId: string,
  slug: string
): Promise<boolean> {
  const { data } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("slug", slug)
    .maybeSingle();

  return !!data?.id;
}
