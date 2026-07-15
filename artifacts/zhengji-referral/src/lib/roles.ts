/**
 * The live Supabase database (provisioned ahead of this codebase) stores
 * users under the newer 6-role scheme (super_admin, brand_admin,
 * outlet_staff, finance, partner_admin, partner_staff) while this frontend
 * was written against the older 3-role scheme (admin, zhengji_staff,
 * kiri_partner). This mirrors the alias table in the API server's
 * requireRole() so both schemes route to the correct dashboard/pages
 * until the full V2 role rebuild lands.
 */
const ROLE_ALIASES: Record<string, string[]> = {
  admin: ["admin", "super_admin"],
  zhengji_staff: ["zhengji_staff", "brand_admin", "outlet_staff"],
  finance: ["finance"],
  kiri_partner: ["kiri_partner", "partner_admin", "partner_staff"],
};

export function expandRoles(roles: string[]): string[] {
  const expanded = new Set<string>();
  for (const role of roles) {
    for (const alias of ROLE_ALIASES[role] ?? [role]) {
      expanded.add(alias);
    }
  }
  return [...expanded];
}

export function roleMatches(userRole: string | undefined, roles: string[]): boolean {
  if (!userRole) return false;
  return expandRoles(roles).includes(userRole);
}

/** Returns the landing route for a given user role, or null if unrecognized. */
export function getRoleHomePath(role: string | undefined): string | null {
  if (!role) return null;
  if (roleMatches(role, ["admin"])) return "/admin";
  if (roleMatches(role, ["finance"])) return "/finance";
  if (roleMatches(role, ["zhengji_staff"])) return "/staff";
  if (roleMatches(role, ["kiri_partner"])) return "/partner";
  return null;
}
