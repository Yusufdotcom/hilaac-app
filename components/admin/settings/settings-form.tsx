"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Upload, Store, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/lib/supabase/client";
import type { Restaurant } from "@/types/database";

export function SettingsForm({ restaurant }: { restaurant: Restaurant }) {
  const supabase = createClient();
  const router = useRouter();

  const [general, setGeneral] = useState({
    name: restaurant.name,
    address: restaurant.address ?? "",
    phone: restaurant.phone ?? "",
    logo_url: restaurant.logo_url ?? "",
  });
  const [orderTypes, setOrderTypes] = useState({
    dine_in_enabled: restaurant.dine_in_enabled,
    takeaway_enabled: restaurant.takeaway_enabled,
  });
  const [paymentMode, setPaymentMode] = useState<"ussd" | "api">(restaurant.payment_mode);
  const [ussd, setUssd] = useState({
    evc_ussd_code: restaurant.evc_ussd_code ?? "",
    edahab_ussd_code: restaurant.edahab_ussd_code ?? "",
  });
  const [api, setApi] = useState({ evc_merchant_id: "", evc_api_key: "", edahab_merchant_id: "", edahab_api_key: "" });

  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingOrderTypes, setSavingOrderTypes] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [testing, setTesting] = useState<"evc" | "edahab" | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

  async function patchSettings(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/restaurant/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to save");
    return data;
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const path = `${restaurant.id}/logo-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("restaurant-logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("restaurant-logos").getPublicUrl(path);
      setGeneral((g) => ({ ...g, logo_url: data.publicUrl }));
      await patchSettings({ logo_url: data.publicUrl });
      toast.success("Logo updated");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      await patchSettings(general);
      toast.success("Restaurant details saved");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingGeneral(false);
    }
  }

  async function handleToggleOrderType(key: "dine_in_enabled" | "takeaway_enabled") {
    const next = { ...orderTypes, [key]: !orderTypes[key] };
    setOrderTypes(next);
    setSavingOrderTypes(true);
    try {
      await patchSettings(next);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
      setOrderTypes(orderTypes);
    } finally {
      setSavingOrderTypes(false);
    }
  }

  async function handleTestConnection(provider: "evc" | "edahab") {
    const merchantId = provider === "evc" ? api.evc_merchant_id : api.edahab_merchant_id;
    const apiKey = provider === "evc" ? api.evc_api_key : api.edahab_api_key;

    if (!merchantId || !apiKey) {
      toast.error("Enter both Merchant ID and API Key first");
      return;
    }

    setTesting(provider);
    try {
      const res = await fetch("/api/admin/restaurant/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, merchantId, apiKey }),
      });
      const data = await res.json();
      setTestResult((r) => ({ ...r, [provider]: { success: !!data.success, message: data.message ?? data.error } }));
      if (data.success) toast.success(data.message);
      else toast.error(data.error ?? "Connection failed");
    } catch (err: any) {
      toast.error(err?.message ?? "Connection failed");
    } finally {
      setTesting(null);
    }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    setSavingPayment(true);
    try {
      const body: Record<string, unknown> = { payment_mode: paymentMode };
      if (paymentMode === "ussd") {
        Object.assign(body, ussd);
      } else {
        Object.assign(body, api);
      }
      await patchSettings(body);
      toast.success("Payment settings saved");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Restaurant details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Restaurant Details</CardTitle>
          <CardDescription>Your public profile, shown on the ordering page.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveGeneral} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted">
                {general.logo_url ? (
                  <Image src={general.logo_url} alt="Logo" fill className="object-cover" />
                ) : (
                  <Store className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <Label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload Logo
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
              </Label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Restaurant Name</Label>
                <Input id="name" value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={general.phone} onChange={(e) => setGeneral({ ...general, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={general.address} onChange={(e) => setGeneral({ ...general, address: e.target.value })} />
            </div>

            <Button type="submit" disabled={savingGeneral}>
              {savingGeneral && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Details
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Order types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Types</CardTitle>
          <CardDescription>Choose which ordering flows customers can pick from.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Dine-in (Fadhi)</p>
              <p className="text-sm text-muted-foreground">Customers order from their table.</p>
            </div>
            <Switch checked={orderTypes.dine_in_enabled} disabled={savingOrderTypes} onCheckedChange={() => handleToggleOrderType("dine_in_enabled")} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Takeaway (Qaadasho)</p>
              <p className="text-sm text-muted-foreground">Customers order for pickup.</p>
            </div>
            <Switch checked={orderTypes.takeaway_enabled} disabled={savingOrderTypes} onCheckedChange={() => handleToggleOrderType("takeaway_enabled")} />
          </div>
        </CardContent>
      </Card>

      {/* Payment mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Mode</CardTitle>
          <CardDescription>USSD is manual dial-and-confirm. API auto-confirms payments via webhook.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePayment} className="space-y-6">
            <RadioGroup value={paymentMode} onValueChange={(v) => setPaymentMode(v as "ussd" | "api")} className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                <RadioGroupItem value="ussd" id="ussd" />
                <div>
                  <p className="font-medium">USSD</p>
                  <p className="text-xs text-muted-foreground">Customer dials a code manually</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                <RadioGroupItem value="api" id="api" />
                <div>
                  <p className="font-medium">API</p>
                  <p className="text-xs text-muted-foreground">Direct integration, auto-confirmed</p>
                </div>
              </label>
            </RadioGroup>

            {paymentMode === "ussd" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="evc_ussd">EVC USSD Code</Label>
                  <Input
                    id="evc_ussd"
                    placeholder="*712*1*1#"
                    value={ussd.evc_ussd_code}
                    onChange={(e) => setUssd({ ...ussd, evc_ussd_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edahab_ussd">eDahab USSD Code</Label>
                  <Input
                    id="edahab_ussd"
                    placeholder="*888*1*1#"
                    value={ussd.edahab_ussd_code}
                    onChange={(e) => setUssd({ ...ussd, edahab_ussd_code: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3 rounded-lg border p-4">
                  <p className="font-medium">EVC API Credentials</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Merchant ID"
                      value={api.evc_merchant_id}
                      onChange={(e) => setApi({ ...api, evc_merchant_id: e.target.value })}
                    />
                    <Input
                      placeholder="API Key"
                      type="password"
                      value={api.evc_api_key}
                      onChange={(e) => setApi({ ...api, evc_api_key: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleTestConnection("evc")} disabled={testing === "evc"}>
                      {testing === "evc" && <Loader2 className="h-4 w-4 animate-spin" />}
                      Test Connection
                    </Button>
                    {testResult.evc && (
                      <span className={`flex items-center gap-1 text-sm ${testResult.evc.success ? "text-hilaac-gold" : "text-destructive"}`}>
                        {testResult.evc.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {testResult.evc.message}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <p className="font-medium">eDahab API Credentials</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Merchant ID"
                      value={api.edahab_merchant_id}
                      onChange={(e) => setApi({ ...api, edahab_merchant_id: e.target.value })}
                    />
                    <Input
                      placeholder="API Key"
                      type="password"
                      value={api.edahab_api_key}
                      onChange={(e) => setApi({ ...api, edahab_api_key: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleTestConnection("edahab")} disabled={testing === "edahab"}>
                      {testing === "edahab" && <Loader2 className="h-4 w-4 animate-spin" />}
                      Test Connection
                    </Button>
                    {testResult.edahab && (
                      <span className={`flex items-center gap-1 text-sm ${testResult.edahab.success ? "text-hilaac-gold" : "text-destructive"}`}>
                        {testResult.edahab.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {testResult.edahab.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" disabled={savingPayment}>
              {savingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Payment Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
