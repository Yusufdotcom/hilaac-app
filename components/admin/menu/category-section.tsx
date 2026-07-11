"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types/database";

export function CategorySection({ restaurantId, categories }: { restaurantId: string; categories: Category[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("categories").insert({
      restaurant_id: restaurantId,
      name: name.trim(),
      display_order: categories.length,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    toast.success("Category added");
    router.refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Category removed");
    router.refresh();
  }

  return (
    <Card className="mt-4">
      <CardContent className="p-6">
        <form onSubmit={handleAdd} className="mb-6 flex gap-2">
          <Input placeholder="e.g. Appetizers" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={loading}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>

        <div className="space-y-2">
          {categories.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">No categories yet. Add your first one above.</p>
          )}
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{category.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
