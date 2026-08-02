import type { UserRole } from "@/types/database";

/** Roles that must enroll MFA and complete AAL2 for admin access / sensitive actions. */
export const MFA_REQUIRED_ROLES: UserRole[] = ["owner", "manager"];

/** Shared-tablet roles — never prompt for MFA. */
export const MFA_EXEMPT_ROLES: UserRole[] = ["waiter", "kitchen", "cashier"];

export function roleRequiresMfa(role: string | null | undefined): boolean {
  return role != null && MFA_REQUIRED_ROLES.includes(role as UserRole);
}
