"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Upload, Store, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrandRadioOption } from "@/components/admin/brand-radio-option";
import { RadioGroup } from "@/components/ui/radio-group";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_BRAND_COLOR, normalizeHex, resolveBrandColor } from "@/lib/brand/restaurant-brand";
import type { BillingModel, Restaurant } from "@/types/database";

export function SettingsForm({ restaurant }: { restaurant: Restaurant }) {
  const supabase = createClient();
  const router = useRouter();

  const [general, setGeneral] = useState({
    name: restaurant.name,
    address: restaurant.address ?? "",
    phone: restaurant.phone ?? "",
    logo_url: restaurant.logo_url ?? "",
  });
  const [brandColor, setBrandColor] = useState(
    resolveBrandColor(restaurant.brand_color ?? DEFAULT_BRAND_COLOR)
  );
  const [customBrandingEnabled, setCustomBrandingEnabled] = useState(
    restaurant.custom_branding_enabled ?? false
  );
  const isPro = restaurant.subscription_tier === "pro";
  const [orderTypes, setOrderTypes] = useState({
    dine_in_enabled: restaurant.dine_in_enabled,
    takeaway_enabled: restaurant.takeaway_enabled,
  });
  const [paymentMode, setPaymentMode] = useState<"ussd" | "api">(restaurant.payment_mode);
  const [billingRules, setBillingRules] = useState({
    billing_model_dinein: (restaurant.billing_model_dinein ?? "pay_before") as BillingModel,
    billing_model_takeaway: (restaurant.billing_model_takeaway ?? "pay_before") as BillingModel,
  });
  const [ussd, setUssd] = useState({
    evc_ussd_code: restaurant.evc_ussd_code ?? "",
    edahab_ussd_code: restaurant.edahab_ussd_code ?? "",
  });
  const [api, setApi] = useState({ evc_merchant_id: "", evc_api_key: "", edahab_merchant_id: "", edahab_api_key: "" });

  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingBrandColor, setSavingBrandColor] = useState(false);
  const [savingCustomBranding, setSavingCustomBranding] = useState(false);
  const [savingOrderTypes, setSavingOrderTypes] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingBillingRules, setSavingBillingRules] = useState(false);
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

  async function handleSaveBillingRules(e: React.FormEvent) {
    e.preventDefault();
    setSavingBillingRules(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          billing_model_dinein: billingRules.billing_model_dinein,
          billing_model_takeaway: billingRules.billing_model_takeaway,
        })
        .eq("id", restaurant.id);

      if (error) throw error;

      toast.success("Payment rules saved");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save payment rules");
    } finally {
      setSavingBillingRules(false);
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

  async function handleToggleCustomBranding(enabled: boolean) {
    if (!isPro) {
      toast.error("Upgrade to Pro to enable custom customer menu branding");
      return;
    }

    setCustomBrandingEnabled(enabled);
    setSavingCustomBranding(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ custom_branding_enabled: enabled })
        .eq("id", restaurant.id);

      if (error) throw error;

      toast.success(enabled ? "Custom customer branding enabled" : "Custom customer branding disabled");
      router.refresh();
    } catch (err: unknown) {
      setCustomBrandingEnabled(!enabled);
      toast.error(err instanceof Error ? err.message : "Failed to update branding setting");
    } finally {
      setSavingCustomBranding(false);
    }
  }

  async function handleSaveBrandColor(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeHex(brandColor);
    if (!normalized) {
      toast.error("Please choose a valid color");
      return;
    }

    setSavingBrandColor(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ brand_color: normalized })
        .eq("id", restaurant.id);

      if (error) throw error;

      setBrandColor(normalized);
      toast.success("Brand settings saved");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save brand color");
    } finally {
      setSavingBrandColor(false);
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

            <BrandButton type="submit" disabled={savingGeneral}>
              {savingGeneral && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Details
            </BrandButton>
          </form>
        </CardContent>
      </Card>

      {/* Brand settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🎨 Brand Settings</CardTitle>
          <CardDescription>
            Pick any color for your admin and staff dashboard sidebars. Pro restaurants can also apply it to the customer ordering menu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveBrandColor} className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="space-y-2">
                <Label htmlFor="brand-color">Dashboard color</Label>
                <input
                  id="brand-color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
                  className="h-12 w-full max-w-[8rem] cursor-pointer rounded-lg border bg-transparent p-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-color-value">Current value</Label>
                <p
                  id="brand-color-value"
                  className="font-mono text-sm font-medium uppercase tracking-wide text-[#0F172A]"
                >
                  {brandColor}
                </p>
              </div>
              <div
                className="hidden h-12 min-w-[5rem] flex-1 rounded-lg border sm:block"
                style={{ backgroundColor: brandColor }}
                aria-hidden="true"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1 pr-4">
                <Label htmlFor="custom-branding-toggle" className="text-sm font-medium">
                  Enable custom branding on customer menu (Pro only)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Applies your brand color to buttons and highlights on the public ordering page.
                </p>
              </div>
              <Switch
                id="custom-branding-toggle"
                checked={customBrandingEnabled}
                disabled={!isPro || savingCustomBranding}
                onCheckedChange={handleToggleCustomBranding}
              />
            </div>

            <BrandButton type="submit" disabled={savingBrandColor}>
              {savingBrandColor && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </BrandButton>
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

      {/* Payment rules per order type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Rules per Order Type</CardTitle>
          <CardDescription>
            Choose when customers pay for dine-in vs takeaway orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveBillingRules} className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium">🍽️ Dine-in: Pay before cooking or Pay after meal?</p>
              <RadioGroup
                value={billingRules.billing_model_dinein}
                onValueChange={(value) =>
                  setBillingRules((prev) => ({
                    ...prev,
                    billing_model_dinein: value as BillingModel,
                  }))
                }
                className="grid gap-3 sm:grid-cols-2"
              >
                <BrandRadioOption
                  value="pay_before"
                  selectedValue={billingRules.billing_model_dinein}
                  id="dinein-pay-before"
                >
                  <div>
                    <p className="font-medium">Pay before cooking</p>
                    <p className="text-xs text-muted-foreground">Customer pays at checkout (EVC / eDahab)</p>
                  </div>
                </BrandRadioOption>
                <BrandRadioOption
                  value="pay_after"
                  selectedValue={billingRules.billing_model_dinein}
                  id="dinein-pay-after"
                >
                  <div>
                    <p className="font-medium">Pay after meal</p>
                    <p className="text-xs text-muted-foreground">Bill brought to the table later</p>
                  </div>
                </BrandRadioOption>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">📦 Takeaway: Pay before cooking or Pay after meal?</p>
              <RadioGroup
                value={billingRules.billing_model_takeaway}
                onValueChange={(value) =>
                  setBillingRules((prev) => ({
                    ...prev,
                    billing_model_takeaway: value as BillingModel,
                  }))
                }
                className="grid gap-3 sm:grid-cols-2"
              >
                <BrandRadioOption
                  value="pay_before"
                  selectedValue={billingRules.billing_model_takeaway}
                  id="takeaway-pay-before"
                >
                  <div>
                    <p className="font-medium">Pay before cooking</p>
                    <p className="text-xs text-muted-foreground">Customer pays at checkout (EVC / eDahab)</p>
                  </div>
                </BrandRadioOption>
                <BrandRadioOption
                  value="pay_after"
                  selectedValue={billingRules.billing_model_takeaway}
                  id="takeaway-pay-after"
                >
                  <div>
                    <p className="font-medium">Pay on pickup</p>
                    <p className="text-xs text-muted-foreground">Customer pays when collecting the order</p>
                  </div>
                </BrandRadioOption>
              </RadioGroup>
            </div>

            <BrandButton type="submit" disabled={savingBillingRules}>
              {savingBillingRules && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Payment Rules
            </BrandButton>
          </form>
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
              <BrandRadioOption value="ussd" selectedValue={paymentMode} id="ussd">
                <div>
                  <p className="font-medium">USSD</p>
                  <p className="text-xs text-muted-foreground">Customer dials a code manually</p>
                </div>
              </BrandRadioOption>
              <BrandRadioOption value="api" selectedValue={paymentMode} id="api">
                <div>
                  <p className="font-medium">API</p>
                  <p className="text-xs text-muted-foreground">Direct integration, auto-confirmed</p>
                </div>
              </BrandRadioOption>
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

            <BrandButton type="submit" disabled={savingPayment}>
              {savingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Payment Settings
            </BrandButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
