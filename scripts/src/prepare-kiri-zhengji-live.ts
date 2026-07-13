import {
  auditLogTable,
  brandsTable,
  campaignsTable,
  commissionsTable,
  db,
  leadsTable,
  partnersTable,
  payoutBatchesTable,
  pool,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import crypto from "crypto";

const RESET_PASSWORDS = process.env.RESET_LAUNCH_PASSWORDS === "true";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + (process.env.PASSWORD_SALT ?? "zhengji_salt_2024")).digest("hex");
}

async function ensureBrand() {
  const [existing] = await db
    .select()
    .from(brandsTable)
    .where(or(eq(brandsTable.name, "Zhengji Wellness"), eq(brandsTable.nameZh, "正脊堂")))
    .limit(1);

  if (existing) {
    const [brand] = await db
      .update(brandsTable)
      .set({
        name: "Zhengji Wellness",
        nameZh: "正脊堂",
        description: "Chiropractic and wellness referral campaign for Kiri Bar partners",
        industry: "Wellness",
        isActive: true,
        primaryColor: "#239463",
        accentColor: "#f4c95d",
      })
      .where(eq(brandsTable.id, existing.id))
      .returning();
    return brand;
  }

  const [brand] = await db
    .insert(brandsTable)
    .values({
      name: "Zhengji Wellness",
      nameZh: "正脊堂",
      description: "Chiropractic and wellness referral campaign for Kiri Bar partners",
      industry: "Wellness",
      isActive: true,
      primaryColor: "#239463",
      accentColor: "#f4c95d",
      settings: {},
    })
    .returning();
  return brand;
}

async function ensureUser(params: {
  username: string;
  password: string;
  role: "super_admin" | "brand_admin" | "outlet_staff" | "finance" | "partner_admin" | "partner_staff";
  displayName: string;
  brandId: number | null;
}) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, params.username)).limit(1);
  const baseUpdate = {
    role: params.role,
    displayName: params.displayName,
    brandId: params.brandId,
  };

  if (existing) {
    const [user] = await db
      .update(usersTable)
      .set(RESET_PASSWORDS ? { ...baseUpdate, passwordHash: hashPassword(params.password) } : baseUpdate)
      .where(eq(usersTable.id, existing.id))
      .returning();
    return user;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      username: params.username,
      passwordHash: hashPassword(params.password),
      ...baseUpdate,
    })
    .returning();
  return user;
}

async function ensureCampaign(brandId: number) {
  const campaignName = "Kiri Bar × Zhengji Wellness Q3 2026";
  const [existing] = await db
    .select()
    .from(campaignsTable)
    .where(or(eq(campaignsTable.name, campaignName), eq(campaignsTable.nameZh, "Kiri Bar × 正脊堂 2026年第三季度")))
    .limit(1);

  const payload = {
    brandId,
    name: campaignName,
    nameZh: "Kiri Bar × 正脊堂 2026年第三季度",
    description: "Kiri Bar member referral campaign for Zhengji Wellness first visits and packages",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    isActive: true,
    flatRewardAmount: "30.00",
    packageCommissionMin: "8.00",
    packageCommissionMax: "10.00",
    defaultCommissionType: "flat_rm30" as const,
    tierBonuses: [],
  };

  if (existing) {
    const [campaign] = await db.update(campaignsTable).set(payload).where(eq(campaignsTable.id, existing.id)).returning();
    return campaign;
  }

  const [campaign] = await db.insert(campaignsTable).values(payload).returning();
  return campaign;
}

async function ensurePartner(params: {
  brandId: number;
  userId: number;
  displayName: string;
  referralCode: string;
  kirimembershipId: string;
  phone: string;
}) {
  const [existing] = await db.select().from(partnersTable).where(eq(partnersTable.referralCode, params.referralCode)).limit(1);
  const payload = {
    userId: params.userId,
    brandId: params.brandId,
    displayName: params.displayName,
    businessName: "Kiri Bar",
    partnerType: "bar" as const,
    kirimembershipId: params.kirimembershipId,
    phone: params.phone,
    isActive: true,
  };

  if (existing) {
    const [partner] = await db.update(partnersTable).set(payload).where(eq(partnersTable.id, existing.id)).returning();
    return partner;
  }

  const [partner] = await db
    .insert(partnersTable)
    .values({
      ...payload,
      referralCode: params.referralCode,
      totalLeads: 0,
      totalConversions: 0,
      totalCommissionEarned: "0",
    })
    .returning();
  return partner;
}

async function main() {
  const brand = await ensureBrand();
  const campaign = await ensureCampaign(brand.id);

  await ensureUser({ username: "admin", password: "admin123", role: "super_admin", displayName: "Super Admin", brandId: null });
  await ensureUser({ username: "brand_admin", password: "brand123", role: "brand_admin", displayName: "正脊堂 Brand Admin", brandId: brand.id });
  await ensureUser({ username: "staff", password: "staff123", role: "outlet_staff", displayName: "正脊堂 Outlet Staff", brandId: brand.id });
  await ensureUser({ username: "finance", password: "finance123", role: "finance", displayName: "正脊堂 Finance", brandId: brand.id });
  await ensureUser({ username: "partner_staff", password: "partner123", role: "partner_staff", displayName: "Kiri Partner Staff", brandId: brand.id });

  const kiriUsers = [
    await ensureUser({ username: "kiri_amy", password: "partner123", role: "partner_admin", displayName: "Amy Tan", brandId: brand.id }),
    await ensureUser({ username: "kiri_james", password: "partner123", role: "partner_admin", displayName: "James Lim", brandId: brand.id }),
    await ensureUser({ username: "kiri_mei", password: "partner123", role: "partner_admin", displayName: "Mei Ling", brandId: brand.id }),
  ];

  const partners = [
    await ensurePartner({ brandId: brand.id, userId: kiriUsers[0].id, displayName: "Amy Tan", referralCode: "KIRIAMY001", kirimembershipId: "KIRI-AMY-001", phone: "+60123456001" }),
    await ensurePartner({ brandId: brand.id, userId: kiriUsers[1].id, displayName: "James Lim", referralCode: "KIRIJAM002", kirimembershipId: "KIRI-JAM-002", phone: "+60123456002" }),
    await ensurePartner({ brandId: brand.id, userId: kiriUsers[2].id, displayName: "Mei Ling", referralCode: "KIRIMEI003", kirimembershipId: "KIRI-MEI-003", phone: "+60123456003" }),
  ];

  const referralCodes = partners.map((partner) => partner.referralCode);
  const partnerIds = partners.map((partner) => partner.id);

  await db
    .update(leadsTable)
    .set({ brandId: brand.id, campaignId: campaign.id })
    .where(inArray(leadsTable.referralCode, referralCodes));

  await db
    .update(commissionsTable)
    .set({ brandId: brand.id, campaignId: campaign.id })
    .where(inArray(commissionsTable.partnerId, partnerIds));

  await db
    .update(payoutBatchesTable)
    .set({ brandId: brand.id })
    .where(inArray(payoutBatchesTable.partnerId, partnerIds));

  await db
    .update(auditLogTable)
    .set({ brandId: brand.id })
    .where(and(isNull(auditLogTable.brandId), inArray(auditLogTable.entityType, ["lead", "commission", "partner", "campaign", "payout_batch"])));

  console.log("Kiri x Zhengji live data is ready.");
  console.log(`Brand #${brand.id}: ${brand.nameZh} / ${brand.name}`);
  console.log(`Campaign #${campaign.id}: ${campaign.name}`);
  console.log(`Referral links: /ref/${referralCodes.join(", /ref/")}`);
  console.log(`Passwords reset: ${RESET_PASSWORDS ? "yes" : "no"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
