import { pgTable, text, serial, timestamp, integer, numeric, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payoutBatchStatusEnum = pgEnum("payout_batch_status", [
  "draft",
  "paid",
  "disputed",
  "void",
]);

export const payoutBatchesTable = pgTable("payout_batches", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  partnerId: integer("partner_id"),
  commissionIds: json("commission_ids").notNull().default([]),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  bankReference: text("bank_reference").notNull(),
  proofUrl: text("proof_url"),
  status: payoutBatchStatusEnum("status").notNull().default("paid"),
  auditNote: text("audit_note"),
  createdBy: text("created_by").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPayoutBatchSchema = createInsertSchema(payoutBatchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayoutBatch = z.infer<typeof insertPayoutBatchSchema>;
export type PayoutBatch = typeof payoutBatchesTable.$inferSelect;
