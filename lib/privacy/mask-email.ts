/** Redact an email for logs. Example: yusufyare1444@hotmail.com → y***@hotmail.com */
export function maskEmailForLog(email: string | null | undefined): string {
  if (email == null) return "***";
  const raw = String(email).trim();
  if (!raw || !raw.includes("@")) return "***";
  const [local, domain] = raw.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}
