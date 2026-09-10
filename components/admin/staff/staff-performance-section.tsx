"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandButton } from "@/components/admin/brand-button";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import {
  dayLabel,
  formatShiftRange,
  groupShiftsByDay,
  type StaffPerformanceRow,
  type StaffShift,
} from "@/lib/staff/staff-performance";

const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function StaffPerformanceSection({
  restaurantId,
  staffOptions,
  rows,
  shifts,
  gated,
}: {
  restaurantId: string;
  staffOptions: { id: string; full_name: string | null; role: string }[];
  rows: StaffPerformanceRow[];
  shifts: StaffShift[];
  gated?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    profileId: "",
    staffName: "",
    dayOfWeek: "0",
    startTime: "09:00",
    endTime: "17:00",
  });

  const byDay = useMemo(() => groupShiftsByDay(shifts), [shifts]);

  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-8 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
          Staff Performance is on Galeyr 1.0
        </p>
        <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
          Upgrade to see attributed sales, attendance, and weekly schedules.
        </p>
      </div>
    );
  }

  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault();
    const profile = staffOptions.find((s) => s.id === form.profileId);
    const name = (profile?.full_name?.trim() || form.staffName.trim()).trim();
    if (!name) {
      toast.error("Pick a staff member or enter a name");
      return;
    }
    if (form.endTime <= form.startTime) {
      toast.error("End time must be after start time");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("staff_shifts").insert({
      restaurant_id: restaurantId,
      profile_id: form.profileId || null,
      staff_name: name,
      day_of_week: Number(form.dayOfWeek),
      start_time: form.startTime,
      end_time: form.endTime,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Shift added");
    setAddOpen(false);
    router.refresh();
  }

  async function handleDeleteShift(id: string) {
    const { error } = await supabase.from("staff_shifts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Shift removed");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-[var(--admin-text,#0F172A)]">
          Performance
        </h3>
        <p className="mt-0.5 text-sm text-[var(--admin-muted,#64748B)]">
          Last 30 days — sales/orders fill in when delivery attribution matches a staff name.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)]">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-[var(--admin-border)] text-xs text-[var(--admin-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Sales attributed</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 font-medium">Hours worked</th>
              <th className="px-4 py-3 font-medium">Attendance</th>
              <th className="px-4 py-3 font-medium">Overtime</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--admin-muted)]">
                  No active staff accounts yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--admin-border)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[var(--admin-text,#0F172A)]">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--admin-muted)]">{row.role}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.salesAttributed == null ? "—" : formatCurrency(row.salesAttributed)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.ordersAttributed == null ? "—" : row.ordersAttributed}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.hoursWorked}h</td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[120px] items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--admin-subtle,#F1F5F9)]">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, row.attendancePct)}%` }}
                        />
                      </div>
                      <span className="w-10 text-xs tabular-nums text-[var(--admin-muted)]">
                        {Math.round(row.attendancePct)}%
                      </span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 tabular-nums",
                      row.overtimeHours > 0 ? "font-semibold text-amber-700" : "text-[var(--admin-muted)]"
                    )}
                  >
                    {row.overtimeHours > 0 ? `${row.overtimeHours}h` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--admin-text,#0F172A)]">
            Weekly schedule
          </h3>
          <p className="mt-0.5 text-sm text-[var(--admin-muted,#64748B)]">
            Recurring Mon–Sun shifts for the team.
          </p>
        </div>
        <BrandButton type="button" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Shift
        </BrandButton>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {DAYS.map((d) => (
          <div
            key={d}
            className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-3"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
              {dayLabel(d)}
            </p>
            <div className="space-y-2">
              {(byDay[d] ?? []).length === 0 ? (
                <p className="text-xs text-[var(--admin-muted,#94A3B8)]">No shifts</p>
              ) : (
                (byDay[d] ?? []).map((sh) => (
                  <div
                    key={sh.id}
                    className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-subtle,#F8FAFC)] px-2.5 py-2"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-[10px] text-[var(--admin-muted,#64748B)]">
                          {formatShiftRange(sh.start_time, sh.end_time)}
                        </p>
                        <p className="truncate text-sm font-bold text-[var(--admin-text,#0F172A)]">
                          {sh.staff_name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteShift(sh.id)}
                        className="shrink-0 rounded p-1 text-[var(--admin-muted)] hover:text-red-600"
                        aria-label="Remove shift"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shift</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddShift} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Staff</Label>
              <Select
                value={form.profileId || "__custom__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    profileId: v === "__custom__" ? "" : v,
                    staffName:
                      v === "__custom__"
                        ? form.staffName
                        : staffOptions.find((s) => s.id === v)?.full_name ?? "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || s.role}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Other name…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!form.profileId ? (
              <div className="space-y-1.5">
                <Label htmlFor="shift-name">Name</Label>
                <Input
                  id="shift-name"
                  value={form.staffName}
                  onChange={(e) => setForm({ ...form, staffName: e.target.value })}
                  required
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Select
                value={form.dayOfWeek}
                onValueChange={(v) => setForm({ ...form, dayOfWeek: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {dayLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shift-start">Start</Label>
                <Input
                  id="shift-start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shift-end">End</Label>
                <Input
                  id="shift-end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <BrandButton type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </BrandButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
