import { db, usersTable, partnersTable, campaignsTable, leadsTable, commissionsTable, auditLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "zhengji_salt_2024").digest("hex");
}

async function seed() {
  console.log("🌱 Seeding demo data...");

  // Create users
  const [admin] = await db.insert(usersTable).values({
    username: "admin",
    passwordHash: hashPassword("admin123"),
    role: "super_admin",
    displayName: "Admin User | 管理员",
  }).onConflictDoNothing().returning();

  const [staff] = await db.insert(usersTable).values({
    username: "staff",
    passwordHash: hashPassword("staff123"),
    role: "outlet_staff",
    displayName: "Zhengji Staff | 正脊堂员工",
  }).onConflictDoNothing().returning();

  await db.insert(usersTable).values([
    {
      username: "brand_admin",
      passwordHash: hashPassword("brand123"),
      role: "brand_admin",
      displayName: "Brand Admin",
    },
    {
      username: "finance",
      passwordHash: hashPassword("finance123"),
      role: "finance",
      displayName: "Finance User",
    },
    {
      username: "partner_staff",
      passwordHash: hashPassword("partner123"),
      role: "partner_staff",
      displayName: "Kiri Partner Staff",
    },
  ]).onConflictDoNothing();

  const [partnerUser1] = await db.insert(usersTable).values({
    username: "kiri_amy",
    passwordHash: hashPassword("partner123"),
    role: "partner_admin",
    displayName: "Amy Tan",
  }).onConflictDoNothing().returning();

  const [partnerUser2] = await db.insert(usersTable).values({
    username: "kiri_james",
    passwordHash: hashPassword("partner123"),
    role: "partner_admin",
    displayName: "James Lim",
  }).onConflictDoNothing().returning();

  const [partnerUser3] = await db.insert(usersTable).values({
    username: "kiri_mei",
    passwordHash: hashPassword("partner123"),
    role: "partner_admin",
    displayName: "Mei Ling",
  }).onConflictDoNothing().returning();

  console.log("✅ Users created");

  // Create campaign
  const [campaign] = await db.insert(campaignsTable).values({
    name: "Kiri Bar × Zhengji Q3 2026",
    nameZh: "Kiri Bar × 正脊堂 2026年第三季度",
    description: "Summer wellness referral campaign | 夏季健康推荐活动",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    isActive: true,
    flatRewardAmount: "30.00",
    packageCommissionMin: "8.00",
    packageCommissionMax: "10.00",
    defaultCommissionType: "flat_rm30",
    tierBonuses: [],
  }).onConflictDoNothing().returning();

  const [campaign2] = await db.insert(campaignsTable).values({
    name: "Kiri Bar × Zhengji Q1 2026 (Ended)",
    nameZh: "Kiri Bar × 正脊堂 2026年第一季度（已结束）",
    description: "New Year referral campaign | 新年健康推荐活动",
    startDate: "2026-01-01",
    endDate: "2026-03-31",
    isActive: false,
    flatRewardAmount: "30.00",
    packageCommissionMin: "8.00",
    packageCommissionMax: "10.00",
    defaultCommissionType: "flat_rm30",
    tierBonuses: [],
  }).onConflictDoNothing().returning();

  console.log("✅ Campaigns created");

  // Create partners
  const campaignId = campaign?.id ?? 1;

  let partner1: any, partner2: any, partner3: any;

  if (partnerUser1) {
    [partner1] = await db.insert(partnersTable).values({
      userId: partnerUser1.id,
      displayName: "Amy Tan",
      referralCode: "KIRIAMY001",
      kirimembershipId: "KIRI-AMY-001",
      phone: "+60123456001",
      isActive: true,
      totalLeads: 0,
      totalConversions: 0,
      totalCommissionEarned: "0",
    }).onConflictDoNothing().returning();
  }

  if (partnerUser2) {
    [partner2] = await db.insert(partnersTable).values({
      userId: partnerUser2.id,
      displayName: "James Lim",
      referralCode: "KIRIJAM002",
      kirimembershipId: "KIRI-JAM-002",
      phone: "+60123456002",
      isActive: true,
      totalLeads: 0,
      totalConversions: 0,
      totalCommissionEarned: "0",
    }).onConflictDoNothing().returning();
  }

  if (partnerUser3) {
    [partner3] = await db.insert(partnersTable).values({
      userId: partnerUser3.id,
      displayName: "Mei Ling",
      referralCode: "KIRIMEI003",
      kirimembershipId: "KIRI-MEI-003",
      phone: "+60123456003",
      isActive: true,
      totalLeads: 0,
      totalConversions: 0,
      totalCommissionEarned: "0",
    }).onConflictDoNothing().returning();
  }

  if (!partner1 || !partner2 || !partner3) {
    // Fetch existing partners if creation was no-op
    const allPartners = await db.select().from(partnersTable);
    if (!partner1) partner1 = allPartners.find(p => p.referralCode === "KIRIAMY001");
    if (!partner2) partner2 = allPartners.find(p => p.referralCode === "KIRIJAM002");
    if (!partner3) partner3 = allPartners.find(p => p.referralCode === "KIRIMEI003");
  }

  console.log("✅ Partners created");

  // Create leads with various stages
  const leadsData = [
    // Amy's leads
    { name: "Sarah Chen", nameZh: "陈晓华", mobile: "+60191001001", whatsapp: "+60191001001", kirimembershipId: "KIRI-C001", referralCode: "KIRIAMY001", partnerId: partner1?.id, campaignId, stage: "package_purchased", netSaleAmount: "480.00", commType: "flat_rm30" },
    { name: "Rachel Ng", nameZh: "黄婷婷", mobile: "+60191001002", referralCode: "KIRIAMY001", partnerId: partner1?.id, campaignId, stage: "first_paid_treatment", netSaleAmount: "120.00", commType: "flat_rm30" },
    { name: "Kevin Wong", mobile: "+60191001003", referralCode: "KIRIAMY001", partnerId: partner1?.id, campaignId, stage: "arrived" },
    { name: "Priya Krishnan", mobile: "+60191001004", referralCode: "KIRIAMY001", partnerId: partner1?.id, campaignId, stage: "appointment_booked" },
    { name: "David Tan", mobile: "+60191001005", referralCode: "KIRIAMY001", partnerId: partner1?.id, campaignId, stage: "new_lead" },
    { name: "Lydia Foo", mobile: "+60191001006", referralCode: "KIRIAMY001", partnerId: partner1?.id, campaignId, stage: "free_consultation_only" },
    { name: "Marcus Lee", mobile: "+60191001007", referralCode: "KIRIAMY001", partnerId: partner1?.id, campaignId, stage: "package_purchased", netSaleAmount: "680.00", commType: "package_percent", commRate: "10" },
    // James's leads
    { name: "Chloe Yap", mobile: "+60191002001", referralCode: "KIRIJAM002", partnerId: partner2?.id, campaignId, stage: "package_purchased", netSaleAmount: "560.00", commType: "flat_rm30" },
    { name: "Ethan Sim", mobile: "+60191002002", referralCode: "KIRIJAM002", partnerId: partner2?.id, campaignId, stage: "first_paid_treatment", netSaleAmount: "90.00", commType: "flat_rm30" },
    { name: "Natasha Kumar", mobile: "+60191002003", referralCode: "KIRIJAM002", partnerId: partner2?.id, campaignId, stage: "arrived" },
    { name: "Brian Ong", mobile: "+60191002004", referralCode: "KIRIJAM002", partnerId: partner2?.id, campaignId, stage: "invalid_cancelled" },
    { name: "Vivian Lau", mobile: "+60191002005", referralCode: "KIRIJAM002", partnerId: partner2?.id, campaignId, stage: "new_lead" },
    // Mei Ling's leads
    { name: "Tommy Ho", mobile: "+60191003001", referralCode: "KIRIMEI003", partnerId: partner3?.id, campaignId, stage: "package_purchased", netSaleAmount: "800.00", commType: "package_percent", commRate: "8" },
    { name: "Siti Aminah", mobile: "+60191003002", referralCode: "KIRIMEI003", partnerId: partner3?.id, campaignId, stage: "appointment_booked" },
    { name: "Ryan Chai", mobile: "+60191003003", referralCode: "KIRIMEI003", partnerId: partner3?.id, campaignId, stage: "new_lead" },
  ];

  const createdLeads: any[] = [];
  for (const ld of leadsData) {
    if (!ld.partnerId) continue;
    const [lead] = await db.insert(leadsTable).values({
      name: ld.name,
      nameZh: (ld as any).nameZh ?? null,
      mobile: ld.mobile,
      whatsapp: (ld as any).whatsapp ?? null,
      kirimembershipId: (ld as any).kirimembershipId ?? null,
      referralCode: ld.referralCode,
      partnerId: ld.partnerId,
      campaignId: ld.campaignId,
      stage: ld.stage as any,
      selectedOffer: "Free Consultation + 10% Discount",
      consentGiven: true,
      netSaleAmount: ld.netSaleAmount ?? null,
      lang: "en",
    }).onConflictDoNothing().returning();

    if (lead) {
      createdLeads.push({ ...lead, commType: ld.commType, commRate: (ld as any).commRate });
    }
  }

  console.log(`✅ ${createdLeads.length} leads created`);

  // Create commissions for leads with netSaleAmount
  const commLeads = createdLeads.filter(l => l.netSaleAmount != null && (l.stage === "first_paid_treatment" || l.stage === "package_purchased"));
  
  for (const lead of commLeads) {
    const netAmt = parseFloat(lead.netSaleAmount);
    let amount: number;
    if (lead.commType === "package_percent" && lead.commRate) {
      amount = netAmt * parseFloat(lead.commRate) / 100;
    } else {
      amount = 30;
    }

    const statuses = ["pending", "approved", "paid"];
    const status = statuses[Math.floor(Math.random() * statuses.length)] as any;

    const [comm] = await db.insert(commissionsTable).values({
      leadId: lead.id,
      partnerId: lead.partnerId,
      campaignId: lead.campaignId,
      amount: amount.toFixed(2),
      commissionType: lead.commType ?? "flat_rm30",
      commissionRate: lead.commRate ?? null,
      netSaleAmount: lead.netSaleAmount,
      status,
      payoutReference: status === "paid" ? `PAY-${Date.now()}-${lead.id}` : null,
      auditNote: "Demo data | 演示数据",
      approvedBy: status !== "pending" ? "1" : null,
      approvedAt: status !== "pending" ? new Date() : null,
      paidAt: status === "paid" ? new Date() : null,
    }).onConflictDoNothing().returning();

    if (comm) {
      // Update lead's commissionId
      await db.update(leadsTable).set({ commissionId: comm.id }).where(eq(leadsTable.id, lead.id));
    }
  }

  console.log(`✅ Commissions created for ${commLeads.length} leads`);

  // Update partner stats
  for (const [partner, referralCode] of [[partner1, "KIRIAMY001"], [partner2, "KIRIJAM002"], [partner3, "KIRIMEI003"]] as const) {
    if (!partner) continue;
    const pLeads = createdLeads.filter(l => l.referralCode === referralCode);
    const pConversions = pLeads.filter(l => ["first_paid_treatment", "package_purchased"].includes(l.stage));
    
    // Sum commission from DB
    const comms = await db.select().from(commissionsTable).where(
      eq(commissionsTable.partnerId, partner.id)
    );
    const totalComm = comms.reduce((s, c) => s + parseFloat(c.amount), 0);

    await db.update(partnersTable).set({
      totalLeads: pLeads.length,
      totalConversions: pConversions.length,
      totalCommissionEarned: totalComm.toFixed(2),
    }).where(eq(partnersTable.id, partner.id));
  }

  // Add audit log entries
  await db.insert(auditLogTable).values([
    { entityType: "campaign", entityId: campaignId, action: "created", newValue: "Kiri Bar × Zhengji Q3 2026", performedBy: "admin" },
    { entityType: "partner", entityId: partner1?.id ?? 1, action: "created", newValue: "Amy Tan", performedBy: "admin" },
    { entityType: "partner", entityId: partner2?.id ?? 2, action: "created", newValue: "James Lim", performedBy: "admin" },
    { entityType: "partner", entityId: partner3?.id ?? 3, action: "created", newValue: "Mei Ling", performedBy: "admin" },
  ]).onConflictDoNothing();

  console.log("✅ Audit log seeded");
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 Demo data seeded! Login credentials:");
  console.log("");
  console.log("  👑 Admin:         admin / admin123");
  console.log("  👩‍⚕️ Zhengji Staff: staff / staff123");
  console.log("  💚 Kiri Partner1: kiri_amy / partner123   (Amy Tan)");
  console.log("  💚 Kiri Partner2: kiri_james / partner123 (James Lim)");
  console.log("  💚 Kiri Partner3: kiri_mei / partner123   (Mei Ling)");
  console.log("");
  console.log("  🔗 Referral links:");
  console.log("     /ref/KIRIAMY001  /ref/KIRIJAM002  /ref/KIRIMEI003");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

seed().catch(console.error).finally(() => process.exit(0));
