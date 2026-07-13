import { pgTable, text, serial, timestamp, integer, boolean, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partnerTypeEnum = pgEnum("partner_type", [
  "bar",
  "gym",
  "yoga_studio",
  "golf_club",
  "salon",
  "corporate_hr",
  "agent",
  "retailer",
  "other",
]);

export const partnersTable = pgTable("partners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  brandId: integer("brand_id"),
  displayName: text("display_name").notNull(),
  businessName: text("business_name"),
  partnerType: partnerTypeEnum("partner_type").notNull().default("other"),
  referralCode: text("referral_code").notNull().unique(),
  kirimembershipId: text("kiri_membership_id"),
  phone: text("phone"),
  email: text("email"),
  isActive: boolean("is_active").notNull().default(true),
  totalLeads: integer("total_leads").notNull().default(0),
  totalConversions: integer("total_conversions").notNull().default(0),
  totalCommissionEarned: numeric("total_commission_earned", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPartnerSchema = createInsertSchema(partnersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partnersTable.$inferSelect;
