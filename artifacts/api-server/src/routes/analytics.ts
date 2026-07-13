import { Router, type IRouter } from "express";
import { db, leadsTable, commissionsTable, partnersTable } from "@workspace/db";
import { and, desc, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

const STAGE_LABELS: Record<string, { en: string; zh: string }> = {
  new_lead: { en: "New Lead", zh: "新客" },
  appointment_booked: { en: "Appointment Booked", zh: "已预约" },
  arrived: { en: "Arrived", zh: "已到访" },
  free_consultation_only: { en: "Free Consultation Only", zh: "仅免费咨询" },
  first_paid_treatment: { en: "First Paid Treatment", zh: "首次付费治疗" },
  package_purchased: { en: "Package Purchased", zh: "购买套餐" },
  invalid_cancelled: { en: "Invalid/Cancelled", zh: "无效取消" },
};

router.get("/analytics/summary", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const { from, to } = req.query as Record<string, string>;

  const allLeads = await db.select().from(leadsTable);

  const totalLeads = allLeads.length;
  const totalBookings = allLeads.filter(l => l.stage !== "new_lead" && l.stage !== "invalid_cancelled").length;
  const totalArrivals = allLeads.filter(l => ["arrived", "free_consultation_only", "first_paid_treatment", "package_purchased"].includes(l.stage)).length;
  const totalFreeConsultOnly = allLeads.filter(l => l.stage === "free_consultation_only").length;
  const totalFirstPaid = allLeads.filter(l => l.stage === "first_paid_treatment").length;
  const totalPackage = allLeads.filter(l => l.stage === "package_purchased").length;
  const totalInvalid = allLeads.filter(l => l.stage === "invalid_cancelled").length;
  const totalPaid = totalFirstPaid + totalPackage;

  const allComms = await db.select().from(commissionsTable);
  const totalReferralCost = allComms.filter(c => c.commissionType === "flat_rm30").reduce((s, c) => s + parseFloat(c.amount), 0);
  const totalPackageCommission = allComms.filter(c => c.commissionType === "package_percent").reduce((s, c) => s + parseFloat(c.amount), 0);
  const totalNetSales = allLeads.reduce((s, l) => s + (l.netSaleAmount ? parseFloat(l.netSaleAmount) : 0), 0);

  // Top partners
  const partners = await db.select().from(partnersTable).orderBy(desc(partnersTable.totalConversions)).limit(5);
  const topPartners = partners.map(p => ({
    partnerId: p.id,
    partnerName: p.displayName,
    referralCode: p.referralCode,
    totalLeads: p.totalLeads,
    totalConversions: p.totalConversions,
    totalCommission: parseFloat(p.totalCommissionEarned),
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

router.get("/analytics/monthly-trend", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const { months = "6" } = req.query as Record<string, string>;
  const monthCount = Math.min(12, parseInt(months, 10));

  const trend = [];
  const now = new Date();

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const monthStart = `${monthStr}-01`;
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];

    const leads = await db.select().from(leadsTable).where(
      and(
        sql`${leadsTable.createdAt} >= ${monthStart}::date`,
        sql`${leadsTable.createdAt} < ${monthEnd}::date`
      )
    );

    const comms = await db.select().from(commissionsTable).where(
      and(
        sql`${commissionsTable.createdAt} >= ${monthStart}::date`,
        sql`${commissionsTable.createdAt} < ${monthEnd}::date`
      )
    );

    trend.push({
      month: monthStr,
      leads: leads.length,
      arrivals: leads.filter(l => ["arrived", "free_consultation_only", "first_paid_treatment", "package_purchased"].includes(l.stage)).length,
      conversions: leads.filter(l => ["first_paid_treatment", "package_purchased"].includes(l.stage)).length,
      commissionCost: comms.reduce((s, c) => s + parseFloat(c.amount), 0),
    });
  }

  res.json(trend);
});

router.get("/analytics/pipeline", requireAuth, requireRole("admin", "zhengji_staff"), async (req, res): Promise<void> => {
  const stages = ["new_lead", "appointment_booked", "arrived", "free_consultation_only", "first_paid_treatment", "package_purchased", "invalid_cancelled"];

  const allLeads = await db.select().from(leadsTable);

  const breakdown = stages.map(stage => {
    const cnt = allLeads.filter(l => l.stage === stage).length;
    return {
      stage,
      count: cnt,
      label: STAGE_LABELS[stage]?.en ?? stage,
      labelZh: STAGE_LABELS[stage]?.zh ?? stage,
    };
  });

  res.json(breakdown);
});

export default router;
