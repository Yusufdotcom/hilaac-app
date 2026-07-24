"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Waiter } from "@/types/database";

export function WaiterManager({
  restaurantId,
  waiters,
}: {
  restaurantId: string;
  waiters: Waiter[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    const { error } = await supabase.from("waiters").insert({
      restaurant_id: restaurantId,
      name: trimmed,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message.includes("unique") ? "That waiter name already exists." : error.message);
      return;
    }

    setName("");
    toast.success("Waiter added");
    router.refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("waiters").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Waiter removed");
    router.refresh();
  }

  return (
    <div className="w-full space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">Waiters</h1>
        <p className="text-muted-foreground">
          Add the names of your waiters. They select their name on the shared tablet when delivering orders.
        </p>
      </div>

      <Card className="w-full overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Waiter names</CardTitle>
          <CardDescription>
            These names appear in the &ldquo;Who is delivering?&rdquo; dropdown on the Waiter Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row">
            <Input
              placeholder="e.g. Ahmed"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full min-w-0"
            />
            <BrandButton type="submit" disabled={loading} className="w-full shrink-0 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add
            </BrandButton>
          </form>

          {waiters.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              No waiters yet. Add your first waiter above.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {waiters.map((waiter) => (
                <li
                  key={waiter.id}
                  className="flex items-center justify-between rounded-lg border bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F172A]/5 text-[#0F172A]">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <span className="font-medium">{waiter.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(waiter.id)}
                    aria-label={`Remove ${waiter.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
