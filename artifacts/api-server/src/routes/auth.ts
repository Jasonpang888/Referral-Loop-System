import { Router, type IRouter } from "express";
import { db, usersTable, partnersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken, requireAuth } from "../lib/auth";
import { normalizeRole } from "../lib/referralRules";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateToken(user.id, user.role);

  let partnerId: number | null = null;
  if (normalizeRole(user.role) === "partner_admin" || normalizeRole(user.role) === "partner_staff") {
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.userId, user.id));
    partnerId = partner?.id ?? null;
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      partnerId,
    },
    token,
  });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const { userId } = (req as any).user;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  let partnerId: number | null = null;
  if (normalizeRole(user.role) === "partner_admin" || normalizeRole(user.role) === "partner_staff") {
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.userId, user.id));
    partnerId = partner?.id ?? null;
  }

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    partnerId,
  });
});

export default router;
