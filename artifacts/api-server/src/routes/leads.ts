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
import { requireAuth, requireRole, addAuditLog } from "../lib/auth";

const router: IRouter = Router();

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    new_lead: "New Lead | 新客",
    appointment_booked: "Appointment Booked | 已预约",
    arrived: "Arrived | 已到访",
    free_consultation_only: "Free Consultation Only | 仅免费咨询",
    first_paid_treatment: "First Paid Treatment | 首次付费治疗",
    package_purchased: "Package Purchased | 购买套餐",
    invalid_cancelled: "Invalid/Cancelled | 无效取消",
  };
  return labels[stage] ?? stage;
}

async function enrichLead(lead: any) {
  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, lead.partnerId));
  return {
    ...lead,
    partnerName: partner?.displayName ?? "Unknown",
    netSaleAmount: lead.netSaleAmount != null ? parseFloat(lead.netSaleAmount) : null,
  };
}

router.get("/leads", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const { stage, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, parseInt(limit, 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (stage) conditions.push(eq(leadsTable.stage, stage as any));
  if (search) {
    conditions.push(
      or(
        like(leadsTable.name, `%${search}%`),
        like(leadsTable.mobile, `%${search}%`),
        like(leadsTable.referralCode, `%${search}%`)
      )
    );
  }

  const query = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(leadsTable)
    .where(query);

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
  const { name, nameZh, mobile, whatsapp, kirimembershipId, referralCode, consentGiven, selectedOffer, appointmentIntent, preferredDate, notes, lang } = req.body;

  if (!name || !mobile || !referralCode || consentGiven !== true) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // check duplicate
  const dups = await db
    .select()
    .from(leadsTable)
    .where(
      or(
        eq(leadsTable.mobile, mobile),
        ...(kirimembershipId ? [eq(leadsTable.kirimembershipId, kirimembershipId)] : [])
      )
    )
    .limit(1);

  if (dups.length > 0) {
    res.status(409).json({ error: "Duplicate mobile or membership ID" });
    return;
  }

  const [partner] = await db
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.referralCode, referralCode));

  if (!partner) {
    res.status(400).json({ error: "Invalid referral code" });
    return;
  }

  // find active campaign
  const today = new Date().toISOString().split("T")[0];
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.isActive, true),
        sql`${campaignsTable.startDate} <= ${today}`,
        sql`${campaignsTable.endDate} >= ${today}`
      )
    )
    .limit(1);

  const [lead] = await db
    .insert(leadsTable)
    .values({
      name,
      nameZh: nameZh ?? null,
      mobile,
      whatsapp: whatsapp ?? null,
      kirimembershipId: kirimembershipId ?? null,
      referralCode,
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
    newValue: "new_lead",
    performedBy: "customer",
  });

  res.status(201).json(await enrichLead(lead));
});

router.get("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  res.json(await enrichLead(lead));
});

router.patch("/leads/:id", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, mobile, whatsapp, notes, appointmentDate, auditNote } = req.body;
  const updateData: any = {};
  if (name != null) updateData.name = name;
  if (mobile != null) updateData.mobile = mobile;
  if (whatsapp != null) updateData.whatsapp = whatsapp;
  if (notes != null) updateData.notes = notes;
  if (appointmentDate != null) updateData.appointmentDate = appointmentDate;

  const [updated] = await db.update(leadsTable).set(updateData).where(eq(leadsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Lead not found" }); return; }

  const performedBy = (req as any).user?.userId?.toString() ?? "staff";
  await addAuditLog(db, auditLogTable, {
    entityType: "lead",
    entityId: id,
    action: "updated",
    auditNote: auditNote ?? null,
    performedBy,
  });

  res.json(await enrichLead(updated));
});

router.patch("/leads/:id/stage", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { stage, auditNote } = req.body;
  if (!stage) { res.status(400).json({ error: "Stage required" }); return; }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }

  const [updated] = await db
    .update(leadsTable)
    .set({ stage })
    .where(eq(leadsTable.id, id))
    .returning();

  const performedBy = (req as any).user?.userId?.toString() ?? "staff";
  await addAuditLog(db, auditLogTable, {
    entityType: "lead",
    entityId: id,
    action: "stage_updated",
    previousValue: existing.stage,
    newValue: stage,
    auditNote: auditNote ?? null,
    performedBy,
  });

  res.json(await enrichLead(updated));
});

router.post("/leads/:id/verify-payment", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { netSaleAmount, paymentType, proofUrl, auditNote, commissionType, commissionRate } = req.body;
  if (netSaleAmount == null || !paymentType) {
    res.status(400).json({ error: "netSaleAmount and paymentType required" });
    return;
  }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  // If already has commission, don't create another (one-time rule)
  if (lead.commissionId) {
    res.status(409).json({ error: "Commission already exists for this lead" });
    return;
  }

  // Calculate commission amount
  const netAmount = parseFloat(netSaleAmount);
  let commAmount = 30; // default flat RM30
  const finalCommType = commissionType ?? "flat_rm30";
  let finalRate: number | null = null;

  if (finalCommType === "package_percent" && commissionRate) {
    finalRate = parseFloat(commissionRate);
    commAmount = (netAmount * finalRate) / 100;
  }

  // Create commission
  const [commission] = await db
    .insert(commissionsTable)
    .values({
      leadId: id,
      partnerId: lead.partnerId,
      campaignId: lead.campaignId ?? null,
      amount: commAmount.toFixed(2),
      commissionType: finalCommType,
      commissionRate: finalRate != null ? finalRate.toFixed(2) : null,
      netSaleAmount: netAmount.toFixed(2),
      status: "pending",
      proofUrl: proofUrl ?? null,
      auditNote: auditNote ?? null,
    })
    .returning();

  // Update lead stage and commission reference
  const newStage = paymentType === "package_purchased" ? "package_purchased" : "first_paid_treatment";
  const [updated] = await db
    .update(leadsTable)
    .set({
      stage: newStage as any,
      netSaleAmount: netAmount.toFixed(2),
      proofUrl: proofUrl ?? lead.proofUrl,
      commissionId: commission.id,
    })
    .where(eq(leadsTable.id, id))
    .returning();

  // Update partner stats
  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, lead.partnerId));
  if (partner) {
    await db.update(partnersTable).set({
      totalConversions: partner.totalConversions + 1,
      totalCommissionEarned: (parseFloat(partner.totalCommissionEarned) + commAmount).toFixed(2),
    }).where(eq(partnersTable.id, partner.id));
  }

  const performedBy = (req as any).user?.userId?.toString() ?? "staff";
  await addAuditLog(db, auditLogTable, {
    entityType: "lead",
    entityId: id,
    action: "payment_verified",
    previousValue: lead.stage,
    newValue: newStage,
    auditNote: auditNote ?? null,
    performedBy,
  });
  await addAuditLog(db, auditLogTable, {
    entityType: "commission",
    entityId: commission.id,
    action: "created",
    newValue: `${finalCommType}: RM${commAmount.toFixed(2)}`,
    performedBy,
  });

  res.json(await enrichLead(updated));
});

router.get("/leads/:id/whatsapp-message", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, lead.partnerId));

  const messageEn = `Hello ${lead.name}! 👋

Thank you for your interest in Zhengji Wellness through ${partner?.displayName ?? "our partner"}'s referral.

Your referral code: *${lead.referralCode}*
Offer: ${lead.selectedOffer}

We look forward to seeing you soon! Please bring this message when you visit.

Zhengji Wellness | 正记健康`;

  const messageZh = `您好 ${lead.name}！

感谢您通过 ${partner?.displayName ?? "我们合作伙伴"} 的推荐关注正记健康。

您的推荐码：*${lead.referralCode}*
优惠内容：免费健康咨询 + 会员专属九折优惠

期待您的光临！就诊时请出示此消息。

正记健康 | Zhengji Wellness`;

  res.json({ messageEn, messageZh });
});

export default router;
