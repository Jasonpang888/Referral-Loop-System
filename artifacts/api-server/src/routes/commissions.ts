import { Router, type IRouter } from "express";
import { db, commissionsTable, leadsTable, partnersTable, auditLogTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth, requireRole, addAuditLog, getAuditContext } from "../lib/auth";
import { canAccessBrand, rejectForbiddenBrand, scopedWhere } from "../lib/accessScope";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number.parseInt(value ?? "", 10);
  return Number.isNaN(id) ? null : id;
}

async function enrichCommission(comm: any) {
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, comm.leadId));
  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, comm.partnerId));
  return {
    ...comm,
    leadName: lead?.name ?? "Unknown",
    partnerName: partner?.displayName ?? "Unknown",
    amount: Number.parseFloat(comm.amount),
    commissionRate: comm.commissionRate != null ? Number.parseFloat(comm.commissionRate) : null,
    netSaleAmount: comm.netSaleAmount != null ? Number.parseFloat(comm.netSaleAmount) : null,
    approvedAt: comm.approvedAt?.toISOString() ?? null,
    paidAt: comm.paidAt?.toISOString() ?? null,
    createdAt: comm.createdAt.toISOString(),
    updatedAt: comm.updatedAt.toISOString(),
  };
}

router.get("/commissions", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff", "finance"), async (req, res): Promise<void> => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, Number.parseInt(page, 10));
  const limitNum = Math.min(100, Number.parseInt(limit, 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (status) conditions.push(eq(commissionsTable.status, status as any));

  const query = scopedWhere(req, commissionsTable.brandId, conditions);

  const [{ total }] = await db.select({ total: count() }).from(commissionsTable).where(query);
  const comms = await db.select().from(commissionsTable).where(query).orderBy(desc(commissionsTable.createdAt)).limit(limitNum).offset(offset);

  const enriched = await Promise.all(comms.map(enrichCommission));
  res.json({ commissions: enriched, total: Number(total), page: pageNum, limit: limitNum });
});

router.get("/commissions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }
  if (!canAccessBrand(req, comm.brandId)) { rejectForbiddenBrand(res); return; }

  res.json(await enrichCommission(comm));
});

router.patch("/commissions/:id/approve", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { auditNote } = req.body;
  const audit = getAuditContext(req);

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }
  if (!canAccessBrand(req, comm.brandId)) { rejectForbiddenBrand(res); return; }
  if (comm.status !== "pending" && comm.status !== "disputed") {
    res.status(409).json({ error: "Only pending or disputed commissions can be approved" });
    return;
  }

  const [updated] = await db
    .update(commissionsTable)
    .set({ status: "approved", approvedBy: audit.performedBy, approvedAt: new Date(), auditNote: auditNote ?? null })
    .where(eq(commissionsTable.id, id))
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "commission",
    entityId: id,
    action: "approved",
    brandId: comm.brandId ?? null,
    previousValue: comm.status,
    newValue: "approved",
    previousAmount: comm.amount,
    newAmount: updated.amount,
    auditNote: auditNote ?? null,
    ...audit,
  });

  res.json(await enrichCommission(updated));
});

router.patch("/commissions/:id/reject", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { auditNote } = req.body;
  const audit = getAuditContext(req);

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }
  if (!canAccessBrand(req, comm.brandId)) { rejectForbiddenBrand(res); return; }
  if (comm.status === "paid") {
    res.status(409).json({ error: "Paid commissions cannot be rejected" });
    return;
  }

  const [updated] = await db
    .update(commissionsTable)
    .set({ status: "rejected", auditNote: auditNote ?? null })
    .where(eq(commissionsTable.id, id))
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "commission",
    entityId: id,
    action: "rejected",
    brandId: comm.brandId ?? null,
    previousValue: comm.status,
    newValue: "rejected",
    previousAmount: comm.amount,
    newAmount: updated.amount,
    auditNote: auditNote ?? null,
    ...audit,
  });

  res.json(await enrichCommission(updated));
});

router.patch("/commissions/:id/pay", requireAuth, requireRole("super_admin", "finance"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { payoutReference, proofUrl, auditNote } = req.body;
  if (!payoutReference) { res.status(400).json({ error: "payoutReference required" }); return; }

  const audit = getAuditContext(req);

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }
  if (!canAccessBrand(req, comm.brandId)) { rejectForbiddenBrand(res); return; }
  if (comm.status !== "approved") {
    res.status(409).json({ error: "Only approved commissions can be paid" });
    return;
  }

  const [updated] = await db
    .update(commissionsTable)
    .set({ status: "paid", payoutReference, proofUrl: proofUrl ?? comm.proofUrl, paidAt: new Date(), auditNote: auditNote ?? null })
    .where(eq(commissionsTable.id, id))
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "commission",
    entityId: id,
    action: "paid",
    brandId: comm.brandId ?? null,
    previousValue: comm.status,
    newValue: "paid",
    previousAmount: comm.amount,
    newAmount: updated.amount,
    auditNote: `Payout ref: ${payoutReference}${auditNote ? `. ${auditNote}` : ""}`,
    ...audit,
  });

  res.json(await enrichCommission(updated));
});

router.patch("/commissions/:id/dispute", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff", "finance"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { auditNote } = req.body;
  const audit = getAuditContext(req);

  const [comm] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!comm) { res.status(404).json({ error: "Not found" }); return; }
  if (!canAccessBrand(req, comm.brandId)) { rejectForbiddenBrand(res); return; }
  if (comm.status === "paid") {
    res.status(409).json({ error: "Paid commissions cannot be disputed from this screen" });
    return;
  }

  const [updated] = await db
    .update(commissionsTable)
    .set({ status: "disputed", auditNote: auditNote ?? null })
    .where(eq(commissionsTable.id, id))
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "commission",
    entityId: id,
    action: "disputed",
    brandId: comm.brandId ?? null,
    previousValue: comm.status,
    newValue: "disputed",
    previousAmount: comm.amount,
    newAmount: updated.amount,
    auditNote: auditNote ?? null,
    ...audit,
  });

  res.json(await enrichCommission(updated));
});

export default router;
