"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { AddOn } from "@/types/database";

export function AddOnSection({ restaurantId, addOns }: { restaurantId: string; addOns: AddOn[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", price: "" });
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("add_ons").insert({
      restaurant_id: restaurantId,
      name: form.name.trim(),
      price: Number(form.price) || 0,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({ name: "", price: "" });
    toast.success("Add-on added");
    router.refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("add_ons").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Add-on removed");
    router.refresh();
  }

  return (
    <Card className="mt-4">
      <CardContent className="p-6">
        <form onSubmit={handleAdd} className="mb-6 flex gap-2">
          <Input placeholder="e.g. Extra cheese" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            type="number"
            step="0.01"
            placeholder="Price"
            className="w-32"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <BrandButton type="submit" disabled={loading}>
            <Plus className="h-4 w-4" /> Add
          </BrandButton>
        </form>

        <div className="space-y-2">
          {addOns.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">No add-ons yet. Add your first one above.</p>
          )}
          {addOns.map((addOn) => (
            <div key={addOn.id} className="flex items-center justify-between rounded-lg border p-3">
              <span className="font-medium">{addOn.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">{formatCurrency(Number(addOn.price))}</span>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(addOn.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
