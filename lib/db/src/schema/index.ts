import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const businesses = pgTable(
  "businesses",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    industry: text("industry").notNull(),
    location: text("location").notNull(),
    currency: text("currency").notNull().default("INR"),
    financialYear: text("financial_year").notNull(),
    openingCash: numeric("opening_cash", { precision: 14, scale: 2 }).notNull(),
    monthlyRevenueTarget: numeric("monthly_revenue_target", { precision: 14, scale: 2 }).notNull(),
    // E.164 phone number (e.g. "+919876543210") linked to this business for
    // WhatsApp quick-entry. Nullable: most businesses won't set this up.
    whatsappPhone: text("whatsapp_phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("businesses_user_id_idx").on(table.userId),
    whatsappPhoneIdx: uniqueIndex("businesses_whatsapp_phone_idx").on(table.whatsappPhone),
  }),
);

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  category: text("category").notNull(),
  vendor: text("vendor"),
  customer: text("customer"),
  date: date("date").notNull(),
  status: text("status").notNull(),
  source: text("source").notNull().default("app"),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
});

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  terms: text("terms").notNull(),
});

export const receivables = pgTable("receivables", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  customer: text("customer").notNull(),
  invoice: text("invoice").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull(),
});

export const payables = pgTable("payables", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  vendor: text("vendor").notNull(),
  reference: text("reference").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  period: text("period").notNull(),
});

export const recurringExpenses = pgTable("recurring_expenses", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  category: text("category").notNull(),
  frequency: text("frequency").notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  vendor: text("vendor").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date").notNull(),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  gst: numeric("gst", { precision: 14, scale: 2 }).notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
});
