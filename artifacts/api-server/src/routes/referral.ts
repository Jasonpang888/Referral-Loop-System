import { Router, type IRouter } from "express";
import { db, partnersTable, campaignsTable, leadsTable } from "@workspace/db";
import { eq, and, lte, gte, or } from "drizzle-orm";

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
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.isActive, true),
        lte(campaignsTable.startDate, today),
        gte(campaignsTable.endDate, today)
      )
    )
    .limit(1);

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
  if (mobile) conditions.push(eq(leadsTable.mobile, mobile));
  if (membershipId) conditions.push(eq(leadsTable.kirimembershipId, membershipId));

  const [existing] = await db
    .select()
    .from(leadsTable)
    .where(or(...conditions))
    .limit(1);

  if (!existing) {
    res.json({ isDuplicate: false, field: null, existingLeadId: null });
    return;
  }

  const field = mobile && existing.mobile === mobile ? "mobile" : "membershipId";
  res.json({ isDuplicate: true, field, existingLeadId: existing.id });
});

export default router;
