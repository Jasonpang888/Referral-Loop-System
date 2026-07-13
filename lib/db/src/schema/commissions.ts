import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionStatusEnum = pgEnum("commission_status", [
  "pending",
  "approved",
  "paid",
  "disputed",
  "rejected",
]);

export const commissionsTable = pgTable("commissions", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  partnerId: integer("partner_id").notNull(),
  campaignId: integer("campaign_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  commissionType: text("commission_type").notNull().default("flat_rm30"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  netSaleAmount: numeric("net_sale_amount", { precision: 10, scale: 2 }),
  status: commissionStatusEnum("status").notNull().default("pending"),
  payoutReference: text("payout_reference"),
  proofUrl: text("proof_url"),
  auditNote: text("audit_note"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCommissionSchema = createInsertSchema(commissionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissionsTable.$inferSelect;
