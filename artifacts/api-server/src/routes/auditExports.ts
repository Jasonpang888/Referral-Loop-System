import { Router, type IRouter } from "express";
import { db, auditLogTable, leadsTable, commissionsTable, partnersTable } from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { scopedWhere } from "../lib/accessScope";

const router: IRouter = Router();

router.get("/audit-log", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff", "finance"), async (req, res): Promise<void> => {
  const { entityType, page = "1", limit = "50" } = req.query as Record<string, string>;
  const entityId = req.query.entityId ? parseInt(req.query.entityId as string, 10) : undefined;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, parseInt(limit, 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];
  if (entityType) conditions.push(eq(auditLogTable.entityType, entityType));
  if (entityId && !isNaN(entityId)) conditions.push(eq(auditLogTable.entityId, entityId));

  const query = scopedWhere(req, auditLogTable.brandId, conditions);

  const [{ total }] = await db.select({ total: count() }).from(auditLogTable).where(query);
  const entries = await db
    .select()
    .from(auditLogTable)
    .where(query)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  res.json({
    entries: entries.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
    total: Number(total),
    page: pageNum,
    limit: limitNum,
  });
});

function leadsToCSV(leads: any[]): string {
  const header = ["ID", "Name", "Mobile", "WhatsApp", "Kiri Membership ID", "Referral Code", "Partner", "Stage", "Selected Offer", "Appointment Date", "Net Sale (RM)", "Consent", "Created At"];
  const rows = leads.map(l => [
    l.id,
    l.name,
    l.mobile,
    l.whatsapp ?? "",
    l.kirimembershipId ?? "",
    l.referralCode,
    l.partnerName ?? "",
    l.stage,
    l.selectedOffer,
    l.appointmentDate ?? "",
    l.netSaleAmount ?? "",
    l.consentGiven ? "Yes" : "No",
    l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
  ]);
  return [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function commissionsToCSV(comms: any[]): string {
  const header = ["ID", "Lead Name", "Partner Name", "Amount (RM)", "Commission Type", "Rate (%)", "Net Sale (RM)", "Status", "Payout Reference", "Approved By", "Approved At", "Paid At", "Created At"];
  const rows = comms.map(c => [
    c.id,
    c.leadName ?? "",
    c.partnerName ?? "",
    parseFloat(c.amount),
    c.commissionType,
    c.commissionRate ?? "",
    c.netSaleAmount ?? "",
    c.status,
    c.payoutReference ?? "",
    c.approvedBy ?? "",
    c.approvedAt ? (c.approvedAt instanceof Date ? c.approvedAt.toISOString() : c.approvedAt) : "",
    c.paidAt ? (c.paidAt instanceof Date ? c.paidAt.toISOString() : c.paidAt) : "",
    c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  ]);
  return [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

router.get("/exports/leads", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff", "finance"), async (req, res): Promise<void> => {
  const { stage, from, to } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (stage) conditions.push(eq(leadsTable.stage, stage as any));
  if (from) conditions.push(sql`${leadsTable.createdAt} >= ${from}::date`);
  if (to) conditions.push(sql`${leadsTable.createdAt} <= ${to}::date`);

  const leads = await db.select().from(leadsTable).where(scopedWhere(req, leadsTable.brandId, conditions)).orderBy(desc(leadsTable.createdAt));

  const enriched = await Promise.all(leads.map(async l => {
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, l.partnerId));
    return { ...l, partnerName: partner?.displayName ?? "" };
  }));

  const csvData = leadsToCSV(enriched);
  const filename = `zhengji_leads_${new Date().toISOString().slice(0, 10)}.csv`;

  res.json({ csvData, filename, rowCount: leads.length });
});

router.get("/exports/commissions", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff", "finance"), async (req, res): Promise<void> => {
  const { status, from, to } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (status) conditions.push(eq(commissionsTable.status, status as any));
  if (from) conditions.push(sql`${commissionsTable.createdAt} >= ${from}::date`);
  if (to) conditions.push(sql`${commissionsTable.createdAt} <= ${to}::date`);

  const comms = await db.select().from(commissionsTable).where(scopedWhere(req, commissionsTable.brandId, conditions)).orderBy(desc(commissionsTable.createdAt));

  const enriched = await Promise.all(comms.map(async c => {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, c.leadId));
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, c.partnerId));
    return { ...c, leadName: lead?.name ?? "", partnerName: partner?.displayName ?? "" };
  }));

  const csvData = commissionsToCSV(enriched);
  const filename = `zhengji_commissions_${new Date().toISOString().slice(0, 10)}.csv`;

  res.json({ csvData, filename, rowCount: comms.length });
});

export default router;
