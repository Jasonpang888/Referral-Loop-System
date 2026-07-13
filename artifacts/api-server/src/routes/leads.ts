import { Router, type IRouter } from "express";
import {
  db,
  leadsTable,
  partnersTable,
  commissionsTable,
  auditLogTable,
  campaignsTable,
} from "@workspace/db";
import { eq, and, like, or, desc, count, sql } from "drizzle-orm";
import { requireAuth, requireRole, addAuditLog, getAuditContext } from "../lib/auth";
import { canAccessBrand, rejectForbiddenBrand, scopedWhere } from "../lib/accessScope";
import {
  LEAD_STAGES,
  assertCommissionCanBeCreated,
  calculateCommission,
  isNoCommissionStage,
  normalizeMembershipId,
  normalizeMobile,
} from "../lib/referralRules";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number.parseInt(value ?? "", 10);
  return Number.isNaN(id) ? null : id;
}

function isValidStage(stage: string): boolean {
  return LEAD_STAGES.includes(stage as any);
}

async function enrichLead(lead: any) {
  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, lead.partnerId));
  return {
    ...lead,
    partnerName: partner?.displayName ?? "Unknown",
    netSaleAmount: lead.netSaleAmount != null ? Number.parseFloat(lead.netSaleAmount) : null,
  };
}

async function findActiveCampaign(brandId?: number | null) {
  const today = new Date().toISOString().split("T")[0];
  const dateConditions = [
    eq(campaignsTable.isActive, true),
    sql`${campaignsTable.startDate} <= ${today}`,
    sql`${campaignsTable.endDate} >= ${today}`,
  ];

  if (brandId != null) {
    const [brandCampaign] = await db
      .select()
      .from(campaignsTable)
      .where(and(...dateConditions, eq(campaignsTable.brandId, brandId)))
      .orderBy(desc(campaignsTable.createdAt))
      .limit(1);
    if (brandCampaign) return brandCampaign;
  }

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(...dateConditions, sql`${campaignsTable.brandId} IS NULL`))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(1);
  return campaign ?? null;
}

router.get("/leads", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff"), async (req, res): Promise<void> => {
  const { stage, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, Number.parseInt(page, 10));
  const limitNum = Math.min(100, Number.parseInt(limit, 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (stage) conditions.push(eq(leadsTable.stage, stage as any));
  if (search) {
    conditions.push(
      or(
        like(leadsTable.name, `%${search}%`),
        like(leadsTable.mobile, `%${search}%`),
        like(leadsTable.referralCode, `%${search}%`),
      ),
    );
  }

  const query = scopedWhere(req, leadsTable.brandId, conditions);

  const [{ total }] = await db.select({ total: count() }).from(leadsTable).where(query);
  const leads = await db
    .select()
    .from(leadsTable)
    .where(query)
    .orderBy(desc(leadsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const enriched = await Promise.all(leads.map(enrichLead));
  res.json({ leads: enriched, total: Number(total), page: pageNum, limit: limitNum });
});

router.post("/leads", async (req, res): Promise<void> => {
  const {
    name,
    nameZh,
    mobile,
    whatsapp,
    kirimembershipId,
    referralCode,
    consentGiven,
    selectedOffer,
    appointmentIntent,
    preferredDate,
    notes,
    lang,
  } = req.body;

  if (!name || !mobile || !referralCode || consentGiven !== true) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const normalizedMobile = normalizeMobile(mobile);
  const normalizedMembershipId = normalizeMembershipId(kirimembershipId);
  const duplicateConditions = [
    eq(leadsTable.mobile, normalizedMobile),
    ...(normalizedMembershipId ? [eq(leadsTable.kirimembershipId, normalizedMembershipId)] : []),
  ];

  const dups = await db.select().from(leadsTable).where(or(...duplicateConditions)).limit(1);
  if (dups.length > 0) {
    res.status(409).json({ error: "Duplicate mobile or membership ID" });
    return;
  }

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.referralCode, referralCode));
  if (!partner || !partner.isActive) {
    res.status(400).json({ error: "Invalid referral code" });
    return;
  }

  const campaign = await findActiveCampaign(partner.brandId);

  try {
    const [lead] = await db
      .insert(leadsTable)
      .values({
        name,
        nameZh: nameZh ?? null,
        mobile: normalizedMobile,
        whatsapp: whatsapp ?? null,
        kirimembershipId: normalizedMembershipId,
        referralCode,
        brandId: partner.brandId ?? null,
        partnerId: partner.id,
        campaignId: campaign?.id ?? null,
        stage: "new_lead",
        selectedOffer: selectedOffer ?? "Free Consultation + 10% Discount",
        appointmentIntent: appointmentIntent ?? null,
        appointmentDate: preferredDate ?? null,
        consentGiven: true,
        notes: notes ?? null,
        lang: lang ?? "en",
      })
      .returning();

    await db.update(partnersTable)
      .set({ totalLeads: partner.totalLeads + 1 })
      .where(eq(partnersTable.id, partner.id));

    await addAuditLog(db, auditLogTable, {
      entityType: "lead",
      entityId: lead.id,
      action: "created",
      brandId: lead.brandId ?? null,
      newValue: "new_lead",
      performedBy: "customer",
    });

    res.status(201).json(await enrichLead(lead));
  } catch {
    res.status(409).json({ error: "Duplicate mobile or membership ID" });
  }
});

router.get("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  if (!canAccessBrand(req, lead.brandId)) { rejectForbiddenBrand(res); return; }

  res.json(await enrichLead(lead));
});

router.patch("/leads/:id", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, mobile, whatsapp, notes, appointmentDate, auditNote } = req.body;
  const updateData: any = {};
  if (name != null) updateData.name = name;
  if (mobile != null) updateData.mobile = normalizeMobile(mobile);
  if (whatsapp != null) updateData.whatsapp = whatsapp;
  if (notes != null) updateData.notes = notes;
  if (appointmentDate != null) updateData.appointmentDate = appointmentDate;

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }
  if (!canAccessBrand(req, existing.brandId)) { rejectForbiddenBrand(res); return; }

  const [updated] = await db.update(leadsTable).set(updateData).where(eq(leadsTable.id, id)).returning();
  const audit = getAuditContext(req);
  await addAuditLog(db, auditLogTable, {
    entityType: "lead",
    entityId: id,
    action: "updated",
    brandId: updated.brandId ?? null,
    previousValue: JSON.stringify({ mobile: existing.mobile, appointmentDate: existing.appointmentDate }),
    newValue: JSON.stringify({ mobile: updated.mobile, appointmentDate: updated.appointmentDate }),
    auditNote: auditNote ?? null,
    ...audit,
  });

  res.json(await enrichLead(updated));
});

router.patch("/leads/:id/stage", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { stage, auditNote } = req.body;
  if (!stage) { res.status(400).json({ error: "Stage required" }); return; }
  if (!isValidStage(stage)) { res.status(400).json({ error: "Invalid stage" }); return; }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }
  if (!canAccessBrand(req, existing.brandId)) { rejectForbiddenBrand(res); return; }

  const [updated] = await db.update(leadsTable).set({ stage }).where(eq(leadsTable.id, id)).returning();

  const audit = getAuditContext(req);
  await addAuditLog(db, auditLogTable, {
    entityType: "lead",
    entityId: id,
    action: "stage_updated",
    brandId: existing.brandId ?? null,
    previousValue: existing.stage,
    newValue: stage,
    previousAmount: existing.netSaleAmount,
    newAmount: updated.netSaleAmount,
    auditNote: auditNote ?? null,
    ...audit,
  });

  res.json(await enrichLead(updated));
});

router.post("/leads/:id/verify-payment", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { netSaleAmount, paymentType, proofUrl, auditNote, commissionType, commissionRate } = req.body;
  if (!paymentType) { res.status(400).json({ error: "paymentType required" }); return; }
  if (!isValidStage(paymentType)) { res.status(400).json({ error: "Invalid payment type" }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  if (!canAccessBrand(req, lead.brandId)) { rejectForbiddenBrand(res); return; }

  const audit = getAuditContext(req);

  if (isNoCommissionStage(paymentType)) {
    const [updated] = await db
      .update(leadsTable)
      .set({ stage: paymentType as any, proofUrl: proofUrl ?? lead.proofUrl })
      .where(eq(leadsTable.id, id))
      .returning();

    await addAuditLog(db, auditLogTable, {
      entityType: "lead",
      entityId: id,
      action: "commission_not_eligible",
      brandId: lead.brandId ?? null,
      previousValue: lead.stage,
      newValue: paymentType,
      previousAmount: lead.netSaleAmount,
      newAmount: 0,
      auditNote: auditNote ?? "RM0 referral reward for non-eligible visit",
      ...audit,
    });

    res.json(await enrichLead(updated));
    return;
  }

  const existingCommissions = await db.select().from(commissionsTable).where(eq(commissionsTable.leadId, id));
  try {
    assertCommissionCanBeCreated({
      leadCommissionId: lead.commissionId,
      existingCommissionCount: existingCommissions.length,
      currentStage: lead.stage,
    });
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Commission already exists for this lead" });
    return;
  }

  const [campaign] = lead.campaignId
    ? await db.select().from(campaignsTable).where(eq(campaignsTable.id, lead.campaignId)).limit(1)
    : [];

  let calculation;
  try {
    calculation = calculateCommission({
      paymentType,
      netSaleAmount,
      commissionType,
      commissionRate,
      campaign,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid commission request" });
    return;
  }

  if (!calculation) {
    res.status(400).json({ error: "Payment type is not commission eligible" });
    return;
  }

  try {
    const [commission] = await db
      .insert(commissionsTable)
      .values({
        brandId: lead.brandId ?? null,
        leadId: id,
        partnerId: lead.partnerId,
        campaignId: lead.campaignId ?? null,
        amount: calculation.amount.toFixed(2),
        commissionType: calculation.commissionType,
        commissionRate: calculation.commissionRate != null ? calculation.commissionRate.toFixed(2) : null,
        netSaleAmount: calculation.netSaleAmount.toFixed(2),
        status: "pending",
        proofUrl: proofUrl ?? null,
        auditNote: auditNote ?? null,
      })
      .returning();

    const [updated] = await db
      .update(leadsTable)
      .set({
        stage: calculation.leadStage as any,
        netSaleAmount: calculation.netSaleAmount.toFixed(2),
        proofUrl: proofUrl ?? lead.proofUrl,
        commissionId: commission.id,
      })
      .where(eq(leadsTable.id, id))
      .returning();

    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, lead.partnerId));
    if (partner) {
      await db.update(partnersTable).set({
        totalConversions: partner.totalConversions + 1,
        totalCommissionEarned: (Number.parseFloat(partner.totalCommissionEarned) + calculation.amount).toFixed(2),
      }).where(eq(partnersTable.id, partner.id));
    }

    await addAuditLog(db, auditLogTable, {
      entityType: "lead",
      entityId: id,
      action: "payment_verified",
      brandId: lead.brandId ?? null,
      previousValue: lead.stage,
      newValue: calculation.leadStage,
      previousAmount: lead.netSaleAmount,
      newAmount: calculation.netSaleAmount,
      auditNote: auditNote ?? null,
      ...audit,
    });
    await addAuditLog(db, auditLogTable, {
      entityType: "commission",
      entityId: commission.id,
      action: "created",
      brandId: lead.brandId ?? null,
      newValue: `${calculation.commissionType}: RM${calculation.amount.toFixed(2)}`,
      newAmount: calculation.amount,
      auditNote: auditNote ?? null,
      ...audit,
    });

    res.json(await enrichLead(updated));
  } catch {
    res.status(409).json({ error: "Commission already exists for this lead" });
  }
});

router.get("/leads/:id/whatsapp-message", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  if (!canAccessBrand(req, lead.brandId)) { rejectForbiddenBrand(res); return; }

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, lead.partnerId));

  const messageEn = `Hello ${lead.name}!

Thank you for your interest in Zhengji Wellness through ${partner?.displayName ?? "our partner"}'s referral.

Your referral code: *${lead.referralCode}*
Offer: ${lead.selectedOffer}

We look forward to seeing you soon. Please bring this message when you visit.

Zhengji Wellness`;

  const messageZh = `Hello ${lead.name},

Thank you for your interest in Zhengji Wellness through ${partner?.displayName ?? "our partner"}.

Referral code: *${lead.referralCode}*
Offer: Free consultation + 10% off eligible first treatment

Please show this message when you visit.`;

  res.json({ messageEn, messageZh });
});

export default router;
