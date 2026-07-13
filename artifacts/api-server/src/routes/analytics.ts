import { Router, type IRouter } from "express";
import { db, leadsTable, commissionsTable, partnersTable } from "@workspace/db";
import { and, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { scopedWhere } from "../lib/accessScope";

const router: IRouter = Router();

const PIPELINE_STAGES = [
  "new_lead",
  "contacted",
  "appointment_booked",
  "arrived",
  "free_consultation_only",
  "first_paid_treatment",
  "package_purchased",
  "repeat_customer",
  "invalid",
  "cancelled",
];

const STAGE_LABELS: Record<string, { en: string; zh: string }> = {
  new_lead: { en: "New Lead", zh: "New" },
  contacted: { en: "Contacted", zh: "Contacted" },
  appointment_booked: { en: "Appointment Booked", zh: "Booked" },
  arrived: { en: "Arrived", zh: "Arrived" },
  free_consultation_only: { en: "Free Consultation Only", zh: "Free consultation" },
  first_paid_treatment: { en: "First Paid Treatment", zh: "First paid" },
  package_purchased: { en: "Package Purchased", zh: "Package" },
  repeat_customer: { en: "Repeat Customer", zh: "Repeat" },
  invalid: { en: "Invalid", zh: "Invalid" },
  cancelled: { en: "Cancelled", zh: "Cancelled" },
};

const ARRIVAL_STAGES = ["arrived", "free_consultation_only", "first_paid_treatment", "package_purchased", "repeat_customer"];
const CONVERSION_STAGES = ["first_paid_treatment", "package_purchased"];
const CLOSED_LOST_STAGES = ["invalid", "cancelled", "invalid_cancelled"];

router.get("/analytics/summary", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff", "finance"), async (req, res): Promise<void> => {
  const allLeads = await db.select().from(leadsTable).where(scopedWhere(req, leadsTable.brandId));

  const totalLeads = allLeads.length;
  const totalBookings = allLeads.filter((lead) => !["new_lead", "contacted", ...CLOSED_LOST_STAGES].includes(lead.stage)).length;
  const totalArrivals = allLeads.filter((lead) => ARRIVAL_STAGES.includes(lead.stage)).length;
  const totalFreeConsultOnly = allLeads.filter((lead) => lead.stage === "free_consultation_only").length;
  const totalFirstPaid = allLeads.filter((lead) => lead.stage === "first_paid_treatment").length;
  const totalPackage = allLeads.filter((lead) => lead.stage === "package_purchased").length;
  const totalInvalid = allLeads.filter((lead) => CLOSED_LOST_STAGES.includes(lead.stage)).length;
  const totalPaid = totalFirstPaid + totalPackage;

  const allComms = await db.select().from(commissionsTable).where(scopedWhere(req, commissionsTable.brandId));
  const totalReferralCost = allComms.filter((commission) => commission.commissionType === "flat_rm30").reduce((sum, commission) => sum + Number.parseFloat(commission.amount), 0);
  const totalPackageCommission = allComms.filter((commission) => commission.commissionType === "package_percent").reduce((sum, commission) => sum + Number.parseFloat(commission.amount), 0);
  const totalNetSales = allLeads.reduce((sum, lead) => sum + (lead.netSaleAmount ? Number.parseFloat(lead.netSaleAmount) : 0), 0);

  const partners = await db
    .select()
    .from(partnersTable)
    .where(scopedWhere(req, partnersTable.brandId))
    .orderBy(desc(partnersTable.totalConversions))
    .limit(5);
  const topPartners = partners.map((partner) => ({
    partnerId: partner.id,
    partnerName: partner.displayName,
    referralCode: partner.referralCode,
    totalLeads: partner.totalLeads,
    totalConversions: partner.totalConversions,
    totalCommission: Number.parseFloat(partner.totalCommissionEarned),
  }));

  res.json({
    totalLeads,
    totalBookings,
    totalArrivals,
    totalFreeConsultOnly,
    totalFirstPaidTreatment: totalFirstPaid,
    totalPackagePurchased: totalPackage,
    totalInvalid,
    conversionRate: totalLeads > 0 ? (totalPaid / totalLeads) * 100 : 0,
    totalReferralCost,
    totalPackageCommission,
    avgReferralCost: totalPaid > 0 ? (totalReferralCost + totalPackageCommission) / totalPaid : 0,
    totalNetSales,
    topPartners,
  });
});

router.get("/analytics/monthly-trend", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff", "finance"), async (req, res): Promise<void> => {
  const { months = "6" } = req.query as Record<string, string>;
  const monthCount = Math.min(12, Number.parseInt(months, 10));

  const trend = [];
  const now = new Date();

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const monthStart = `${monthStr}-01`;
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];

    const leads = await db.select().from(leadsTable).where(
      scopedWhere(req, leadsTable.brandId, [
        sql`${leadsTable.createdAt} >= ${monthStart}::date`,
        sql`${leadsTable.createdAt} < ${monthEnd}::date`,
      ]),
    );

    const comms = await db.select().from(commissionsTable).where(
      scopedWhere(req, commissionsTable.brandId, [
        sql`${commissionsTable.createdAt} >= ${monthStart}::date`,
        sql`${commissionsTable.createdAt} < ${monthEnd}::date`,
      ]),
    );

    trend.push({
      month: monthStr,
      leads: leads.length,
      arrivals: leads.filter((lead) => ARRIVAL_STAGES.includes(lead.stage)).length,
      conversions: leads.filter((lead) => CONVERSION_STAGES.includes(lead.stage)).length,
      commissionCost: comms.reduce((sum, commission) => sum + Number.parseFloat(commission.amount), 0),
    });
  }

  res.json(trend);
});

router.get("/analytics/pipeline", requireAuth, requireRole("super_admin", "brand_admin", "outlet_staff", "finance"), async (req, res): Promise<void> => {
  const allLeads = await db.select().from(leadsTable).where(scopedWhere(req, leadsTable.brandId));
  const breakdown = PIPELINE_STAGES.map((stage) => {
    const count = allLeads.filter((lead) => lead.stage === stage || (stage === "invalid" && lead.stage === "invalid_cancelled")).length;
    return {
      stage,
      count,
      label: STAGE_LABELS[stage]?.en ?? stage,
      labelZh: STAGE_LABELS[stage]?.zh ?? stage,
    };
  });

  res.json(breakdown);
});

export default router;
