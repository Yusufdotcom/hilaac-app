"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Profile, UserRole } from "@/types/database";

type StaffRow = Pick<Profile, "id" | "full_name" | "role" | "phone" | "is_active"> & {
  has_pin?: boolean;
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "waiter", label: "Waiter" },
  { value: "kitchen", label: "Kitchen" },
];

export function StaffAccountsManager({
  restaurantId,
  staff,
  actorRole = "owner",
}: {
  restaurantId: string;
  staff: StaffRow[];
  actorRole?: UserRole;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(
    actorRole === "manager" ? "cashier" : "manager"
  );

  const creatableRoles =
    actorRole === "manager"
      ? ROLE_OPTIONS.filter((r) => r.value !== "manager")
      : ROLE_OPTIONS;

  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [pinDraft, setPinDraft] = useState<Record<string, string>>({});

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

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/staff/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          email: email.trim(),
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          password,
          role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not create account");
        return;
      }
      toast.success(`${role} account created — they can log in with the email and password`);
      setEmail("");
      setFullName("");
      setPhone("");
      setPassword("");
      setShowForm(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function savePin(member: StaffRow, clear = false) {
    setPinBusyId(member.id);
    try {
      const res = await fetch(`/api/admin/staff/${member.id}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          pin: clear ? null : pinDraft[member.id] ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not update PIN");
        return;
      }
      toast.success(clear ? "PIN cleared" : "PIN saved");
      setPinDraft((prev) => {
        const next = { ...prev };
        delete next[member.id];
        return next;
      });
      router.refresh();
    } finally {
      setPinBusyId(null);
    }
  }

  function roleLabel(r: UserRole) {
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Staff accounts</CardTitle>
          <CardDescription>
            Create logins for Manager / Cashier / Kitchen / Waiter. Floor roles open their staff
            dashboard after login. Deactivate removes access immediately.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <UserPlus className="mr-2 h-4 w-4" />
          {showForm ? "Cancel" : "Add staff"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {showForm ? (
          <form
            onSubmit={(e) => void createStaff(e)}
            className="space-y-3 rounded-xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-bg,#F8FAFC)] p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name">Full name</Label>
                <Input
                  id="staff-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Amina Hassan"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger id="staff-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {creatableRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-password">Temporary password</Label>
                <Input
                  id="staff-password"
                  type="text"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="staff-phone">Phone (optional)</Label>
                <Input
                  id="staff-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="61xxxxxxx"
                  inputMode="tel"
                />
              </div>
            </div>
            <BrandButton type="submit" disabled={creating} className="w-full sm:w-auto">
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create account"
              )}
            </BrandButton>
          </form>
        ) : null}

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
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  {member.role === "kitchen" ||
                  member.role === "waiter" ||
                  member.role === "cashier" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="h-9 w-28"
                        inputMode="numeric"
                        placeholder={member.has_pin ? "••••" : "Set PIN"}
                        value={pinDraft[member.id] ?? ""}
                        onChange={(e) =>
                          setPinDraft((prev) => ({
                            ...prev,
                            [member.id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        aria-label={`PIN for ${member.full_name || "staff"}`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          pinBusyId === member.id ||
                          !(pinDraft[member.id] && pinDraft[member.id]!.length >= 4)
                        }
                        onClick={() => void savePin(member, false)}
                      >
                        Save PIN
                      </Button>
                      {member.has_pin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pinBusyId === member.id}
                          onClick={() => void savePin(member, true)}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
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
