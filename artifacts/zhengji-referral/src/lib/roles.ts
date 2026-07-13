export function normalizeRole(role?: string): string {
  if (!role) return "";
  const aliases: Record<string, string> = {
    admin: "super_admin",
    brand_staff: "outlet_staff",
    zhengji_staff: "outlet_staff",
    kiri_partner: "partner_admin",
    partner: "partner_staff",
  };
  return aliases[role] ?? role;
}

export function hasRole(role: string | undefined, allowed: string[]): boolean {
  const normalized = normalizeRole(role);
  return normalized === "super_admin" || allowed.map(normalizeRole).includes(normalized);
}

export function dashboardForRole(role?: string): string {
  const normalized = normalizeRole(role);
  if (normalized === "partner_admin" || normalized === "partner_staff") return "/partner";
  if (normalized === "outlet_staff") return "/staff";
  return "/admin";
}
