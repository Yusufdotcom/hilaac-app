"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBranchDisplayLabel, type OwnerBranch } from "@/lib/admin/owner-branches";
import type { SubscriptionTier } from "@/types/database";

export function ManageBranches({
  branches,
  currentSlug,
  subscriptionTier,
}: {
  branches: OwnerBranch[];
  currentSlug: string;
  subscriptionTier: SubscriptionTier;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);

  const isPro = subscriptionTier === "pro";

  async function handleCreateBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!branchName.trim()) {
      toast.error("Branch name is required.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchName: branchName.trim(), address: address.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create branch");

      toast.success("New location created");
      setDialogOpen(false);
      setBranchName("");
      setAddress("");
      router.push(`/admin/${data.slug}/dashboard`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create branch");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manage Branches</CardTitle>
          <CardDescription>
            Add and manage multiple restaurant locations under your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg border border-muted bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Each branch has its own menu, orders, tables, and kitchen/waiter dashboards. Data is 100%
            isolated between branches.
          </p>

          {branches.length > 0 && (
            <ul className="space-y-2">
              {branches.map((branch) => (
                <li
                  key={branch.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{getBranchDisplayLabel(branch)}</span>
                  </div>
                  {branch.slug === currentSlug ? (
                    <span className="shrink-0 text-xs text-muted-foreground">Current</span>
                  ) : (
                    <Link
                      href={`/admin/${branch.slug}/dashboard`}
                      className="shrink-0 text-xs font-medium text-[#D4A373] hover:underline"
                    >
                      Switch
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isPro ? (
            <Button type="button" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add New Location
            </Button>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-[#D4A373]/40 bg-[#D4A373]/10 px-4 py-3 text-sm text-[#0F172A]">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#D4A373]" />
              <div>
                <p className="font-medium">Upgrade to Pro to add multiple branches.</p>
                <p className="mt-1 text-[#64748B]">
                  Pro lets you run 2–3 locations from one account.{" "}
                  <Link href={`/admin/${currentSlug}/billing`} className="font-medium text-[#0F172A] underline">
                    Upgrade now
                  </Link>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>Create another branch under your account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateBranch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. Hilaac — Hodan"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-address">Address</Label>
              <Input
                id="branch-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, district, city"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Location
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
