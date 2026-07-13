import { Router, type IRouter } from "express";
import { db, auditLogTable, commissionsTable, payoutBatchesTable } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { addAuditLog, getAuditContext, requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

router.get("/payout-batches", requireAuth, requireRole("super_admin", "finance"), async (_req, res): Promise<void> => {
  const batches = await db.select().from(payoutBatchesTable).orderBy(desc(payoutBatchesTable.createdAt)).limit(100);
  res.json({
    batches: batches.map((batch) => ({
      ...batch,
      totalAmount: Number.parseFloat(batch.totalAmount),
      paidAt: batch.paidAt?.toISOString() ?? null,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
    })),
  });
});

router.post("/payout-batches", requireAuth, requireRole("super_admin", "finance"), async (req, res): Promise<void> => {
  const { commissionIds, bankReference, proofUrl, auditNote } = req.body as {
    commissionIds?: number[];
    bankReference?: string;
    proofUrl?: string | null;
    auditNote?: string | null;
  };

  if (!Array.isArray(commissionIds) || commissionIds.length === 0 || !bankReference) {
    res.status(400).json({ error: "commissionIds and bankReference required" });
    return;
  }

  const uniqueIds = [...new Set(commissionIds.map((id) => Number(id)).filter(Number.isInteger))];
  const commissions = await db.select().from(commissionsTable).where(inArray(commissionsTable.id, uniqueIds));
  if (commissions.length !== uniqueIds.length) {
    res.status(404).json({ error: "One or more commissions were not found" });
    return;
  }

  const notApproved = commissions.find((commission) => commission.status !== "approved");
  if (notApproved) {
    res.status(409).json({ error: `Commission ${notApproved.id} is not approved` });
    return;
  }

  const partnerIds = new Set(commissions.map((commission) => commission.partnerId));
  if (partnerIds.size !== 1) {
    res.status(400).json({ error: "A payout batch must belong to one partner" });
    return;
  }

  const audit = getAuditContext(req);
  const totalAmount = commissions.reduce((sum, commission) => sum + Number.parseFloat(commission.amount), 0);
  const [batch] = await db
    .insert(payoutBatchesTable)
    .values({
      brandId: commissions[0]?.brandId ?? null,
      partnerId: commissions[0]?.partnerId ?? null,
      commissionIds: uniqueIds,
      totalAmount: totalAmount.toFixed(2),
      bankReference,
      proofUrl: proofUrl ?? null,
      status: "paid",
      auditNote: auditNote ?? null,
      createdBy: audit.performedBy,
      paidAt: new Date(),
    })
    .returning();

  for (const commission of commissions) {
    const [updated] = await db
      .update(commissionsTable)
      .set({
        status: "paid",
        payoutReference: bankReference,
        proofUrl: proofUrl ?? commission.proofUrl,
        paidAt: new Date(),
        auditNote: auditNote ?? null,
      })
      .where(eq(commissionsTable.id, commission.id))
      .returning();

    await addAuditLog(db, auditLogTable, {
      entityType: "commission",
      entityId: commission.id,
      action: "paid_in_batch",
      brandId: commission.brandId ?? null,
      previousValue: commission.status,
      newValue: "paid",
      previousAmount: commission.amount,
      newAmount: updated.amount,
      auditNote: `Batch #${batch.id}; bank ref: ${bankReference}${auditNote ? `. ${auditNote}` : ""}`,
      ...audit,
    });
  }

  await addAuditLog(db, auditLogTable, {
    entityType: "payout_batch",
    entityId: batch.id,
    action: "created",
    brandId: batch.brandId ?? null,
    newValue: "paid",
    newAmount: totalAmount,
    auditNote: auditNote ?? null,
    ...audit,
  });

  res.status(201).json({
    ...batch,
    totalAmount,
    paidAt: batch.paidAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  });
});

export default router;
