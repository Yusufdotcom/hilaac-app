"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Plus, Trash2, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import type { RestaurantTable } from "@/types/database";

export function TableManager({
  restaurantId,
  tables,
  orderUrl,
  restaurantName,
}: {
  restaurantId: string;
  tables: RestaurantTable[];
  orderUrl: string;
  restaurantName: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [tableNumber, setTableNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!tableNumber.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("tables").insert({ restaurant_id: restaurantId, table_number: tableNumber.trim() });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTableNumber("");
    toast.success("Table added");
    router.refresh();
  }

  async function toggleActive(table: RestaurantTable) {
    const { error } = await supabase.from("tables").update({ is_active: !table.is_active }).eq("id", table.id);
    if (error) return toast.error(error.message);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("tables").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Table removed");
    router.refresh();
  }

  function handleDownloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${restaurantName}-qr-code.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(orderUrl);
    toast.success("Order link copied");
  }

  return (
    <div className="w-full space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">Tables</h1>
        <p className="text-muted-foreground">Manage table numbers and your restaurant&apos;s ordering QR code.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="w-full overflow-hidden lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Ordering QR Code</CardTitle>
            <CardDescription>One QR code for your whole restaurant. Print and place it on every table.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div ref={qrRef} className="rounded-xl border bg-white p-4">
              <QRCodeCanvas value={orderUrl} size={200} includeMargin />
            </div>
            <p className="w-full break-all text-center text-xs text-muted-foreground">{orderUrl}</p>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="w-full flex-1" onClick={handleCopyLink}>
                <Copy className="h-4 w-4" /> Copy Link
              </Button>
              <BrandButton className="w-full flex-1" onClick={handleDownloadQr}>
                <Download className="h-4 w-4" /> Download
              </BrandButton>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full overflow-hidden lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Table Numbers</CardTitle>
            <CardDescription>Customers enter this number after choosing &quot;Fadhi&quot; (Dine-in).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row">
              <Input
                placeholder="e.g. 12"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full min-w-0"
              />
              <BrandButton type="submit" disabled={loading} className="w-full shrink-0 sm:w-auto">
                <Plus className="h-4 w-4" /> Add Table
              </BrandButton>
            </form>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tables.length === 0 && <p className="text-muted-foreground">No tables yet.</p>}
              {tables.map((table) => (
                <div key={table.id} className="flex w-full items-center justify-between gap-2 rounded-lg border p-3">
                  <span className="truncate font-medium">Table {table.table_number}</span>
                  <div className="flex items-center gap-3">
                    <Switch checked={table.is_active} onCheckedChange={() => toggleActive(table)} />
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(table.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
