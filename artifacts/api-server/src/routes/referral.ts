import { Router, type IRouter } from "express";
import { db, partnersTable, campaignsTable, leadsTable } from "@workspace/db";
import { eq, and, desc, lte, gte, or, sql } from "drizzle-orm";
import { normalizeMembershipId, normalizeMobile } from "../lib/referralRules";

const router: IRouter = Router();

router.get("/referral/:code", async (req, res): Promise<void> => {
  const rawCode = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;

  const [partner] = await db
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.referralCode, rawCode));

  if (!partner || !partner.isActive) {
    res.status(404).json({ error: "Referral code not found" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const campaignConditions = [
    eq(campaignsTable.isActive, true),
    lte(campaignsTable.startDate, today),
    gte(campaignsTable.endDate, today),
  ];
  const [brandCampaign] = partner.brandId == null ? [] : await db
    .select()
    .from(campaignsTable)
    .where(and(...campaignConditions, eq(campaignsTable.brandId, partner.brandId)))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(1);
  const [fallbackCampaign] = brandCampaign ? [] : await db
    .select()
    .from(campaignsTable)
    .where(and(...campaignConditions, sql`${campaignsTable.brandId} IS NULL`))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(1);
  const campaign = brandCampaign ?? fallbackCampaign;

  res.json({
    partnerName: partner.displayName,
    kirimembershipId: partner.kirimembershipId,
    referralCode: partner.referralCode,
    offer: "Free Wellness Consultation + 10% Member Discount",
    offerZh: "免费健康咨询 + 会员专属九折优惠",
    discountPercent: 10,
    campaignActive: !!campaign,
    campaignEndDate: campaign?.endDate ?? null,
  });
});

router.get("/leads/check-duplicate", async (req, res): Promise<void> => {
  const { mobile, membershipId } = req.query as { mobile?: string; membershipId?: string };

  if (!mobile && !membershipId) {
    res.json({ isDuplicate: false, field: null, existingLeadId: null });
    return;
  }

  const conditions = [];
  const normalizedMobile = mobile ? normalizeMobile(mobile) : null;
  const normalizedMembershipId = membershipId ? normalizeMembershipId(membershipId) : null;
  if (normalizedMobile) conditions.push(eq(leadsTable.mobile, normalizedMobile));
  if (normalizedMembershipId) conditions.push(eq(leadsTable.kirimembershipId, normalizedMembershipId));

  const [existing] = await db
    .select()
    .from(leadsTable)
    .where(or(...conditions))
    .limit(1);

  if (!existing) {
    res.json({ isDuplicate: false, field: null, existingLeadId: null });
    return;
  }

  const field = normalizedMobile && existing.mobile === normalizedMobile ? "mobile" : "membershipId";
  res.json({ isDuplicate: true, field, existingLeadId: existing.id });
});

export default router;
