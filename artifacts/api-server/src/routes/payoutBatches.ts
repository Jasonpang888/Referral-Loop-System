import { Router, type IRouter } from "express";
import { db, payoutBatchesTable, commissionsTable, leadsTable, partnersTable, auditLogTable } from "@workspace/db";
import { eq, and, desc, count, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole, addAuditLog } from "../lib/auth";

const router: IRouter = Router();

async function enrichBatch(batch: any) {
  const [partner] = batch.partnerId ? await db.select().from(partnersTable).where(eq(partnersTable.id, batch.partnerId)) : [null];
  return {
    ...batch,
    partnerName: partner?.displayName ?? "Unknown",
    commissionIds: batch.commissionIds as number[],
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

router.get("/payout-batches", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const { status, partnerId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, parseInt(limit, 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (status) conditions.push(eq(payoutBatchesTable.status, status as any));
  if (partnerId) conditions.push(eq(payoutBatchesTable.partnerId, parseInt(partnerId, 10)));
  const query = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(payoutBatchesTable).where(query);
  const batches = await db
    .select()
    .from(payoutBatchesTable)
    .where(query)
    .orderBy(desc(payoutBatchesTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  res.json({ batches: await Promise.all(batches.map(enrichBatch)), total: Number(total), page: pageNum, limit: limitNum });
});

router.post("/payout-batches", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const { partnerId, commissionIds, bankReference, proofUrl, auditNote, status } = req.body as {
    partnerId: number; commissionIds: number[]; bankReference: string; proofUrl?: string; auditNote?: string; status?: string;
  };
  const performedBy = (req as any).user?.userId?.toString() ?? "finance";
  const batchStatus = status === "draft" ? "draft" : "paid"; // paid is the default: the common case is logging a transfer already made

  if (!partnerId) { res.status(400).json({ error: "partnerId required" }); return; }
  if (!bankReference) { res.status(400).json({ error: "bankReference required" }); return; }
  if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
    res.status(400).json({ error: "commissionIds must be a non-empty array" });
    return;
  }

  const comms = await db.select().from(commissionsTable).where(inArray(commissionsTable.id, commissionIds));
  if (comms.length !== commissionIds.length) {
    res.status(400).json({ error: "One or more commission IDs were not found" });
    return;
  }
  const wrongPartner = comms.filter(c => c.partnerId !== partnerId);
  if (wrongPartner.length > 0) {
    res.status(409).json({ error: `Commissions must all belong to the selected partner. Offending IDs: ${wrongPartner.map(c => c.id).join(", ")}` });
    return;
  }
  const notApproved = comms.filter(c => c.status !== "approved");
  if (notApproved.length > 0) {
    res.status(409).json({ error: `Commissions must be in 'approved' status to be batched. Offending IDs: ${notApproved.map(c => c.id).join(", ")}` });
    return;
  }
  const commissionIdParams = sql.join(commissionIds.map((cid) => sql`${cid}`), sql`, `);
  const alreadyBatchedResult: any = await db.execute(sql`
    SELECT count(*)::int AS "alreadyBatchedCount" FROM (
      SELECT (jsonb_array_elements_text(commission_ids::jsonb))::int AS cid
      FROM payout_batches WHERE status != 'void'
    ) t WHERE cid = ANY(ARRAY[${commissionIdParams}]::int[])
  `);
  const alreadyBatchedRows = alreadyBatchedResult.rows ?? alreadyBatchedResult;
  const alreadyBatchedCount = Number(alreadyBatchedRows?.[0]?.alreadyBatchedCount ?? 0);
  if (alreadyBatchedCount > 0) {
    res.status(409).json({ error: "One or more commissions are already included in another batch" });
    return;
  }

  const totalAmount = comms.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const now = new Date();

  const [batch] = await db
    .insert(payoutBatchesTable)
    .values({
      brandId: comms[0]?.brandId ?? null,
      partnerId,
      commissionIds,
      totalAmount: totalAmount.toFixed(2),
      bankReference,
      proofUrl: proofUrl ?? null,
      status: batchStatus,
      auditNote: auditNote ?? null,
      createdBy: performedBy,
      paidAt: batchStatus === "paid" ? now : null,
    })
    .returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "payout_batch",
    entityId: batch.id,
    action: "created",
    previousValue: null,
    newValue: batchStatus,
    auditNote: `${comms.length} commissions, RM${totalAmount.toFixed(2)}, bank ref ${bankReference}${auditNote ? `. ${auditNote}` : ""}`,
    performedBy,
  });

  if (batchStatus === "paid") {
    await db
      .update(commissionsTable)
      .set({ status: "paid", payoutReference: bankReference, paidAt: now })
      .where(inArray(commissionsTable.id, commissionIds));
    for (const c of comms) {
      await addAuditLog(db, auditLogTable, {
        entityType: "commission",
        entityId: c.id,
        action: "paid",
        previousValue: c.status,
        newValue: "paid",
        auditNote: `Paid via payout batch #${batch.id} (bank ref: ${bankReference})`,
        performedBy,
      });
    }
  }

  res.status(201).json(await enrichBatch(batch));
});

router.get("/payout-batches/:id", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [batch] = await db.select().from(payoutBatchesTable).where(eq(payoutBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }

  const commissionIds = (batch.commissionIds as number[]) ?? [];
  const comms = commissionIds.length > 0
    ? await db.select().from(commissionsTable).where(inArray(commissionsTable.id, commissionIds))
    : [];
  const enrichedComms = await Promise.all(comms.map(enrichCommission));

  res.json({ ...(await enrichBatch(batch)), commissions: enrichedComms });
});

router.patch("/payout-batches/:id", requireAuth, requireRole("admin", "finance"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { status, bankReference, proofUrl, auditNote } = req.body as {
    status?: string; bankReference?: string; proofUrl?: string; auditNote?: string;
  };
  const performedBy = (req as any).user?.userId?.toString() ?? "finance";

  const [batch] = await db.select().from(payoutBatchesTable).where(eq(payoutBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }

  const updates: Record<string, any> = {};
  if (bankReference !== undefined) updates.bankReference = bankReference;
  if (proofUrl !== undefined) updates.proofUrl = proofUrl;
  if (auditNote !== undefined) updates.auditNote = auditNote;

  let cascadeToPaid = false;
  if (status && status !== batch.status) {
    const allowed: Record<string, string[]> = {
      draft: ["paid", "void"],
      paid: ["disputed"],
      disputed: ["paid"],
      void: [],
    };
    if (!allowed[batch.status]?.includes(status)) {
      res.status(409).json({ error: `Cannot move batch from '${batch.status}' to '${status}'` });
      return;
    }
    updates.status = status;
    if (status === "paid" && batch.status !== "paid") {
      updates.paidAt = new Date();
      cascadeToPaid = true;
    }
  }

  const [updated] = await db.update(payoutBatchesTable).set(updates).where(eq(payoutBatchesTable.id, id)).returning();

  await addAuditLog(db, auditLogTable, {
    entityType: "payout_batch",
    entityId: id,
    action: "updated",
    previousValue: batch.status,
    newValue: updated.status,
    auditNote: auditNote ?? null,
    performedBy,
  });

  if (cascadeToPaid) {
    const commissionIds = (batch.commissionIds as number[]) ?? [];
    if (commissionIds.length > 0) {
      await db
        .update(commissionsTable)
        .set({ status: "paid", payoutReference: updated.bankReference, paidAt: updated.paidAt as Date })
        .where(inArray(commissionsTable.id, commissionIds));
      for (const cid of commissionIds) {
        await addAuditLog(db, auditLogTable, {
          entityType: "commission",
          entityId: cid,
          action: "paid",
          previousValue: "approved",
          newValue: "paid",
          auditNote: `Paid via payout batch #${id} (bank ref: ${updated.bankReference})`,
          performedBy,
        });
      }
    }
  }

  res.json(await enrichBatch(updated));
});

function batchToCSV(batch: any, comms: any[]): string {
  const header = ["Batch ID", "Partner", "Bank Reference", "Lead Name", "Amount (RM)", "Commission Type", "Approved At"];
  const rows = comms.map(c => [
    batch.id,
    batch.partnerName,
    batch.bankReference,
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

  const enrichedBatch = await enrichBatch(batch);
  const commissionIds = (batch.commissionIds as number[]) ?? [];
  const comms = commissionIds.length > 0
    ? await db.select().from(commissionsTable).where(inArray(commissionsTable.id, commissionIds))
    : [];
  const enrichedComms = await Promise.all(comms.map(async c => {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, c.leadId));
    return { ...c, leadName: lead?.name ?? "" };
  }));

  const csvData = batchToCSV(enrichedBatch, enrichedComms);
  const filename = `payout_batch_${batch.id}.csv`;

  res.json({ csvData, filename, rowCount: comms.length });
});

export default router;
