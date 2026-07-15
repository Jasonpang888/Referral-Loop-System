import { pgTable, text, serial, timestamp, integer, numeric, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payoutBatchStatusEnum = pgEnum("payout_batch_status", [
  "draft",
  "paid",
  "cancelled",
]);

// A payout batch groups a set of already-approved commissions into a single
// monthly settlement run for Finance. Creating a batch does not change the
// linked commissions' status (they stay "approved") — it only tags them with
// a batchId so they can be reviewed and paid together. Marking the batch paid
// cascades to every linked commission (status -> paid, payoutReference,
// paidAt), all in one action instead of one-by-one on /admin/payouts.
export const payoutBatchesTable = pgTable("payout_batches", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  reference: text("reference").notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  status: payoutBatchStatusEnum("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  commissionCount: integer("commission_count").notNull().default(0),
  payoutReference: text("payout_reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdBy: text("created_by"),
  auditNote: text("audit_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPayoutBatchSchema = createInsertSchema(payoutBatchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayoutBatch = z.infer<typeof insertPayoutBatchSchema>;
export type PayoutBatch = typeof payoutBatchesTable.$inferSelect;
