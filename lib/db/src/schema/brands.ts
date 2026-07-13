import { pgTable, text, serial, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brandsTable = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  description: text("description"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#10b981"),
  accentColor: text("accent_color").notNull().default("#6ee7b7"),
  industry: text("industry"),
  website: text("website"),
  isActive: boolean("is_active").notNull().default(true),
  settings: json("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBrandSchema = createInsertSchema(brandsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brandsTable.$inferSelect;
