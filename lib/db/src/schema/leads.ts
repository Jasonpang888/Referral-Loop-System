import { pgTable, text, serial, timestamp, integer, boolean, numeric, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadStageEnum = pgEnum("lead_stage", [
  "new_lead",
  "appointment_booked",
  "arrived",
  "free_consultation_only",
  "first_paid_treatment",
  "package_purchased",
  "invalid_cancelled",
]);

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  mobile: text("mobile").notNull(),
  whatsapp: text("whatsapp"),
  kirimembershipId: text("kiri_membership_id"),
  referralCode: text("referral_code").notNull(),
  partnerId: integer("partner_id").notNull(),
  campaignId: integer("campaign_id"),
  stage: leadStageEnum("stage").notNull().default("new_lead"),
  selectedOffer: text("selected_offer").notNull().default("Free Consultation + 10% Discount"),
  appointmentIntent: text("appointment_intent"),
  appointmentDate: date("appointment_date", { mode: "string" }),
  netSaleAmount: numeric("net_sale_amount", { precision: 10, scale: 2 }),
  proofUrl: text("proof_url"),
  consentGiven: boolean("consent_given").notNull().default(false),
  notes: text("notes"),
  lang: text("lang").notNull().default("en"),
  commissionId: integer("commission_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
