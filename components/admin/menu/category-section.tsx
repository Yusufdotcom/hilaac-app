"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { AddOn, Category, CategoryAddOn } from "@/types/database";

export function CategorySection({
  restaurantId,
  categories,
  addOns,
  categoryAddOns,
}: {
  restaurantId: string;
  categories: Category[];
  addOns: AddOn[];
  categoryAddOns: CategoryAddOn[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlaceholder, setEditPlaceholder] = useState("");
  const [editAddOnIds, setEditAddOnIds] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const linksByCategory = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of categoryAddOns) {
      const list = map.get(link.category_id) ?? [];
      list.push(link.add_on_id);
      map.set(link.category_id, list);
    }
    return map;
  }, [categoryAddOns]);

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

  function openEdit(category: Category) {
    setEditing(category);
    setEditName(category.name);
    setEditPlaceholder(category.special_instructions_placeholder ?? "");
    setEditAddOnIds([...(linksByCategory.get(category.id) ?? [])]);
  }

  function toggleEditAddOn(id: string) {
    setEditAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    setSavingEdit(true);

    const { error: catError } = await supabase
      .from("categories")
      .update({
        name: editName.trim(),
        special_instructions_placeholder: editPlaceholder.trim() || null,
      })
      .eq("id", editing.id);

    if (catError) {
      setSavingEdit(false);
      toast.error(catError.message);
      return;
    }

    const { error: delError } = await supabase
      .from("category_add_ons")
      .delete()
      .eq("category_id", editing.id);

    if (delError) {
      setSavingEdit(false);
      toast.error(delError.message);
      return;
    }

    if (editAddOnIds.length > 0) {
      const { error: insError } = await supabase.from("category_add_ons").insert(
        editAddOnIds.map((add_on_id) => ({
          category_id: editing.id,
          add_on_id,
        }))
      );
      if (insError) {
        setSavingEdit(false);
        toast.error(insError.message);
        return;
      }
    }

    setSavingEdit(false);
    setEditing(null);
    toast.success("Category updated");
    router.refresh();
  }

  return (
    <Card className="mt-4">
      <CardContent className="space-y-6 p-6">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="e.g. Appetizers"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <BrandButton type="submit" disabled={loading}>
            <Plus className="h-4 w-4" /> Add
          </BrandButton>
        </form>

        <div className="space-y-2">
          {categories.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              No categories yet. Add your first one above.
            </p>
          )}
          {categories.map((category) => {
            const linked = linksByCategory.get(category.id) ?? [];
            return (
              <div
                key={category.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{category.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {linked.length} add-on{linked.length === 1 ? "" : "s"}
                    {category.special_instructions_placeholder
                      ? ` · “${category.special_instructions_placeholder}”`
                      : " · default instructions hint"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {editing && (
          <form
            onSubmit={handleSaveEdit}
            className="space-y-4 rounded-xl border bg-muted/30 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Edit category</h3>
              <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Special instructions placeholder</Label>
              <Input
                placeholder="Leave blank for smart default (e.g. Any special requests?)"
                value={editPlaceholder}
                onChange={(e) => setEditPlaceholder(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shown under the notes field on the customer item modal.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Category add-ons</Label>
              {addOns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create add-ons in the Add-ons tab first, then assign them here.
                </p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-background p-3">
                  {addOns.map((addOn) => (
                    <label
                      key={addOn.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-1.5 hover:bg-muted/60"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={editAddOnIds.includes(addOn.id)}
                          onCheckedChange={() => toggleEditAddOn(addOn.id)}
                        />
                        {addOn.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(Number(addOn.price))}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <BrandButton type="submit" disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save category"}
            </BrandButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
