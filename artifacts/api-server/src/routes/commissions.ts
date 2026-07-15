import { Router, type IRouter } from "express";
import { db, commissionsTable, leadsTable, partnersTable, auditLogTable } from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { requireAuth, requireRole, addAuditLog } from "../lib/auth";

const router: IRouter = Router();

async function enrichCommission(comm: any) {
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, comm.leadId));
  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, comm.partnerId));
  return {
    ...comm,
    leadName: lead?.name ?? "Unknown",
    partnerName: partner?.displayName ?? "Unknown",
    amount: parseFloat(comm.amount),
    commissionRate: comm.commissionRate != null ? parseFloat(comm.commissionRate) : null,
    netSaleAmount: comm.netSaleAmount != null ? parseFloat(comm.netSaleAmount) : null,
    approvedAt: comm.approvedAt?.toISOString() ?? null,
    paidAt: comm.paidAt?.toISOString() ?? null,
    createdAt: comm.createdAt.toISOString(),
    updatedAt: comm.updatedAt.toISOString(),
  };
}

router.get("/commissions", requireAuth, requireRole("admin", "zhengji_staff", "finance"), async (req, res): Promise<void> => {
  const { status, partnerId, unbatched, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, parseInt(limit, 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (status) conditions.push(eq(commissionsTable.status, status as any));
  if (partnerId) conditions.push(eq(commissionsTable.partnerId, parseInt(partnerId, 10)));
  // "Unbatched" has no dedicated column (payout_batches.commission_ids is a JSON
  // array, not a reverse FK) - a commission counts as unbatched if its id does
  // not appear in any non-void batch's commission_ids array.
  if (unbatched === "true") {
    conditions.push(sql`${commissionsTable.id} NOT IN (
      SELECT (jsonb_array_elements_text(commission_ids::jsonb))::int
      FROM payout_batches
      WHERE status != 'void'
    )`);
  }

  const query = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(commissionsTable).where(query);
  const comms = await db.select().from(commissionsTable).where(query).orderBy(desc(commissionsTable.createdAt)).limit(limitNum).offset(offset);

  const enriched = await Promise.all(comms.map(enrichCommission));
  res.json({ commissions: enriched, total: Number(total), page: pageNum, limit: limitNum });
});

router.get("/commissions/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }

  res.json(await enrichCommission(comm));
});

router.patch("/commissions/:id/approve", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { auditNote } = req.body;
  const performedBy = (req as any).user?.userId?.toString() ?? "staff";

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db
    .update(commissionsTable)
    .set({ status: "approved", approvedBy: performedBy, approvedAt: new Date(), auditNote: auditNote ?? null })
    .where(eq(commissionsTable.id, id))
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "commission",
    entityId: id,
    action: "approved",
    previousValue: comm.status,
    newValue: "approved",
    auditNote: auditNote ?? null,
    performedBy,
  });

  res.json(await enrichCommission(updated));
});

router.patch("/commissions/:id/reject", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { auditNote } = req.body;
  const performedBy = (req as any).user?.userId?.toString() ?? "staff";

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db
    .update(commissionsTable)
    .set({ status: "rejected", auditNote: auditNote ?? null })
    .where(eq(commissionsTable.id, id))
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "commission",
    entityId: id,
    action: "rejected",
    previousValue: comm.status,
    newValue: "rejected",
    auditNote: auditNote ?? null,
    performedBy,
  });

  res.json(await enrichCommission(updated));
});

router.patch("/commissions/:id/pay", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { payoutReference, auditNote } = req.body;
  if (!payoutReference) { res.status(400).json({ error: "payoutReference required" }); return; }

  const performedBy = (req as any).user?.userId?.toString() ?? "admin";

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db
    .update(commissionsTable)
    .set({ status: "paid", payoutReference, paidAt: new Date(), auditNote: auditNote ?? null })
    .where(eq(commissionsTable.id, id))
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "commission",
    entityId: id,
    action: "paid",
    previousValue: comm.status,
    newValue: "paid",
    auditNote: `Payout ref: ${payoutReference}${auditNote ? `. ${auditNote}` : ""}`,
    performedBy,
  });

  res.json(await enrichCommission(updated));
});

router.patch("/commissions/:id/dispute", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { auditNote } = req.body;
  const performedBy = (req as any).user?.userId?.toString() ?? "staff";

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db
    .update(commissionsTable)
    .set({ status: "disputed", auditNote: auditNote ?? null })
    .where(eq(commissionsTable.id, id))
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "commission",
    entityId: id,
    action: "disputed",
    previousValue: comm.status,
    newValue: "disputed",
    auditNote: auditNote ?? null,
    performedBy,
  });

  res.json(await enrichCommission(updated));
});

export default router;
