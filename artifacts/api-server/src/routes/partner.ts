import { Router, type IRouter } from "express";
import {
  db,
  leadsTable,
  commissionsTable,
  partnersTable,
  usersTable,
  auditLogTable,
} from "@workspace/db";
import { eq, and, desc, count, sum, sql } from "drizzle-orm";
import { requireAuth, requireRole, hashPassword, generateToken, addAuditLog } from "../lib/auth";

const router: IRouter = Router();

router.get("/partners", requireAuth, requireRole("admin", "zhengji_staff", "finance"), async (req, res): Promise<void> => {
  const partners = await db.select().from(partnersTable).orderBy(desc(partnersTable.createdAt));
  res.json(partners.map(p => ({
    ...p,
    totalCommissionEarned: parseFloat(p.totalCommissionEarned),
  })));
});

router.post("/partners", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { displayName, kirimembershipId, phone, username, password } = req.body;
  if (!displayName || !kirimembershipId || !username || !password) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const passwordHash = hashPassword(password);
  const referralCode = "KIRI" + kirimembershipId.replace(/\W/g, "").toUpperCase().slice(0, 6);

  const [user] = await db
    .insert(usersTable)
    .values({ username, passwordHash, role: "kiri_partner", displayName })
    .returning();

  const [partner] = await db
    .insert(partnersTable)
    .values({
      userId: user.id,
      displayName,
      referralCode,
      kirimembershipId,
      phone: phone ?? null,
      isActive: true,
    })
    .returning();

  const performedBy = (req as any).user?.userId?.toString() ?? "admin";
  await addAuditLog(db, auditLogTable, {
    entityType: "partner",
    entityId: partner.id,
    action: "created",
    newValue: displayName,
    performedBy,
  });

  res.status(201).json({
    ...partner,
    totalCommissionEarned: parseFloat(partner.totalCommissionEarned),
  });
});

router.get("/partners/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, id));
  if (!partner) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ ...partner, totalCommissionEarned: parseFloat(partner.totalCommissionEarned) });
});

// Partner self-service routes
router.get("/partner/leads", requireAuth, requireRole("kiri_partner"), async (req, res): Promise<void> => {
  const { userId } = (req as any).user;
  const { stage, page = "1" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = 20;
  const offset = (pageNum - 1) * limitNum;

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.userId, userId));
  if (!partner) { res.status(404).json({ error: "Partner not found" }); return; }

  const conditions: any[] = [eq(leadsTable.partnerId, partner.id)];
  if (stage) conditions.push(eq(leadsTable.stage, stage as any));

  const [{ total }] = await db.select({ total: count() }).from(leadsTable).where(and(...conditions));
  const leads = await db.select().from(leadsTable).where(and(...conditions)).orderBy(desc(leadsTable.createdAt)).limit(limitNum).offset(offset);

  res.json({
    leads: leads.map(l => ({ ...l, partnerName: partner.displayName, netSaleAmount: l.netSaleAmount != null ? parseFloat(l.netSaleAmount) : null })),
    total: Number(total),
    page: pageNum,
    limit: limitNum,
  });
});

router.get("/partner/commissions", requireAuth, requireRole("kiri_partner"), async (req, res): Promise<void> => {
  const { userId } = (req as any).user;
  const { status, page = "1" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = 20;
  const offset = (pageNum - 1) * limitNum;

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.userId, userId));
  if (!partner) { res.status(404).json({ error: "Partner not found" }); return; }

  const conditions: any[] = [eq(commissionsTable.partnerId, partner.id)];
  if (status) conditions.push(eq(commissionsTable.status, status as any));

  const [{ total }] = await db.select({ total: count() }).from(commissionsTable).where(and(...conditions));
  const comms = await db.select().from(commissionsTable).where(and(...conditions)).orderBy(desc(commissionsTable.createdAt)).limit(limitNum).offset(offset);

  const enriched = await Promise.all(comms.map(async (c) => {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, c.leadId));
    return {
      ...c,
      leadName: lead?.name ?? "Unknown",
      partnerName: partner.displayName,
      amount: parseFloat(c.amount),
      commissionRate: c.commissionRate != null ? parseFloat(c.commissionRate) : null,
      netSaleAmount: c.netSaleAmount != null ? parseFloat(c.netSaleAmount) : null,
      approvedAt: c.approvedAt?.toISOString() ?? null,
      paidAt: c.paidAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }));

  res.json({ commissions: enriched, total: Number(total), page: pageNum, limit: limitNum });
});

router.get("/partner/stats", requireAuth, requireRole("kiri_partner"), async (req, res): Promise<void> => {
  const { userId } = (req as any).user;
  const { month } = req.query as { month?: string };
  const targetMonth = month ?? new Date().toISOString().slice(0, 7);

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.userId, userId));
  if (!partner) { res.status(404).json({ error: "Partner not found" }); return; }

  const monthStart = `${targetMonth}-01`;
  const monthEnd = `${targetMonth}-31`;

  const leads = await db.select().from(leadsTable).where(
    and(
      eq(leadsTable.partnerId, partner.id),
      sql`${leadsTable.createdAt} >= ${monthStart}::date`,
      sql`${leadsTable.createdAt} <= ${monthEnd}::date`
    )
  );

  const totalLeads = leads.length;
  const totalArrivals = leads.filter(l => ["arrived", "free_consultation_only", "first_paid_treatment", "package_purchased"].includes(l.stage)).length;
  const totalConversions = leads.filter(l => ["first_paid_treatment", "package_purchased"].includes(l.stage)).length;

  const comms = await db.select().from(commissionsTable).where(
    and(
      eq(commissionsTable.partnerId, partner.id),
      sql`${commissionsTable.createdAt} >= ${monthStart}::date`,
      sql`${commissionsTable.createdAt} <= ${monthEnd}::date`
    )
  );

  const totalPending = comms.filter(c => c.status === "pending").reduce((s, c) => s + parseFloat(c.amount), 0);
  const totalApproved = comms.filter(c => c.status === "approved").reduce((s, c) => s + parseFloat(c.amount), 0);
  const totalPaid = comms.filter(c => c.status === "paid").reduce((s, c) => s + parseFloat(c.amount), 0);

  res.json({
    month: targetMonth,
    totalLeads,
    totalArrivals,
    totalConversions,
    totalCommissionPending: totalPending,
    totalCommissionApproved: totalApproved,
    totalCommissionPaid: totalPaid,
    conversionRate: totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0,
    tierBonus: null,
    tierBonusLabel: null,
  });
});

router.get("/partner/statement", requireAuth, requireRole("kiri_partner"), async (req, res): Promise<void> => {
  const { userId } = (req as any).user;
  const { month } = req.query as { month?: string };
  const targetMonth = month ?? new Date().toISOString().slice(0, 7);

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.userId, userId));
  if (!partner) { res.status(404).json({ error: "Partner not found" }); return; }

  const monthStart = `${targetMonth}-01`;
  const monthEnd = `${targetMonth}-31`;

  const leads = await db.select().from(leadsTable).where(
    and(
      eq(leadsTable.partnerId, partner.id),
      sql`${leadsTable.createdAt} >= ${monthStart}::date`,
      sql`${leadsTable.createdAt} <= ${monthEnd}::date`
    )
  );

  const comms = await db.select().from(commissionsTable).where(
    and(
      eq(commissionsTable.partnerId, partner.id),
      sql`${commissionsTable.createdAt} >= ${monthStart}::date`,
      sql`${commissionsTable.createdAt} <= ${monthEnd}::date`
    )
  );

  const enrichedLeads = leads.map(l => ({ ...l, partnerName: partner.displayName, netSaleAmount: l.netSaleAmount != null ? parseFloat(l.netSaleAmount) : null }));
  const enrichedComms = comms.map(c => ({
    ...c,
    leadName: leads.find(l => l.id === c.leadId)?.name ?? "Unknown",
    partnerName: partner.displayName,
    amount: parseFloat(c.amount),
    commissionRate: c.commissionRate != null ? parseFloat(c.commissionRate) : null,
    netSaleAmount: c.netSaleAmount != null ? parseFloat(c.netSaleAmount) : null,
    approvedAt: c.approvedAt?.toISOString() ?? null,
    paidAt: c.paidAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const totalConversions = leads.filter(l => ["first_paid_treatment", "package_purchased"].includes(l.stage)).length;
  const totalPending = enrichedComms.filter(c => c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const totalApproved = enrichedComms.filter(c => c.status === "approved").reduce((s, c) => s + c.amount, 0);
  const totalPaid = enrichedComms.filter(c => c.status === "paid").reduce((s, c) => s + c.amount, 0);

  res.json({
    month: targetMonth,
    partnerName: partner.displayName,
    referralCode: partner.referralCode,
    leads: enrichedLeads,
    commissions: enrichedComms,
    summary: {
      month: targetMonth,
      totalLeads: leads.length,
      totalArrivals: leads.filter(l => ["arrived", "free_consultation_only", "first_paid_treatment", "package_purchased"].includes(l.stage)).length,
      totalConversions,
      totalCommissionPending: totalPending,
      totalCommissionApproved: totalApproved,
      totalCommissionPaid: totalPaid,
      conversionRate: leads.length > 0 ? (totalConversions / leads.length) * 100 : 0,
      tierBonus: null,
      tierBonusLabel: null,
    },
  });
});

export default router;
