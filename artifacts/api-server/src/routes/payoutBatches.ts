import { Router, type IRouter } from "express";
import { db, payoutBatchesTable, commissionsTable, leadsTable, partnersTable, auditLogTable } from "@workspace/db";
import { eq, and, desc, count, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole, addAuditLog } from "../lib/auth";

const router: IRouter = Router();

function enrichBatch(batch: any) {
  return {
    ...batch,
    totalAmount: parseFloat(batch.totalAmount),
    paidAt: batch.paidAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  };
}

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

// Batch reference format: PB-YYYYMM-NNN, sequential within the calendar month.
async function generateReference(periodStart: string): Promise<string> {
  const ym = periodStart.slice(0, 7).replace("-", ""); // "2026-07" -> "202607"
  const prefix = `PB-${ym}-`;
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(payoutBatchesTable)
    .where(sql`${payoutBatchesTable.reference} like ${prefix + "%"}`);
  const seq = (Number(cnt) + 1).toString().padStart(3, "0");
  return `${prefix}${seq}`;
}

router.get("/payout-batches", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, parseInt(limit, 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (status) conditions.push(eq(payoutBatchesTable.status, status as any));
  const query = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(payoutBatchesTable).where(query);
  const batches = await db
    .select()
    .from(payoutBatchesTable)
    .where(query)
    .orderBy(desc(payoutBatchesTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  res.json({ batches: batches.map(enrichBatch), total: Number(total), page: pageNum, limit: limitNum });
});

router.post("/payout-batches", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const { periodStart, periodEnd, commissionIds, auditNote } = req.body as {
    periodStart: string; periodEnd: string; commissionIds: number[]; auditNote?: string;
  };
  const performedBy = (req as any).user?.userId?.toString() ?? "finance";

  if (!periodStart || !periodEnd) { res.status(400).json({ error: "periodStart and periodEnd required" }); return; }
  if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
    res.status(400).json({ error: "commissionIds must be a non-empty array" });
    return;
  }

  const comms = await db.select().from(commissionsTable).where(inArray(commissionsTable.id, commissionIds));
  if (comms.length !== commissionIds.length) {
    res.status(400).json({ error: "One or more commission IDs were not found" });
    return;
  }
  const notApproved = comms.filter(c => c.status !== "approved");
  if (notApproved.length > 0) {
    res.status(409).json({ error: `Commissions must be in 'approved' status to be batched. Offending IDs: ${notApproved.map(c => c.id).join(", ")}` });
    return;
  }
  const alreadyBatched = comms.filter(c => c.batchId != null);
  if (alreadyBatched.length > 0) {
    res.status(409).json({ error: `Commissions already belong to another batch. Offending IDs: ${alreadyBatched.map(c => c.id).join(", ")}` });
    return;
  }

  const totalAmount = comms.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const reference = await generateReference(periodStart);

  const [batch] = await db
    .insert(payoutBatchesTable)
    .values({
      brandId: comms[0]?.brandId ?? null,
      reference,
      periodStart,
      periodEnd,
      status: "draft",
      totalAmount: totalAmount.toFixed(2),
      commissionCount: comms.length,
      createdBy: performedBy,
      auditNote: auditNote ?? null,
    })
    .returning();

  await db.update(commissionsTable).set({ batchId: batch.id }).where(inArray(commissionsTable.id, commissionIds));

  await addAuditLog(db, auditLogTable, {
    entityType: "payout_batch",
    entityId: batch.id,
    action: "created",
    previousValue: null,
    newValue: "draft",
    auditNote: `Batch ${reference}: ${comms.length} commissions, RM${totalAmount.toFixed(2)}${auditNote ? `. ${auditNote}` : ""}`,
    performedBy,
  });
  for (const c of comms) {
    await addAuditLog(db, auditLogTable, {
      entityType: "commission",
      entityId: c.id,
      action: "added_to_batch",
      previousValue: null,
      newValue: reference,
      auditNote: null,
      performedBy,
    });
  }

  res.status(201).json(enrichBatch(batch));
});

router.get("/payout-batches/:id", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [batch] = await db.select().from(payoutBatchesTable).where(eq(payoutBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }

  const comms = await db.select().from(commissionsTable).where(eq(commissionsTable.batchId, id)).orderBy(desc(commissionsTable.createdAt));
  const enrichedComms = await Promise.all(comms.map(enrichCommission));

  res.json({ ...enrichBatch(batch), commissions: enrichedComms });
});

router.patch("/payout-batches/:id/mark-paid", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { payoutReference, auditNote } = req.body as { payoutReference: string; auditNote?: string };
  if (!payoutReference) { res.status(400).json({ error: "payoutReference required" }); return; }

  const performedBy = (req as any).user?.userId?.toString() ?? "finance";

  const [batch] = await db.select().from(payoutBatchesTable).where(eq(payoutBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }
  if (batch.status !== "draft") { res.status(409).json({ error: `Batch is already ${batch.status}` }); return; }

  const now = new Date();
  const [updated] = await db
    .update(payoutBatchesTable)
    .set({ status: "paid", payoutReference, paidAt: now, auditNote: auditNote ?? batch.auditNote })
    .where(eq(payoutBatchesTable.id, id))
    .returning();

  const comms = await db.select().from(commissionsTable).where(eq(commissionsTable.batchId, id));
  await db
    .update(commissionsTable)
    .set({ status: "paid", payoutReference, paidAt: now })
    .where(eq(commissionsTable.batchId, id));

  await addAuditLog(db, auditLogTable, {
    entityType: "payout_batch",
    entityId: id,
    action: "paid",
    previousValue: "draft",
    newValue: "paid",
    auditNote: `Payout ref: ${payoutReference}${auditNote ? `. ${auditNote}` : ""}`,
    performedBy,
  });
  for (const c of comms) {
    await addAuditLog(db, auditLogTable, {
      entityType: "commission",
      entityId: c.id,
      action: "paid",
      previousValue: c.status,
      newValue: "paid",
      auditNote: `Paid via batch ${batch.reference} (ref: ${payoutReference})`,
      performedBy,
    });
  }

  res.json(enrichBatch(updated));
});

router.patch("/payout-batches/:id/cancel", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { auditNote } = req.body as { auditNote?: string };
  const performedBy = (req as any).user?.userId?.toString() ?? "finance";

  const [batch] = await db.select().from(payoutBatchesTable).where(eq(payoutBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }
  if (batch.status !== "draft") { res.status(409).json({ error: `Only draft batches can be cancelled (batch is ${batch.status})` }); return; }

  // Release the linked commissions back to unbatched (still "approved") so they
  // can be picked up into a future batch.
  await db.update(commissionsTable).set({ batchId: null }).where(eq(commissionsTable.batchId, id));

  const [updated] = await db
    .update(payoutBatchesTable)
    .set({ status: "cancelled", auditNote: auditNote ?? batch.auditNote })
    .where(eq(payoutBatchesTable.id, id))
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "payout_batch",
    entityId: id,
    action: "cancelled",
    previousValue: "draft",
    newValue: "cancelled",
    auditNote: auditNote ?? null,
    performedBy,
  });

  res.json(enrichBatch(updated));
});

function batchToCSV(batch: any, comms: any[]): string {
  const header = ["Batch Reference", "Partner Name", "Lead Name", "Amount (RM)", "Commission Type", "Approved At"];
  const rows = comms.map(c => [
    batch.reference,
    c.partnerName ?? "",
    c.leadName ?? "",
    parseFloat(c.amount),
    c.commissionType,
    c.approvedAt ? (c.approvedAt instanceof Date ? c.approvedAt.toISOString() : c.approvedAt) : "",
  ]);
  return [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

router.get("/payout-batches/:id/export", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [batch] = await db.select().from(payoutBatchesTable).where(eq(payoutBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }

  const comms = await db.select().from(commissionsTable).where(eq(commissionsTable.batchId, id));
  const enriched = await Promise.all(comms.map(async c => {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, c.leadId));
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, c.partnerId));
    return { ...c, leadName: lead?.name ?? "", partnerName: partner?.displayName ?? "" };
  }));

  const csvData = batchToCSV(batch, enriched);
  const filename = `payout_batch_${batch.reference}.csv`;

  res.json({ csvData, filename, rowCount: comms.length });
});

export default router;
