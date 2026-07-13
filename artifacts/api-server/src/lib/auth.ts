import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { roleMatches } from "./referralRules";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "zhengji_salt_2024").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateToken(userId: number, role: string): string {
  const payload = JSON.stringify({ userId, role, ts: Date.now() });
  const sig = crypto.createHash("sha256").update(payload + "zhengji_secret_2024").digest("hex");
  return Buffer.from(payload).toString("base64") + "." + sig;
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const payload = Buffer.from(payloadB64, "base64").toString("utf8");
    const expectedSig = crypto.createHash("sha256").update(payload + "zhengji_secret_2024").digest("hex");
    if (sig !== expectedSig) return null;
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  (req as any).user = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || !roleMatches(user.role, roles)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function getAuditContext(req: Request) {
  const actor = (req as any).user?.userId?.toString() ?? "system";
  const forwardedFor = req.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() || req.ip || null;

  return {
    performedBy: actor,
    ipAddress,
    userAgent: req.headers["user-agent"] ?? null,
    sessionId: req.headers["x-session-id"]?.toString() ?? null,
  };
}

export function addAuditLog(
  db: any,
  auditLogTable: any,
  params: {
    brandId?: number | null;
    entityType: string;
    entityId: number;
    action: string;
    previousValue?: string | null;
    newValue?: string | null;
    previousAmount?: string | number | null;
    newAmount?: string | number | null;
    auditNote?: string | null;
    performedBy: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    sessionId?: string | null;
  }
) {
  return db.insert(auditLogTable).values({
    brandId: params.brandId ?? null,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    previousValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    previousAmount: params.previousAmount != null ? params.previousAmount.toString() : null,
    newAmount: params.newAmount != null ? params.newAmount.toString() : null,
    auditNote: params.auditNote ?? null,
    performedBy: params.performedBy,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    sessionId: params.sessionId ?? null,
  });
}
