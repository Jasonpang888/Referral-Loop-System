import { pgTable, text, serial, timestamp, integer, numeric, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// NOTE: this table was already provisioned in the live database ahead of this
// codebase (see audit report — the DB was built for a more complete V2 design
// before the app caught up). Schema here mirrors the live table exactly:
// batches are scoped to a single partner (one bank transfer per partner),
// commissionIds is a JSON array of the commission rows it covers (no batchId
// FK column on commissions — "which commissions are already batched" is
// determined by containment against this array), and bankReference is
// required because the common flow is "log a transfer Finance already made",
// not a two-step draft-then-pay flow. status defaults to "paid" for that
// reason; "draft" exists for staging a batch before the transfer is actually
// sent, "disputed"/"void" for corrections after the fact.
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
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
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
