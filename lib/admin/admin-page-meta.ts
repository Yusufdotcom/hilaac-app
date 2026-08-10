export type AdminPageMeta = {
  title: string;
  crumb: string;
};

const PAGE_META: Record<string, AdminPageMeta> = {
  dashboard: { title: "Dashboard", crumb: "Pages / Dashboard" },
  menu: { title: "Menu", crumb: "Pages / Menu" },
  tables: { title: "Tables", crumb: "Pages / Tables" },
  orders: { title: "Orders", crumb: "Pages / Orders" },
  reports: { title: "Reports", crumb: "Pages / Reports" },
  staff: { title: "Staff", crumb: "Pages / Staff" },
  "staff-access": { title: "Staff", crumb: "Pages / Staff" },
  settings: { title: "Settings", crumb: "Pages / Settings" },
  billing: { title: "Billing", crumb: "Pages / Billing" },
};

const FALLBACK: AdminPageMeta = { title: "Admin", crumb: "Pages / Admin" };

/** Resolve TopBar title/crumb from `/admin/[slug]/[segment]/...`. */
export function getAdminPageMeta(pathname: string | null): AdminPageMeta {
  if (!pathname) return FALLBACK;
  const parts = pathname.split("/").filter(Boolean);
  // admin / slug / segment
  const segment = parts[2] ?? "dashboard";
  return PAGE_META[segment] ?? FALLBACK;
}
