import { Router, type IRouter } from "express";
import { db, campaignsTable, auditLogTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole, addAuditLog } from "../lib/auth";

const router: IRouter = Router();

function formatCampaign(c: any) {
  return {
    ...c,
    flatRewardAmount: parseFloat(c.flatRewardAmount),
    packageCommissionMin: parseFloat(c.packageCommissionMin),
    packageCommissionMax: parseFloat(c.packageCommissionMax),
    tierBonuses: Array.isArray(c.tierBonuses) ? c.tierBonuses : [],
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/campaigns", requireAuth, async (req, res): Promise<void> => {
  const campaigns = await db.select().from(campaignsTable).orderBy(desc(campaignsTable.createdAt));
  res.json(campaigns.map(formatCampaign));
});

router.post("/campaigns", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const {
    name, nameZh, description, startDate, endDate,
    flatRewardAmount, packageCommissionMin, packageCommissionMax,
    defaultCommissionType, tierBonuses
  } = req.body;

  if (!name || !startDate || !endDate) {
    res.status(400).json({ error: "name, startDate, endDate required" });
    return;
  }

  const [campaign] = await db.insert(campaignsTable).values({
    name,
    nameZh: nameZh ?? null,
    description: description ?? null,
    startDate,
    endDate,
    isActive: true,
    flatRewardAmount: (flatRewardAmount ?? 30).toString(),
    packageCommissionMin: (packageCommissionMin ?? 8).toString(),
    packageCommissionMax: (packageCommissionMax ?? 10).toString(),
    defaultCommissionType: defaultCommissionType ?? "flat_rm30",
    tierBonuses: tierBonuses ?? [],
  }).returning();

  const performedBy = (req as any).user?.userId?.toString() ?? "admin";
  await addAuditLog(db, auditLogTable, {
    entityType: "campaign",
    entityId: campaign.id,
    action: "created",
    newValue: name,
    performedBy,
  });

  res.status(201).json(formatCampaign(campaign));
});

router.get("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) { res.status(404).json({ error: "Not found" }); return; }

  res.json(formatCampaign(campaign));
});

router.patch("/campaigns/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const {
    name, nameZh, description, startDate, endDate, isActive,
    flatRewardAmount, packageCommissionMin, packageCommissionMax,
    defaultCommissionType, tierBonuses
  } = req.body;

  const updateData: any = {};
  if (name != null) updateData.name = name;
  if (nameZh != null) updateData.nameZh = nameZh;
  if (description != null) updateData.description = description;
  if (startDate != null) updateData.startDate = startDate;
  if (endDate != null) updateData.endDate = endDate;
  if (isActive != null) updateData.isActive = isActive;
  if (flatRewardAmount != null) updateData.flatRewardAmount = flatRewardAmount.toString();
  if (packageCommissionMin != null) updateData.packageCommissionMin = packageCommissionMin.toString();
  if (packageCommissionMax != null) updateData.packageCommissionMax = packageCommissionMax.toString();
  if (defaultCommissionType != null) updateData.defaultCommissionType = defaultCommissionType;
  if (tierBonuses != null) updateData.tierBonuses = tierBonuses;

  const [updated] = await db.update(campaignsTable).set(updateData).where(eq(campaignsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  const performedBy = (req as any).user?.userId?.toString() ?? "admin";
  await addAuditLog(db, auditLogTable, {
    entityType: "campaign",
    entityId: id,
    action: "updated",
    performedBy,
  });

  res.json(formatCampaign(updated));
});

export default router;
