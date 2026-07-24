"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import {
  ChefHat,
  Copy,
  CreditCard,
  Download,
  QrCode,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { useAdminBrandColor } from "@/components/admin/admin-brand-context";
import { resolveBrandColor } from "@/lib/brand/restaurant-brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StaffDashboard = {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

function StaffDashboardCard({
  dashboard,
  fullUrl,
  brandAccent,
  onShowQr,
  onCopyLink,
}: {
  dashboard: StaffDashboard;
  fullUrl: string;
  brandAccent: string;
  onShowQr: () => void;
  onCopyLink: () => void;
}) {
  const Icon = dashboard.icon;

  return (
    <Link
      href={dashboard.path}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm",
        "transition-all duration-200 hover:scale-[1.02] hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A373] focus-visible:ring-offset-2"
      )}
    >
      <div className="bg-[#0F172A] px-6 py-8">
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: brandAccent }}
        >
          <Icon className="h-8 w-8 text-white" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-white">{dashboard.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{dashboard.description}</p>
        <p className="mt-3 text-xs font-medium text-white/60">Click to open dashboard →</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <p className="break-all rounded-xl bg-[#F8FAFC] px-4 py-3 font-mono text-xs text-[#64748B]">
          {dashboard.path}
        </p>
        <div className="mt-auto grid gap-3 sm:grid-cols-2">
          <BrandButton
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCopyLink();
            }}
            className="h-14 rounded-xl text-base font-semibold"
          >
            <Copy className="mr-2 h-5 w-5" aria-hidden="true" />
            Copy Link
          </BrandButton>
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onShowQr();
            }}
            className="h-14 rounded-xl border-[#0F172A] text-base font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
          >
            <QrCode className="mr-2 h-5 w-5" aria-hidden="true" />
            QR Code
          </Button>
        </div>
        <p className="text-center text-xs text-[#94A3B8]">{fullUrl}</p>
      </div>
    </Link>
  );
}

export function StaffAccessBoard({
  slug,
  appUrl,
  restaurantName,
}: {
  slug: string;
  appUrl: string;
  restaurantName: string;
}) {
  const brandColor = useAdminBrandColor();
  const brandAccent = resolveBrandColor(brandColor);
  const qrRef = useRef<HTMLDivElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [activeDashboard, setActiveDashboard] = useState<StaffDashboard | null>(null);

  const dashboards: StaffDashboard[] = [
    {
      id: "kitchen",
      title: "Kitchen Dashboard",
      description: "For the chef to see incoming orders and mark them 'Ready'.",
      path: `/staff/${slug}/kitchen`,
      icon: ChefHat,
    },
    {
      id: "waiter",
      title: "Waiter Dashboard",
      description: "For waiters to see 'Ready' orders and mark them 'Delivered'.",
      path: `/staff/${slug}/waiter`,
      icon: UserRound,
    },
    {
      id: "cashier",
      title: "Cashier Dashboard",
      description: "For the cashier to see all orders and confirm payments.",
      path: `/staff/${slug}/cashier`,
      icon: CreditCard,
    },
  ];

  function buildFullUrl(path: string) {
    const base = appUrl.replace(/\/$/, "");
    return `${base}${path}`;
  }

  async function handleCopyLink(path: string) {
    const fullUrl = buildFullUrl(path);
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  }

  function handleShowQr(dashboard: StaffDashboard) {
    setActiveDashboard(dashboard);
    setQrOpen(true);
  }

  function handleDownloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas || !activeDashboard) return;
    const link = document.createElement("a");
    link.download = `${restaurantName}-${activeDashboard.id}-dashboard-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const activeUrl = activeDashboard ? buildFullUrl(activeDashboard.path) : "";

  return (
    <div className="space-y-8">
      <header className="rounded-2xl bg-[#0F172A] px-6 py-8 sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider" style={{ color: brandAccent }}>
          Team access
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Staff Access</h1>
        <p className="mt-2 max-w-2xl text-[#94A3B8]">
          Open a dashboard with one click, or share the link / QR code for tablet setup.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {dashboards.map((dashboard) => (
          <StaffDashboardCard
            key={dashboard.id}
            dashboard={dashboard}
            brandAccent={brandAccent}
            fullUrl={buildFullUrl(dashboard.path)}
            onCopyLink={() => handleCopyLink(dashboard.path)}
            onShowQr={() => handleShowQr(dashboard)}
          />
        ))}
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md border-[#E2E8F0]">
          <DialogHeader>
            <DialogTitle className="text-[#0F172A]">
              {activeDashboard?.title ?? "Dashboard QR Code"}
            </DialogTitle>
            <DialogDescription>
              Scan to open this dashboard on a staff device.
            </DialogDescription>
          </DialogHeader>

          {activeUrl && (
            <div className="flex flex-col items-center gap-4">
              <div ref={qrRef} className="rounded-xl border bg-white p-4">
                <QRCodeCanvas value={activeUrl} size={240} includeMargin />
              </div>
              <p className="break-all text-center text-xs text-[#64748B]">{activeUrl}</p>
              <Button
                type="button"
                onClick={handleDownloadQr}
                className="h-12 w-full rounded-xl bg-[#0F172A] font-semibold text-white hover:bg-[#1E293B]"
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download QR Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
