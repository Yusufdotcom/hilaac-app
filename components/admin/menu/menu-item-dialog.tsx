"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Sparkles, Upload, Lock, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Category, MenuItem } from "@/types/database";

const EMPTY_FORM = { name: "", description: "", ingredients: "", price: "", category_id: "", image_url: "" };

export function MenuItemDialog({
  open,
  onOpenChange,
  restaurantId,
  categories,
  item,
  canUseAi,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  categories: Category[];
  item: MenuItem | null;
  canUseAi: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        description: item.description ?? "",
        ingredients: item.ingredients ?? "",
        price: String(item.price),
        category_id: item.category_id ?? "",
        image_url: item.image_url ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [item, open]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${restaurantId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("menu-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleAiGenerate() {
    if (!canUseAi) {
      toast.error("AI Generate is available on Pro plans (and during your trial). Upgrade to unlock.");
      return;
    }
    if (!form.name) {
      toast.error("Enter a dish name first");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/menu/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: form.name,
          description: form.description,
          ingredients: form.ingredients,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate image");
      setForm((f) => ({ ...f, image_url: data.imageUrl }));
      toast.success("AI image generated");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to generate image");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.category_id) {
      toast.error("Name and category are required");
      return;
    }
    setSaving(true);

    const payload = {
      restaurant_id: restaurantId,
      category_id: form.category_id,
      name: form.name,
      description: form.description || null,
      ingredients: form.ingredients || null,
      price: Number(form.price) || 0,
      image_url: form.image_url || null,
    };

    const { error } = item
      ? await supabase.from("menu_items").update(payload).eq("id", item.id)
      : await supabase.from("menu_items").insert(payload);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(item ? "Menu item updated" : "Menu item added");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {form.image_url ? (
                <Image src={form.image_url} alt="Preview" fill className="object-cover" />
              ) : (
                <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload Image
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </Label>
              <Button
                type="button"
                variant={canUseAi ? "outline" : "ghost"}
                size="sm"
                onClick={handleAiGenerate}
                disabled={generating}
                className="justify-start"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : canUseAi ? <Sparkles className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                AI Generate {!canUseAi && "(Pro)"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingredients">Ingredients</Label>
            <Textarea
              id="ingredients"
              placeholder="e.g. Rice, goat meat, onions, spices"
              value={form.ingredients}
              onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
            />
          </div>

          <DialogFooter>
            <BrandButton type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {item ? "Save Changes" : "Add Item"}
            </BrandButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
