import fs from "fs";

const files = [
  "components/admin/reports/reports-client.tsx",
  "components/admin/reports/report-charts.tsx",
  "components/admin/staff-access/staff-access-board.tsx",
  "components/admin/staff/waiter-manager.tsx",
  "components/admin/settings/settings-form.tsx",
  "components/admin/settings/manage-branches.tsx",
  "components/admin/admin-sidebar.tsx",
  "components/admin/admin-search.tsx",
  "components/admin/admin-notifications.tsx",
  "components/admin/admin-user-menu.tsx",
  "components/admin/orders/admin-orders-board.tsx",
  "components/admin/menu/menu-item-section.tsx",
];

const reps = [
  [/bg-slate-50(?!\/)/g, "bg-[var(--admin-bg)]"],
  [/border-slate-200/g, "border-[var(--admin-border)]"],
  [/border-slate-300/g, "border-[var(--admin-border)]"],
  [/bg-white(?![\/\d])/g, "bg-[var(--admin-card)]"],
  [/bg-slate-100/g, "bg-[var(--admin-subtle)]"],
  [/bg-slate-50\/80/g, "bg-[var(--admin-subtle)]"],
  [/text-slate-900/g, "text-[var(--admin-text)]"],
  [/text-\[#0F172A\]/g, "text-[var(--admin-text)]"],
  [/text-slate-800/g, "text-[var(--admin-text)]"],
  [/text-slate-700/g, "text-[var(--admin-text)]"],
  [/text-slate-600/g, "text-[var(--admin-muted)]"],
  [/text-slate-500/g, "text-[var(--admin-muted)]"],
  [/text-slate-400/g, "text-[var(--admin-muted)]"],
  [/hover:bg-white(?![\/])/g, "hover:bg-[var(--admin-card)]"],
  [/hover:bg-slate-50(?![\/])/g, "hover:bg-[var(--admin-hover)]"],
  [/hover:bg-slate-50\/80/g, "hover:bg-[var(--admin-hover)]"],
  [/hover:text-slate-900/g, "hover:text-[var(--admin-text)]"],
  [/border-\[#E2E8F0\]/g, "border-[var(--admin-border)]"],
  [/bg-\[#F8FAFC\]/g, "bg-[var(--admin-subtle)]"],
  [/rounded-xl border border-slate-200 bg-white/g, "admin-surface rounded-xl border"],
];

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log("missing", f);
    continue;
  }
  let t = fs.readFileSync(f, "utf8");
  const before = t;
  for (const [re, to] of reps) t = t.replace(re, to);

  // QR must stay pure white for scanning / MFA
  t = t.replace(
    /ref=\{qrRef\} className="rounded-xl border bg-\[var\(--admin-card\)\] p-4"/g,
    'ref={qrRef} className="rounded-xl border bg-white p-4"'
  );
  t = t.replace(
    /justify-center bg-\[var\(--admin-card\)\] p-3/g,
    "justify-center bg-white p-3"
  );
  // Plan card CTA on brand-colored sidebar can stay white
  t = t.replace(
    /rounded-lg bg-\[var\(--admin-card\)\] py-1\.5 text-center text-xs font-semibold/g,
    "rounded-lg bg-white py-1.5 text-center text-xs font-semibold"
  );
  t = t.replace(
    /rounded-full bg-\[var\(--admin-card\)\]\/20/g,
    "rounded-full bg-white/20"
  );

  if (t !== before) {
    fs.writeFileSync(f, t);
    console.log("updated", f);
  } else {
    console.log("unchanged", f);
  }
}
