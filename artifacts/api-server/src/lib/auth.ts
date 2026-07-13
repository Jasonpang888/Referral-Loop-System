import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

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
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function addAuditLog(
  db: any,
  auditLogTable: any,
  params: {
    entityType: string;
    entityId: number;
    action: string;
    previousValue?: string | null;
    newValue?: string | null;
    auditNote?: string | null;
    performedBy: string;
  }
) {
  return db.insert(auditLogTable).values({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    previousValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    auditNote: params.auditNote ?? null,
    performedBy: params.performedBy,
  });
}
