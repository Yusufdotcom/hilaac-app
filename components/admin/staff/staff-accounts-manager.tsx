"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Profile, UserRole } from "@/types/database";

type StaffRow = Pick<Profile, "id" | "full_name" | "role" | "phone" | "is_active">;

export function StaffAccountsManager({
  restaurantId,
  staff,
}: {
  restaurantId: string;
  staff: StaffRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setActive(member: StaffRow, is_active: boolean) {
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/admin/staff/${member.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active, restaurant_id: restaurantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not update status");
        return;
      }
      toast.success(is_active ? "Staff reactivated" : "Staff deactivated");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function roleLabel(role: UserRole) {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg">Staff accounts</CardTitle>
        <CardDescription>
          Deactivate removes access immediately (including existing sessions). Reactivate restores
          login. Owner accounts cannot be deactivated here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {staff.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            No staff accounts for this restaurant yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {staff.map((member) => (
              <li
                key={member.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{member.full_name || "Unnamed staff"}</span>
                    <Badge variant="secondary">{roleLabel(member.role)}</Badge>
                    <Badge variant={member.is_active ? "default" : "outline"}>
                      {member.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {member.phone ? (
                    <p className="mt-1 text-sm text-muted-foreground">{member.phone}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {member.role === "owner" ? (
                    <Button type="button" variant="outline" disabled>
                      Owner protected
                    </Button>
                  ) : member.is_active ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyId === member.id}
                      onClick={() => setActive(member, false)}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <BrandButton
                      type="button"
                      disabled={busyId === member.id}
                      onClick={() => setActive(member, true)}
                    >
                      Reactivate
                    </BrandButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
