import type { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { normalizeRole } from "./referralRules";

export type ScopedActor = {
  userId: number;
  role: string;
  brandId?: number | null;
};

function parseBrandId(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getScopedActor(req: Request): ScopedActor {
  const user = (req as any).user ?? {};
  return {
    userId: Number(user.userId),
    role: String(user.role ?? ""),
    brandId: parseBrandId(user.brandId),
  };
}

export function isSuperAdmin(req: Request): boolean {
  return normalizeRole(getScopedActor(req).role) === "super_admin";
}

export function getActorBrandId(req: Request): number | null {
  return getScopedActor(req).brandId ?? null;
}

export function getWritableBrandId(req: Request, requestedBrandId?: number | null): number | null {
  if (isSuperAdmin(req)) return requestedBrandId ?? null;
  return getActorBrandId(req);
}

export function appendBrandScope(req: Request, brandColumn: any, conditions: any[] = []): any[] {
  const scoped = [...conditions];
  const actor = getScopedActor(req);
  const requestedBrandId = parseBrandId((req.query as Record<string, unknown>).brandId);

  if (normalizeRole(actor.role) === "super_admin") {
    if (requestedBrandId != null) scoped.push(eq(brandColumn, requestedBrandId));
    return scoped;
  }

  if (actor.brandId == null) {
    scoped.push(sql`false`);
    return scoped;
  }

  if (requestedBrandId != null && requestedBrandId !== actor.brandId) {
    scoped.push(sql`false`);
    return scoped;
  }

  scoped.push(eq(brandColumn, actor.brandId));
  return scoped;
}

export function buildWhere(conditions: any[]) {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function scopedWhere(req: Request, brandColumn: any, conditions: any[] = []) {
  return buildWhere(appendBrandScope(req, brandColumn, conditions));
}

export function canAccessBrand(req: Request, brandId?: number | null): boolean {
  if (isSuperAdmin(req)) return true;
  return brandId != null && brandId === getActorBrandId(req);
}

export function rejectForbiddenBrand(res: Response): void {
  res.status(403).json({ error: "Forbidden for this brand" });
}
