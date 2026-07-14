import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const rawSessionSecret = process.env["SESSION_SECRET"];
if (!rawSessionSecret) {
  throw new Error(
    "SESSION_SECRET environment variable is required but was not provided.",
  );
}
const SESSION_SECRET: string = rawSessionSecret;

const SCRYPT_KEYLEN = 64;

/**
 * Password hashing: scrypt with a random per-password salt (Node built-in,
 * no native addon needed — bcrypt/argon2 would require native bindings that
 * complicate the esbuild bundle). Stored as "salt:derivedKey" (both hex).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const storedKey = Buffer.from(hashHex, "hex");
  if (derivedKey.length !== storedKey.length) return false;
  return crypto.timingSafeEqual(derivedKey, storedKey);
}

/**
 * Token: payload + HMAC-SHA256 signature keyed on SESSION_SECRET (env-provided
 * secret, not a hardcoded string). Format: base64(payload).hexSignature
 */
export function generateToken(userId: number, role: string): string {
  const payload = JSON.stringify({ userId, role, ts: Date.now() });
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64") + "." + sig;
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const payload = Buffer.from(payloadB64, "base64").toString("utf8");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
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
