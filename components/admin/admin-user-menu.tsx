"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function AdminUserMenu({
  userName,
  userRole,
  avatarUrl: initialAvatarUrl,
}: {
  userName: string;
  userRole: UserRole;
  avatarUrl?: string | null;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? null);
  const [uploading, setUploading] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/profile/avatar", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      setAvatarUrl(data.avatarUrl as string);
      toast.success("Profile photo updated");
    } finally {
      setUploading(false);
    }
  }

  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFileChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-transparent py-1.5 pl-2 pr-3 outline-none transition-colors hover:border-[var(--admin-border)] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[var(--admin-brand)]"
            aria-label="Open profile menu"
          >
            <Avatar className="h-9 w-9">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback
                className="text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--admin-brand, #9E2E2E)" }}
              >
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left lg:block">
              <p className="max-w-[8rem] truncate text-sm font-semibold leading-tight text-[var(--admin-text)]">
                {userName}
              </p>
              <p className="text-xs leading-tight text-[var(--admin-muted)]">{roleLabel}</p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="admin-glass-panel w-56 border-0">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={uploading}
            onSelect={(e) => {
              e.preventDefault();
              fileRef.current?.click();
            }}
            className="cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? "Uploading…" : "Upload photo"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className={cn("cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600")}
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
