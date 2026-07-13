import { pgTable, text, serial, timestamp, boolean, numeric, date, json, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionTypeEnum = pgEnum("commission_type", ["flat_rm30", "package_percent"]);

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  description: text("description"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  flatRewardAmount: numeric("flat_reward_amount", { precision: 10, scale: 2 }).notNull().default("30"),
  packageCommissionMin: numeric("package_commission_min", { precision: 5, scale: 2 }).notNull().default("8"),
  packageCommissionMax: numeric("package_commission_max", { precision: 5, scale: 2 }).notNull().default("10"),
  defaultCommissionType: commissionTypeEnum("default_commission_type").notNull().default("flat_rm30"),
  tierBonuses: json("tier_bonuses").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
