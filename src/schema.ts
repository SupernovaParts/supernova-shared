// supernova-shared/src/schema.ts
//
// Master Drizzle/Zod schema — Single Source of Truth fuer alle Frontends
// (supernova-website, supernova-dashboard, supernova-admin-portal).
//
// Basis: supernova-website/shared/schema.ts (1141 Zeilen, am vollstaendigsten)
// Aufgabe 7b (Plan: 2026-05-07_schema-source-of-truth.md)
//
// Frontends importieren ueber `@supernova/shared` und re-exportieren in
// ihren lokalen `shared/schema.ts` (siehe Aufgabe 7c).
//
// Admin-portal-only-Stuecke (RenderJob*, TechnicalOrderView) bleiben
// LOKAL im admin-portal — werden hier bewusst NICHT exportiert.

// HINWEIS: drizzle-zod@0.8.3 verwendet intern `zod/v4`-Typen (siehe
// node_modules/drizzle-zod/schema.types.d.ts). Damit `z.infer<typeof xxxSchema>`
// kompatibel auswertet, MUSS hier ebenfalls aus `zod/v4` importiert werden — sonst
// "ZodObject does not satisfy ZodType<any,any,any>" Errors. Zur Laufzeit ist das
// derselbe Zod (3.25+ enthaelt v4 als Submodul).
import { z } from "zod/v4";
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, jsonb, index, serial, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ============= ENUMS =============

export const userRoleEnum = pgEnum("user_role", ["admin", "partner", "customer", "supplier", "qc"]);

export const orderStatusEnum = pgEnum("order_status", [
  "neu_eingegangen",
  "in_bearbeitung",
  "angebot_erstellt",
  "abgeschlossen"
]);

// pgEnum bleibt auf den 6 customer-facing Werten (DB-Persistenzstand der website).
// Admin-portal-Workflow-Werte ("admin_review", "ready") werden auf Type-Ebene
// als separates `AdminJobStatus` ausgegeben (siehe TYPES-Block unten).
export const jobStatusEnum = pgEnum("job_status", [
  "new",
  "estimate",
  "quoted",
  "ordered",
  "in_production",
  "shipped"
]);

export const orderStateStatusEnum = pgEnum("order_state_status", [
  "eingang",
  "in_pruefung",
  "angebot_erstellen",
  "angebot_gesendet",
  "in_fertigung",
  "in_sendung",
  "abgeschlossen",
  "archiv",
]);

// ============= BIDDING SYSTEM ENUMS =============

// Part status in the bidding workflow
export const partBiddingStatusEnum = pgEnum("part_bidding_status", [
  "pending",           // Waiting for bidding to start
  "bidding",           // Active bidding (6-hour timer)
  "assigned",          // Assigned to a supplier
  "in_production",     // Being manufactured
  "production_done",   // Manufacturing complete
  "in_package",        // Added to a package
  "shipped",           // Package shipped
  "qc_pending",        // Awaiting QC check
  "qc_approved",       // QC approved
  "qc_rejected",       // QC rejected
  "delivered",         // Delivered to customer
  "completed",         // Customer confirmed receipt
]);

// Status of individual bids
export const bidStatusEnum = pgEnum("bid_status", [
  "active",            // Bid is valid and competing
  "won",               // This bid won
  "lost",              // Another bid won
  "withdrawn",         // Supplier withdrew bid
  "expired",           // Auction ended without this bid winning
]);

// Production status for parts
export const productionStatusEnum = pgEnum("production_status", [
  "not_started",       // Not yet started
  "in_progress",       // Currently being made
  "paused",            // Paused (issue or waiting)
  "defective",         // Part is defective
  "completed",         // Manufacturing complete
]);

// Package status
export const packageStatusEnum = pgEnum("package_status", [
  "packing",           // Being packed
  "ready",             // Ready to ship
  "shipped",           // Shipped
  "in_transit",        // In transit
  "delivered",         // Delivered
  "qc_check",          // At QC station
  "qc_approved",       // QC approved all parts
  "qc_rejected",       // QC found issues
  "customer_received", // Customer confirmed receipt
]);

// QC event types
export const qcEventTypeEnum = pgEnum("qc_event_type", [
  "scan_in",           // Package scanned into QC
  "part_approved",     // Single part approved
  "part_rejected",     // Single part rejected
  "package_approved",  // All parts in package approved
  "package_rejected",  // Package has rejected parts
  "resend_requested",  // Resend requested for rejected parts
]);

// ============= DATABASE TABLES =============

// Admin users (from admin-frontend)
export const localUsers = pgTable("local_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  passwordHash: varchar("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("partner"),
  email: varchar("email"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  role: userRoleEnum("role").notNull().default("partner"),
  companyName: varchar("company_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer users (NEW - for customer-frontend)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Unified orders table (supports both admin and customer orders)
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").notNull().unique(),
  status: orderStatusEnum("status").notNull().default("neu_eingegangen"),

  // Admin-style customer info (for backwards compatibility)
  customerName: varchar("customer_name"),
  customerEmail: varchar("customer_email"),
  customerCompany: varchar("customer_company"),
  customerPhone: varchar("customer_phone"),

  // NEW: Link to customer account (nullable for admin-created orders)
  customerId: integer("customer_id").references(() => customers.id),

  // Order details
  material: varchar("material"),
  quantity: integer("quantity").default(1),
  tolerance: varchar("tolerance"),
  surfaceRoughness: varchar("surface_roughness"),
  formAndPositionTolerances: text("form_and_position_tolerances"),
  technicalNotes: text("technical_notes"),

  // Admin fields
  adminPrice: varchar("admin_price"),
  adminNotes: text("admin_notes"),
  adminScreenshotUrls: text("admin_screenshot_urls").array(),

  // Partner assignment
  assignedPartnerId: varchar("assigned_partner_id"),
  partnerNotes: text("partner_notes"),

  // NEW: Customer-visible quoted price
  quotedPrice: decimal("quoted_price", { precision: 10, scale: 2 }),

  // NEW: External ID for syncing with Wurmloch-Office API
  externalId: varchar("external_id", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_orders_status").on(table.status),
  index("idx_orders_assigned_partner").on(table.assignedPartnerId),
  index("idx_orders_customer_id").on(table.customerId),
]);

export const orderFiles = pgTable("order_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type"),
  fileSize: varchar("file_size"),
  objectPath: varchar("object_path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const orderQueries = pgTable("order_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  authorId: varchar("author_id").notNull(),
  authorRole: userRoleEnum("author_role").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderState = pgTable("order_state", {
  orderKey: varchar("order_key").primaryKey(),
  jobIds: jsonb("job_ids").$type<string[]>().default([]),
  status: orderStateStatusEnum("status").notNull().default("eingang"),

  customerEmail: varchar("customer_email"),
  customerCompany: varchar("customer_company"),
  customerName: varchar("customer_name"),

  finalPrice: varchar("final_price"),
  currency: varchar("currency").default("EUR"),
  leadTimeDays: varchar("lead_time_days"),

  adminNotes: text("admin_notes"),
  customerNotes: text("customer_notes"),

  trackingCarrier: varchar("tracking_carrier"),
  trackingNumber: varchar("tracking_number"),
  trackingUrl: varchar("tracking_url"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_order_state_status").on(table.status),
  index("idx_order_state_customer_email").on(table.customerEmail),
]);

// ============= BIDDING SYSTEM TABLES =============

// Suppliers - companies that can bid on parts
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),

  // Capabilities and certifications
  capabilities: jsonb("capabilities").$type<string[]>().default([]), // e.g., ["cnc_milling", "cnc_turning", "anodizing"]
  certifications: jsonb("certifications").$type<string[]>().default([]), // e.g., ["ISO9001", "AS9100"]
  maxCapacityPerWeek: integer("max_capacity_per_week").default(100), // Max parts per week

  // Performance metrics
  totalJobsCompleted: integer("total_jobs_completed").default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  onTimeDeliveryRate: decimal("on_time_delivery_rate", { precision: 5, scale: 2 }).default("100"),
  qualityRejectionRate: decimal("quality_rejection_rate", { precision: 5, scale: 2 }).default("0"),

  isActive: integer("is_active").default(1), // 1 = active, 0 = inactive
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_suppliers_email").on(table.email),
  index("idx_suppliers_active").on(table.isActive),
]);

// Parts in the bidding system (linked to external job via job_id)
export const biddingParts = pgTable("bidding_parts", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id", { length: 255 }).notNull(), // External job ID from Wurmloch API
  orderKey: varchar("order_key", { length: 255 }), // Link to order_state

  // Part info (cached from API)
  partName: varchar("part_name", { length: 255 }),
  material: varchar("material", { length: 100 }),
  quantity: integer("quantity").default(1),

  // === PRICE HIERARCHY (customer sees strongest available) ===
  // 1. AI/KI Schätzung (schwächste) - automatisch bei Upload
  aiPrice: decimal("ai_price", { precision: 10, scale: 2 }),
  aiPriceMin: decimal("ai_price_min", { precision: 10, scale: 2 }),
  aiPriceMax: decimal("ai_price_max", { precision: 10, scale: 2 }),

  // 2. Admin Schätzung (mittel) - überschreibt KI
  adminPrice: decimal("admin_price", { precision: 10, scale: 2 }),
  adminPriceNotes: text("admin_price_notes"),

  // 3. Bestes Zulieferer-Angebot (stärkste) - günstigstes gewinnt
  lowestBidPrice: decimal("lowest_bid_price", { precision: 10, scale: 2 }),
  lowestBidSupplierId: integer("lowest_bid_supplier_id"),

  // === CUSTOMER-FACING OFFER (admin-portal Part API view) ===
  // open question (Aufgabe 7b): nicht in supernova-shared/openapi.json bestaetigt;
  // Quelle ist OpenAPI `CustomerOfferRequest.customer_price` als Request-Body, nicht als Part-Property.
  // In admin-portal lokal als optional inline-typisiert (PartCalculationDetailsDialog.tsx:115).
  // Daher hier optional() / nullable() — Backend-Bestaetigung steht aus.
  customerPrice: decimal("customer_price", { precision: 10, scale: 2 }), // admin-portal-only? siehe report

  // === CAD / DRAWING FILE URLS (admin-portal Part API view) ===
  // open question (Aufgabe 7b): cad_file_url wird in OpenAPI nur in einer Beschreibung erwaehnt,
  // customer_drawing_file_url ist nicht in openapi.json definiert.
  // In admin-portal weit verbreitet (AdminFlowDashboard.tsx, useJobsPolling.ts, grouping.ts, SupplierDashboard.tsx).
  // Hier optional() — Backend-Bestaetigung steht aus.
  cadFileUrl: varchar("cad_file_url", { length: 500 }), // admin-portal-only? siehe report
  customerDrawingFileUrl: varchar("customer_drawing_file_url", { length: 500 }), // admin-portal-only? siehe report

  // === DEFECT TRACKING ===
  isDefective: integer("is_defective").default(0),
  defectMarkedBy: varchar("defect_marked_by", { length: 50 }),
  defectNotes: text("defect_notes"),
  defectImages: jsonb("defect_images").$type<string[]>().default([]),

  // "Schwierig aber machbar" - wenn ein Zulieferer defekt sagt aber anderer quotet
  difficultButFeasible: integer("difficult_but_feasible").default(0),
  feasiblePrice: decimal("feasible_price", { precision: 10, scale: 2 }),

  // === BIDDING STATUS ===
  biddingStatus: partBiddingStatusEnum("bidding_status").notNull().default("pending"),
  biddingStartedAt: timestamp("bidding_started_at"),
  biddingEndsAt: timestamp("bidding_ends_at"), // 6 Stunden nach Start
  biddingExtendedCount: integer("bidding_extended_count").default(0),

  // === ASSIGNMENT ===
  assignedSupplierId: integer("assigned_supplier_id").references(() => suppliers.id),
  assignedAt: timestamp("assigned_at"),
  assignedPrice: decimal("assigned_price", { precision: 10, scale: 2 }),
  productionDeadline: timestamp("production_deadline"), // 24h nach Assignment

  // === PRODUCTION TRACKING ===
  productionStatus: productionStatusEnum("production_status").default("not_started"),
  productionStartedAt: timestamp("production_started_at"),
  productionCompletedAt: timestamp("production_completed_at"),
  defectiveNotes: text("defective_notes"),

  customerNotes: text("customer_notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bidding_parts_job_id").on(table.jobId),
  index("idx_bidding_parts_order_key").on(table.orderKey),
  index("idx_bidding_parts_status").on(table.biddingStatus),
  index("idx_bidding_parts_supplier").on(table.assignedSupplierId),
]);

// Bids from suppliers on parts
export const bids = pgTable("bids", {
  id: serial("id").primaryKey(),
  partId: integer("part_id").notNull().references(() => biddingParts.id),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),

  // Bid details
  pricePerPart: decimal("price_per_part", { precision: 10, scale: 2 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  leadTimeDays: integer("lead_time_days"),
  notes: text("notes"),

  // Defect bid - Zulieferer markiert als fehlerhaft statt Preis zu geben
  isDefectBid: integer("is_defect_bid").default(0), // 0 = normales Angebot, 1 = Defekt-Markierung
  defectNotes: text("defect_notes"),
  defectImages: jsonb("defect_images").$type<string[]>().default([]),

  // Bid status
  status: bidStatusEnum("status").notNull().default("active"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bids_part_id").on(table.partId),
  index("idx_bids_supplier_id").on(table.supplierId),
  index("idx_bids_status").on(table.status),
]);

// Production images uploaded by suppliers
export const productionImages = pgTable("production_images", {
  id: serial("id").primaryKey(),
  partId: integer("part_id").notNull().references(() => biddingParts.id),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),

  // Image storage
  imageUrl: varchar("image_url", { length: 500 }).notNull(), // R2 URL
  r2Key: varchar("r2_key", { length: 255 }).notNull(),

  // Metadata
  caption: varchar("caption", { length: 255 }),
  imageType: varchar("image_type", { length: 50 }).default("progress"), // progress, completed, defect

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_production_images_part_id").on(table.partId),
]);

// Packages for shipping
export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  packageCode: varchar("package_code", { length: 50 }).notNull().unique(), // QR code content

  // Supplier info
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),

  // Package status
  status: packageStatusEnum("status").notNull().default("packing"),

  // Shipping info
  trackingNumber: varchar("tracking_number", { length: 100 }),
  trackingCarrier: varchar("tracking_carrier", { length: 50 }),
  trackingUrl: varchar("tracking_url", { length: 500 }),
  shippedAt: timestamp("shipped_at"),

  // QC info
  qcScannedAt: timestamp("qc_scanned_at"),
  qcCompletedAt: timestamp("qc_completed_at"),
  qcApproved: integer("qc_approved"), // 1 = approved, 0 = rejected, null = pending

  // Customer info
  customerReceivedAt: timestamp("customer_received_at"),

  // Label PDF
  labelPdfUrl: varchar("label_pdf_url", { length: 500 }),
  labelPdfR2Key: varchar("label_pdf_r2_key", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_packages_code").on(table.packageCode),
  index("idx_packages_supplier").on(table.supplierId),
  index("idx_packages_status").on(table.status),
]);

// Junction table: parts in packages
export const packageParts = pgTable("package_parts", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => packages.id),
  partId: integer("part_id").notNull().references(() => biddingParts.id),

  // QC status for this specific part
  qcStatus: varchar("qc_status", { length: 20 }).default("pending"), // pending, approved, rejected
  qcNotes: text("qc_notes"),
  qcCheckedAt: timestamp("qc_checked_at"),
  qcCheckedBy: integer("qc_checked_by"), // User ID of QC person

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_package_parts_package").on(table.packageId),
  index("idx_package_parts_part").on(table.partId),
]);

// QC events log
export const qcEvents = pgTable("qc_events", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").references(() => packages.id),
  partId: integer("part_id").references(() => biddingParts.id),

  eventType: qcEventTypeEnum("event_type").notNull(),
  notes: text("notes"),

  // Who performed the action
  userId: varchar("user_id", { length: 255 }),
  userName: varchar("user_name", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_qc_events_package").on(table.packageId),
  index("idx_qc_events_part").on(table.partId),
  index("idx_qc_events_type").on(table.eventType),
]);

// ============= RELATIONS =============

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  files: many(orderFiles),
  queries: many(orderQueries),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  assignedPartner: one(userProfiles, {
    fields: [orders.assignedPartnerId],
    references: [userProfiles.userId],
  }),
}));

export const orderFilesRelations = relations(orderFiles, ({ one }) => ({
  order: one(orders, {
    fields: [orderFiles.orderId],
    references: [orders.id],
  }),
}));

export const orderQueriesRelations = relations(orderQueries, ({ one }) => ({
  order: one(orders, {
    fields: [orderQueries.orderId],
    references: [orders.id],
  }),
}));

// Bidding system relations
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  bids: many(bids),
  assignedParts: many(biddingParts),
  productionImages: many(productionImages),
  packages: many(packages),
}));

export const biddingPartsRelations = relations(biddingParts, ({ one, many }) => ({
  assignedSupplier: one(suppliers, {
    fields: [biddingParts.assignedSupplierId],
    references: [suppliers.id],
  }),
  bids: many(bids),
  productionImages: many(productionImages),
  packageParts: many(packageParts),
  qcEvents: many(qcEvents),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  part: one(biddingParts, {
    fields: [bids.partId],
    references: [biddingParts.id],
  }),
  supplier: one(suppliers, {
    fields: [bids.supplierId],
    references: [suppliers.id],
  }),
}));

export const productionImagesRelations = relations(productionImages, ({ one }) => ({
  part: one(biddingParts, {
    fields: [productionImages.partId],
    references: [biddingParts.id],
  }),
  supplier: one(suppliers, {
    fields: [productionImages.supplierId],
    references: [suppliers.id],
  }),
}));

export const packagesRelations = relations(packages, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [packages.supplierId],
    references: [suppliers.id],
  }),
  parts: many(packageParts),
  qcEvents: many(qcEvents),
}));

export const packagePartsRelations = relations(packageParts, ({ one }) => ({
  package: one(packages, {
    fields: [packageParts.packageId],
    references: [packages.id],
  }),
  part: one(biddingParts, {
    fields: [packageParts.partId],
    references: [biddingParts.id],
  }),
}));

export const qcEventsRelations = relations(qcEvents, ({ one }) => ({
  package: one(packages, {
    fields: [qcEvents.packageId],
    references: [packages.id],
  }),
  part: one(biddingParts, {
    fields: [qcEvents.partId],
    references: [biddingParts.id],
  }),
}));

// ============= INSERT SCHEMAS =============

export const insertLocalUserSchema = createInsertSchema(localUsers).omit({
  id: true,
  createdAt: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  passwordHash: true
}).extend({
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderFileSchema = createInsertSchema(orderFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertOrderQuerySchema = createInsertSchema(orderQueries).omit({
  id: true,
  createdAt: true,
});

export const insertOrderStateSchema = createInsertSchema(orderState).omit({
  createdAt: true,
  updatedAt: true,
});

// Bidding system insert schemas
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
  totalJobsCompleted: true,
  averageRating: true,
  onTimeDeliveryRate: true,
  qualityRejectionRate: true,
}).extend({
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
});

export const insertBiddingPartSchema = createInsertSchema(biddingParts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBidSchema = createInsertSchema(bids).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductionImageSchema = createInsertSchema(productionImages).omit({
  id: true,
  createdAt: true,
});

export const insertPackageSchema = createInsertSchema(packages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPackagePartSchema = createInsertSchema(packageParts).omit({
  id: true,
  createdAt: true,
});

export const insertQcEventSchema = createInsertSchema(qcEvents).omit({
  id: true,
  createdAt: true,
});

// ============= TYPES =============

export type InsertLocalUser = z.infer<typeof insertLocalUserSchema>;
export type LocalUser = typeof localUsers.$inferSelect;
// Convenience alias — manche Frontend-Pages nutzen `User` statt `LocalUser`.
export type User = LocalUser;

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

export type InsertOrderFile = z.infer<typeof insertOrderFileSchema>;
export type OrderFile = typeof orderFiles.$inferSelect;

export type InsertOrderQuery = z.infer<typeof insertOrderQuerySchema>;
export type OrderQuery = typeof orderQueries.$inferSelect;

export type InsertOrderState = z.infer<typeof insertOrderStateSchema>;
export type OrderState = typeof orderState.$inferSelect;

export type OrderStatus = "neu_eingegangen" | "in_bearbeitung" | "angebot_erstellt" | "abgeschlossen";
export type UserRole = "admin" | "partner" | "customer" | "supplier" | "qc";

// ============= JOB STATUS — HARMONISIERUNG =============
//
// Entscheidung (Aufgabe 7b): zwei separate Enums + Union als bequeme
// Gesamtmenge.
//
// Begruendung: website (6 Werte) und admin-portal (5 Werte) repraesentieren
// UNTERSCHIEDLICHE Workflows:
//
//   - JobStatus (customer-facing, website + dashboard):
//       new -> estimate -> quoted -> ordered -> in_production -> shipped
//
//   - AdminJobStatus (admin-internal review pipeline, admin-portal):
//       new -> quoted -> admin_review -> ready -> shipped
//
// Eine erzwungene Vereinigung in EINEM Enum wuerde so tun, als ob z.B.
// "admin_review" und "estimate" austauschbar waeren — sie sind es nicht.
// Beide Listen werden als Type beibehalten; Frontends importieren das Enum,
// das zu ihrem Workflow passt. `AnyJobStatus` ist nur die mengentheoretische
// Vereinigung fuer Stellen, die mit beiden Workflows umgehen muessen.
export type JobStatus = "new" | "estimate" | "quoted" | "ordered" | "in_production" | "shipped";
export type AdminJobStatus = "new" | "quoted" | "admin_review" | "ready" | "shipped";
export type AnyJobStatus = JobStatus | AdminJobStatus;

// Bidding system types
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type BiddingPart = typeof biddingParts.$inferSelect;
export type InsertBiddingPart = z.infer<typeof insertBiddingPartSchema>;

export type Bid = typeof bids.$inferSelect;
export type InsertBid = z.infer<typeof insertBidSchema>;

export type ProductionImage = typeof productionImages.$inferSelect;
export type InsertProductionImage = z.infer<typeof insertProductionImageSchema>;

export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;

export type PackagePart = typeof packageParts.$inferSelect;
export type InsertPackagePart = z.infer<typeof insertPackagePartSchema>;

export type QcEvent = typeof qcEvents.$inferSelect;
export type InsertQcEvent = z.infer<typeof insertQcEventSchema>;

// Bidding status types
export type PartBiddingStatus = "pending" | "bidding" | "assigned" | "in_production" | "production_done" | "in_package" | "shipped" | "qc_pending" | "qc_approved" | "qc_rejected" | "delivered" | "completed";
export type BidStatus = "active" | "won" | "lost" | "withdrawn" | "expired";
export type ProductionStatus = "not_started" | "in_progress" | "paused" | "defective" | "completed";
export type PackageStatus = "packing" | "ready" | "shipped" | "in_transit" | "delivered" | "qc_check" | "qc_approved" | "qc_rejected" | "customer_received";
export type QcEventType = "scan_in" | "part_approved" | "part_rejected" | "package_approved" | "package_rejected" | "resend_requested";

// Extended types with relations
export interface BiddingPartWithBids extends BiddingPart {
  bids: Bid[];
  assignedSupplier?: Supplier;
  productionImages?: ProductionImage[];
}

export interface PackageWithParts extends Package {
  parts: PackagePart[];
  supplier: Supplier;
}

export interface BidWithDetails extends Bid {
  supplier: Supplier;
  part: BiddingPart;
}

export interface OrderWithFiles extends Order {
  files: OrderFile[];
  queries: OrderQuery[];
}

// ============= ZOD SCHEMAS (for validation) =============

// Machine Profile Schema - different CNC machines with different capabilities
export const machineProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  hourlyRate: z.number(), // €/h Maschinenstundensatz
  maxSpindleSpeed: z.number(), // 1/min
  maxFeedRate: z.number(), // mm/min
  // Cutting parameters per material type (indexed by material hardness)
  defaultVc: z.number(), // m/min Schnittgeschwindigkeit
  defaultFz: z.number(), // mm/Schneide Vorschub pro Schneide
  setupTime: z.number(), // min Rüstzeit
  toolChangeTime: z.number(), // min pro Werkzeugwechsel
});

export type MachineProfile = z.infer<typeof machineProfileSchema>;

// Company Profile Schema - different manufacturers with different labor costs
export const companyProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  laborHourlyRate: z.number(), // €/h Stundenlohn
  overheadRate: z.number(), // Faktor für Gemeinkosten
  profitMargin: z.number(), // % Gewinnmarge
  qualityLevel: z.enum(['standard', 'precision', 'aerospace']),
});

export type CompanyProfile = z.infer<typeof companyProfileSchema>;

// Material database schema
export const materialSchema = z.object({
  id: z.string(),
  name: z.string(),
  density: z.number(), // g/cm³
  pricePerKg: z.number(), // €/kg
  color: z.string(), // hex color for 3D visualization
  // Material-specific cutting parameters
  cuttingSpeedFactor: z.number().optional(), // Faktor für Vc (1.0 = Aluminium Baseline)
  feedFactor: z.number().optional(), // Faktor für fz
});

export type Material = z.infer<typeof materialSchema>;

// CAD part geometry schema
export const cadPartSchema = z.object({
  filename: z.string(),
  boundingBox: z.object({
    width: z.number(), // mm
    height: z.number(), // mm
    depth: z.number(), // mm
  }),
  volume: z.number(), // cm³
  surfaceArea: z.number(), // cm²
  vertexCount: z.number(),
  faceCount: z.number(),
});

export type CadPart = z.infer<typeof cadPartSchema>;

// Tolerance types for specification
export const toleranceTypeSchema = z.enum([
  'dimensional', // Maßtoleranz (±mm or ISO fit H7, js6, etc.)
  'surface_roughness', // Oberflächenrauheit (Ra values)
  'geometric', // Form- und Lage-Toleranz (GD&T symbols)
]);
export type ToleranceType = z.infer<typeof toleranceTypeSchema>;

// GD&T symbols for geometric tolerances
export const gdtSymbolSchema = z.enum([
  'flatness', // Ebenheit ⏥
  'straightness', // Geradheit ⏤
  'circularity', // Rundheit ○
  'cylindricity', // Zylindrizität ⌭
  'parallelism', // Parallelität ∥
  'perpendicularity', // Rechtwinkligkeit ⊥
  'angularity', // Winkligkeit ∠
  'position', // Position ⊕ (Ortstoleranz)
  'concentricity', // Konzentrizität ◎ (Ortstoleranz)
  'coaxiality', // Koaxialität ◎ (Ortstoleranz)
  'symmetry', // Symmetrie ⌯ (Ortstoleranz)
  'runout', // Rundlauf ↗ (Lauftoleranz, radial)
  'planlauf', // Planlauf ↗ (Lauftoleranz, axial)
  'total_runout', // Gesamtrundlauf ⇗ (Lauftoleranz)
  'total_planlauf', // Gesamtplanlauf ⇗ (Lauftoleranz)
  'profile_line', // Linienprofil ⌒ (Formtoleranz)
  'profile_surface', // Flächenprofil ⌓ (Formtoleranz)
]);
export type GdtSymbol = z.infer<typeof gdtSymbolSchema>;

// Surface roughness standard values (Ra in μm)
export const surfaceRoughnessSchema = z.enum([
  '0.4', '0.8', '1.6', '3.2', '6.3', '12.5', '25',
]);
export type SurfaceRoughness = z.infer<typeof surfaceRoughnessSchema>;

// Surface finishing types (Veredelung)
export const finishingTypeSchema = z.enum([
  'none',                // Keine Veredelung
  'anodizing',           // Eloxieren
  'hard_anodizing',      // Harteloxieren
  'sandblasting',        // Sandstrahlen
  'glass_bead_blasting', // Glasperl-Strahlen
  'powder_coating',      // Pulverbeschichten
  'nickel_plating',      // Vernickeln
  'chrome_plating',      // Verchromen
  'zinc_plating',        // Verzinken
  'passivation',         // Passivieren
  'brushing',            // Bürsten/Schleifen
  'polishing',           // Polieren
  'black_oxide',         // Brünieren
  'heat_treatment',      // Wärmebehandlung
  'case_hardening',      // Einsatzhärten
]);
export type FinishingType = z.infer<typeof finishingTypeSchema>;

// Anodizing color options
export const anodizingColorSchema = z.enum([
  'natural',  // Natur/Silber
  'black',    // Schwarz
  'red',      // Rot
  'blue',     // Blau
  'gold',     // Gold
  'green',    // Grün
]);
export type AnodizingColor = z.infer<typeof anodizingColorSchema>;

// Finishing option with details
//
// Geltungsbereich (scope) der Veredelung:
//   'whole_part'        → ganzes Bauteil wird veredelt (Default, wie bisher).
//   'specific_surfaces' → NUR die in surfaceIds gewählten Flächen werden veredelt ("nur diese").
//   'except_surfaces'   → ALLE Flächen AUSSER den in surfaceIds gewählten werden veredelt ("alles außer").
// In beiden Pick-Fällen ('specific_surfaces' / 'except_surfaces') hält surfaceIds die angeklickten Flächen.
export const finishingOptionSchema = z.object({
  type: finishingTypeSchema,
  color: anodizingColorSchema.optional(),
  thickness: z.number().optional(),
  scope: z.enum(['whole_part', 'specific_surfaces', 'except_surfaces']).optional(),
  surfaceIds: z.array(z.object({
    surfaceId: z.string(),
    surfaceName: z.string(),
    color: z.string().optional(),
  })).optional(),
});

export type FinishingOption = z.infer<typeof finishingOptionSchema>;

// Tolerance specification schema - supports all three types
// Surface geometry for backend mapping (FreeCAD can find surface by position + normal)
export const surfaceGeometrySchema = z.object({
  center: z.tuple([z.number(), z.number(), z.number()]), // [x, y, z] in mm
  normal: z.tuple([z.number(), z.number(), z.number()]), // unit vector [nx, ny, nz]
});
export type SurfaceGeometry = z.infer<typeof surfaceGeometrySchema>;

// Abgeleitete Mittelebene (median plane) für Symmetrie/Parallelität/Rechtwinkligkeit.
// kind='two_faces' → faceIds = die beiden Flächen, point = Mittelpunkt dazwischen, normal =
// Flächen-Normale (Ebene liegt mittig). kind='cylinder' → faceIds = [die Welle/Bohrung],
// axis = Achsrichtung, point = Achsen-Mittelpunkt, normal = gewählte Mittelebenen-Normale
// (eine der beiden ⟂ zur Achse). Alle Koordinaten ZENTRIERT (STEP = Punkt + viewerCenter).
export const gdtMedianPlaneSchema = z.object({
  kind: z.enum(['two_faces', 'cylinder']),
  faceIds: z.array(z.string()),
  point: z.tuple([z.number(), z.number(), z.number()]),
  normal: z.tuple([z.number(), z.number(), z.number()]),
  axis: z.tuple([z.number(), z.number(), z.number()]).optional(),
});
export type GdtMedianPlane = z.infer<typeof gdtMedianPlaneSchema>;

export const toleranceSchema = z.object({
  surfaceId: z.string(),
  surfaceName: z.string(), // e.g., "Top Face", "Side 1" — bei Allgemeintoleranz/Allgemeinrauhigkeit Platzhalter
  type: toleranceTypeSchema,
  color: z.string().optional(), // Hex color for 3D visualization (auto-assigned from palette)

  // Surface geometry for backend traceability (FreeCAD mapping)
  geometry: surfaceGeometrySchema.optional(),

  // Dimensional: Unterteilung Allgemein / ISO-Passung / Freie Toleranz (für Anzeige ohne Farbpunkt)
  isGeneralTolerance: z.boolean().optional(), // Allgemeintoleranz (f/m/c/v) für ganzes Bauteil
  generalToleranceGrade: z.string().optional(), // "f" | "m" | "c" | "v"
  // Surface roughness: allgemein für ganzes Bauteil, keine Flächenauswahl
  isGeneralRoughness: z.boolean().optional(),

  // Dimensional tolerance (type === 'dimensional')
  toleranceValue: z.number().optional(), // ±mm symmetrisch (e.g., 0.01)
  toleranceUpper: z.number().optional(), // Asymmetrisch +X mm oder Grenzmaß Obermaß
  toleranceLower: z.number().optional(), // Asymmetrisch −Y mm oder Grenzmaß Untermaß
  toleranceFormat: z.enum(['symmetric', 'asymmetric', 'limits']).optional(),
  isoFit: z.string().optional(), // ISO fit like H7, js6, g6

  // Surface roughness (type === 'surface_roughness')
  roughnessRa: z.string().optional(), // Ra value in μm

  // Geometric tolerance (type === 'geometric')
  gdtSymbol: gdtSymbolSchema.optional(),
  gdtValue: z.number().optional(), // tolerance zone in mm
  gdtDiameter: z.boolean().optional(), // Ø-Präfix vor dem Wert (zylindrische Toleranzzone, z.B. Geradheit auf Welle/Bohrung)
  // Orientierungs-Bezug als Zusatz-Kästchen rechts im Rahmen (DIN ISO 1101):
  //  - 'parallel'/'perpendicular' (∥ / ⊥) für Geradheit & Linien-/Flächenprofil auf eine Bezugsfläche
  //  - 'normalArrow' (↗) für Rundheit/Zylindrizität = senkrecht zur Oberfläche/Mittellinie
  gdtOrientationRef: z.object({
    kind: z.enum(['parallel', 'perpendicular', 'normalArrow']),
    datumLabel: z.string(),                 // "A", "B", …
    datumSurfaceId: z.string().optional(),  // gewählte Bezugsfläche im 3D-Modell
    datumSurfaceColor: z.string().optional(), // Farbe der Bezugsfläche (für Legende/Hologramm)
  }).optional(),
  // Zonen-Modifier im WERT-Kästchen NACH der Zahl (z.B. "0,05 SZ"):
  //  CZ = Combined Zone, SZ = Separated Zone (Ebenheit/Profil über mehrere Flächen)
  gdtZone: z.enum(['CZ', 'SZ']).optional(),
  // United Feature — ÜBER dem Rahmen (vor J↔K), nur Linien-/Flächenprofil
  gdtUnitedFeature: z.boolean().optional(),
  // „Abgegrenzt" J↔K: Toleranz gilt zwischen zwei Randpunkten J und K (über dem Rahmen).
  // null/undefined => umlaufend (Kreis am Leader). Punkt-Koordinaten kommen aus dem 3D-Picking.
  gdtAllAround: z.boolean().optional(),     // true = umlaufend (Kreissymbol am Leader)
  gdtBetween: z.object({
    fromLabel: z.string().default('J'),
    toLabel: z.string().default('K'),
    fromPoint: z.array(z.number()).optional(), // [x,y,z] auf dem Flächenrand
    toPoint: z.array(z.number()).optional(),
    // Zwischen-Wegpunkte (vom Kunden angeklickte Kantenelemente), die die Route J→K
    // eindeutig festlegen, wenn es mehrere Wege gibt. In Reihenfolge von J nach K.
    waypoints: z.array(z.array(z.number())).optional(),
    // Die GENAU angeklickten Kanten-IDs (J→K). Wie bei umlaufend: damit bleiben exakt
    // die markierten Kanten markiert (kein berechneter Weg) — UI-Highlight + Referenz.
    edgeIds: z.array(z.string()).optional(),
  }).optional(),
  // Geradheit/Linienprofil beziehen sich auf eine LINIE/KANTE statt einer Fläche.
  // surfaceId zeigt auf die Anker-Nachbarfläche; gdtLineEdgeId hält die gewählte Kante
  // (für UI-Highlight, J/K-Einschränkung und spätere kanten-genaue Zeichnungs-Antragung).
  gdtLineEdgeId: z.string().optional(),
  // Einzelner Markierungspunkt (grüner Punkt) auf der Kante: Geradheit bzw. umlaufendes
  // Linienprofil. Identifiziert die gemeinte Kante eindeutig für die Zeichnung. [x,y,z].
  gdtElementPoint: z.array(z.number()).optional(),
  // Umlaufendes (all-around) Linienprofil: die geschlossene Kontur, die der Kunde durch
  // Anklicken einzelner Kanten aufgebaut hat. gdtAllAroundPoints ist die GEORDNETE,
  // geschlossene Polylinie (letzter Punkt ~ erster Punkt) in ZENTRIERTEN Viewer-Koordinaten
  // (STEP = Punkt + viewerCenter); gdtAllAroundEdgeIds die zugehörigen Kanten-IDs (Referenz).
  // => Zeichnung: Umlaufend-Kreis am Leader (statt J/K), Kontur rot in zwei Ansichten.
  gdtAllAroundPoints: z.array(z.array(z.number())).optional(),
  gdtAllAroundEdgeIds: z.array(z.string()).optional(),
  // Geradheit auf MEHREREN gerade aneinander liegenden (kollinearen) Kanten: die geordnete
  // (offene) Polylinie der toleranzierten Linie in ZENTRIERTEN Viewer-Koordinaten (STEP =
  // Punkt + viewerCenter) + zugehörige Kanten-IDs. J/K = die beiden Enden der Linie.
  // => Zeichnung: alle Kanten rot markieren + J/K + Geradheits-Rahmen.
  gdtElementLinePoints: z.array(z.array(z.number())).optional(),
  gdtElementLineEdgeIds: z.array(z.string()).optional(),

  // ── Abgeleitete MITTELEBENE / Mittellinie (median plane) ──
  // Für Symmetrie/Parallelität/Rechtwinkligkeit: das tolerierte Element bzw. der Bezug ist
  // KEINE reale Fläche, sondern eine abgeleitete Mittelebene. Sie entsteht entweder aus ZWEI
  // (parallelen) Flächen — dann liegt die Mittelebene mittig dazwischen — ODER aus EINER
  // Welle/Bohrung, die zwei Mittelebenen hat (eine davon wird gewählt). Alle Koordinaten in
  // ZENTRIERTEN Viewer-Koords (STEP = Punkt + viewerCenter), Normale als Einheitsvektor.
  // gdtMedianPlane = toleriertes Element, gdtDatumMedianPlane = Bezugs-Mittelebene (Buchstabe
  // kommt zusätzlich über datumSurfaces/datumSurfaceName). => Zeichnung (Phase 2): rote
  // Strichpunkt-Mittellinie + Rahmen-Leader darauf + Bemaßungs-Hilfslinien parallel zur Ebene.
  gdtMedianPlane: gdtMedianPlaneSchema.optional(),
  gdtDatumMedianPlane: gdtMedianPlaneSchema.optional(),
  datumSurfaceId: z.string().optional(), // Reference surface (Bezugsfläche A)
  datumSurfaceName: z.string().optional(), // Name of datum surface
  datumSurfaceColor: z.string().optional(), // Hex color for datum in 3D (same as surface if reused)
  // Multiple tolerated surfaces (Bezugsfläche + mehrere tolerierte Flächen)
  toleratedSurfaces: z.array(z.object({
    surfaceId: z.string(),
    surfaceName: z.string(),
    color: z.string().optional(),
  })).optional(),

  // ── Bohrungsabstand (Mittelpunktabstand zweier Bohrungen) ──
  // Eigene dimensional-Variante: der Nutzer wählt ZWEI zylindrische Flächen (Bohrungen);
  // Nennmaß = 3D-Abstand der beiden Achsen-/Flächen-Mittelpunkte. Zusätzlich ±-Toleranz.
  // Ist holeDistance gesetzt, ist diese dimensional-Toleranz ein Bohrungsabstand
  // (type bleibt 'dimensional'). centerA/centerB sind in ZENTRIERTEN Viewer-Koordinaten
  // (STEP = Punkt + viewerCenter, identisch zu J/K). nominalMm wird automatisch aus den
  // Mittelpunkten berechnet, plusMinusMm gibt der Nutzer ein.
  // => Zeichnung später: „50±0.03" mit Maßlinie zwischen den zwei Bohrungs-Mittelpunkten.
  holeDistance: z.object({
    faceA: z.string(),                                  // Face-ID Bohrung A
    faceB: z.string(),                                  // Face-ID Bohrung B
    centerA: z.tuple([z.number(), z.number(), z.number()]), // [x,y,z] Mittelpunkt A (zentriert)
    centerB: z.tuple([z.number(), z.number(), z.number()]), // [x,y,z] Mittelpunkt B (zentriert)
    nominalMm: z.number(),                              // automatisch berechneter Nennabstand
    plusMinusMm: z.number(),                            // ±-Toleranz (z.B. 0.03)
  }).optional(),
});

export type Tolerance = z.infer<typeof toleranceSchema>;

// Manufacturing risk types and severity levels
export const manufacturingRiskSeveritySchema = z.enum(['critical', 'warning', 'info']);
export type ManufacturingRiskSeverity = z.infer<typeof manufacturingRiskSeveritySchema>;

export const manufacturingRiskTypeSchema = z.enum([
  'sharp_corner',      // Scharfe Innenecken/Kanten
  'thin_wall',         // Dünne Wände
  'deep_pocket',       // Tiefe Taschen mit kleinem Radius
  'small_radius',      // Kleine Innenradien
  'undercut',          // Unterschnitte (3-Achs nicht erreichbar)
  'fine_detail',       // Sehr feine Details
]);
export type ManufacturingRiskType = z.infer<typeof manufacturingRiskTypeSchema>;

// Marker types for different geometry features
export const markerTypeSchema = z.enum(['point', 'edge', 'face']);
export type MarkerType = z.infer<typeof markerTypeSchema>;

export const manufacturingRiskSchema = z.object({
  id: z.string(),
  type: manufacturingRiskTypeSchema,
  severity: manufacturingRiskSeveritySchema,
  title: z.string(),
  description: z.string(),
  recommendation: z.string(),
  estimatedSavings: z.number(), // € Einsparung wenn behoben
  savingsPercent: z.number().optional(), // % vom Gesamtpreis
  costDriver: z.string().optional(), // Warum so teuer
  resolutionSteps: z.array(z.string()).optional(), // Detaillierte Lösung
  markerType: markerTypeSchema.optional(), // point=Ecke, edge=Kante, face=Fläche
  location: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  // Edge marker: start and end points
  edgeEnd: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }).optional(),
  affectedFaceIndices: z.array(z.number()).optional(),
});

export type ManufacturingRisk = z.infer<typeof manufacturingRiskSchema>;

// Tool schema for machining strategy
export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['end_mill', 'ball_nose', 'drill', 'face_mill']),
  diameter: z.number(),
  numberOfFlutes: z.number(),
  maxDepthOfCut: z.number(),
  feedRate: z.number(),
  spindleSpeed: z.number(),
  roughing: z.boolean(),
  finishing: z.boolean(),
  toolChangeTime: z.number(),
});

export type Tool = z.infer<typeof toolSchema>;

// Toolpath keyframe for animation
export const toolPathFrameSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  cutting: z.boolean(), // true when cutting, false when moving
});

export type ToolPathFrame = z.infer<typeof toolPathFrameSchema>;

// Machining operation schema
export const machiningOperationSchema = z.object({
  id: z.string(),
  name: z.string(),
  tool: toolSchema,
  operationType: z.enum(['roughing', 'semi_finishing', 'finishing', 'drilling', 'contouring']),
  estimatedTime: z.number(),
  toolPath: z.number(),
  depthOfCut: z.number(),
  numberOfPasses: z.number(),
  description: z.string(),
  toolPathFrames: z.array(toolPathFrameSchema).optional(), // Simplified path for animation
});

export type MachiningOperation = z.infer<typeof machiningOperationSchema>;

// Machining strategy schema
export const machiningStrategySchema = z.object({
  operations: z.array(machiningOperationSchema),
  totalToolChanges: z.number(),
  totalToolPath: z.number(),
  totalMachiningTime: z.number(),
  toolsUsed: z.array(toolSchema),
  strategyDescription: z.string(),
});

export type MachiningStrategy = z.infer<typeof machiningStrategySchema>;

// Price calculation request schema
export const priceCalculationRequestSchema = z.object({
  materialId: z.string(),
  quantity: z.number().min(1),
  boundingBox: z.object({
    width: z.number(),
    height: z.number(),
    depth: z.number(),
  }),
  volume: z.number(),
  surfaceArea: z.number(),
  tolerances: z.array(toleranceSchema).optional(),
  finishing: finishingOptionSchema.optional(), // Surface finishing (Veredelung)
  cadPart: cadPartSchema, // Full CAD part for machining strategy
  machineProfileId: z.string().optional(), // Expert mode: selected machine
  companyProfileId: z.string().optional(), // Expert mode: selected company
});

export type PriceCalculationRequest = z.infer<typeof priceCalculationRequestSchema>;

// Detailed cost breakdown for expert mode
export const expertCostBreakdownSchema = z.object({
  // 1. Materialkosten
  materialCost: z.object({
    blockVolumeCm3: z.number(),
    blockWeightKg: z.number(),
    materialPricePerKg: z.number(),
    totalCost: z.number(),
    formula: z.string(),
  }),

  // 2. Fertigungspreis (Maschinenkosten)
  fabricationCost: z.object({
    setupTimeMin: z.number(), // Rüstzeit
    mainTimeMin: z.number(), // Hauptzeit H
    secondaryTimeMin: z.number(), // Nebenzeit (Werkzeugwechsel etc)
    totalTimeMin: z.number(),
    totalTimeHours: z.number(),
    machineHourlyRate: z.number(),
    totalCost: z.number(),
    formula: z.string(),
    // Hauptzeit-Berechnung details
    mainTimeCalculation: z.object({
      totalToolPathMm: z.number(), // L - Fräsweglänge
      avgFeedRateMmMin: z.number(), // Vf - Vorschubgeschwindigkeit
      avgCuttingSpeedMMin: z.number(), // Vc - Schnittgeschwindigkeit
      avgFeedPerToothMm: z.number(), // fz - Vorschub pro Schneide
      avgNumberOfFlutes: z.number(), // z - Anzahl Schneiden
      avgSpindleSpeedRpm: z.number(), // n - Drehzahl
      avgToolDiameterMm: z.number(), // d - Fräserdurchmesser
      formula: z.string(),
    }),
  }),

  // 3. Lohnkosten
  laborCost: z.object({
    laborTimeHours: z.number(), // Arbeitszeit
    laborHourlyRate: z.number(), // Stundenlohn
    totalCost: z.number(),
    formula: z.string(),
  }),

  // 4. Gewinnmarge
  profitMargin: z.object({
    marginPercent: z.number(),
    baseCost: z.number(),
    marginAmount: z.number(),
    formula: z.string(),
  }),

  // Gesamtkosten
  totalCostPerPart: z.number(),
  totalCostAllParts: z.number(),

  // Verwendete Profile
  machineProfile: machineProfileSchema.optional(),
  companyProfile: companyProfileSchema.optional(),
});

export type ExpertCostBreakdown = z.infer<typeof expertCostBreakdownSchema>;

// Price calculation result schema
export const priceCalculationResultSchema = z.object({
  // Raw material costs
  blockVolume: z.number(), // cm³
  blockWeight: z.number(), // kg
  materialCostPerPart: z.number(), // €

  // Manufacturing costs
  volumeToRemove: z.number(), // cm³
  estimatedMachiningTime: z.number(), // hours
  machiningCostPerPart: z.number(), // €

  // Finishing costs (Veredelung)
  finishingCostPerPart: z.number().optional(), // €
  finishingDescription: z.string().optional(), // e.g., "Eloxieren Schwarz"

  // Part properties
  partWeight: z.number(), // kg
  partVolume: z.number(), // cm³

  // Shipping costs (based on total weight)
  totalWeight: z.number(), // kg (partWeight × quantity)
  shippingCost: z.number(), // €

  // Margins and totals
  subtotalPerPart: z.number(), // €
  margin1: z.number(), // € (50% for company 1)
  margin2: z.number(), // € (50% for company 2)
  totalPricePerPart: z.number(), // €
  totalPrice: z.number(), // € (for all parts)

  // Machining strategy
  machiningStrategy: machiningStrategySchema,

  // Manufacturing risks - problematic features
  manufacturingRisks: z.array(manufacturingRiskSchema).optional(),
  potentialSavings: z.number().optional(), // Total potential savings if all risks resolved

  // Formula details for backend view (simple)
  formulas: z.object({
    blockVolume: z.string(),
    materialCost: z.string(),
    volumeToRemove: z.string(),
    machiningTime: z.string(),
    machiningCost: z.string(),
    shipping: z.string(),
    margins: z.string(),
    total: z.string(),
  }),

  // Expert mode: detailed breakdown
  expertBreakdown: expertCostBreakdownSchema.optional(),
});

export type PriceCalculationResult = z.infer<typeof priceCalculationResultSchema>;

// Complete calculation response (includes all data)
export const calculationResponseSchema = z.object({
  material: materialSchema,
  part: cadPartSchema,
  calculation: priceCalculationResultSchema,
  quantity: z.number(),
});

export type CalculationResponse = z.infer<typeof calculationResponseSchema>;
