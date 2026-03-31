import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const propertyStatusEnum = pgEnum("property_status", [
  "saved",
  "inspecting",
  "shortlisted",
  "passed",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  address: text("address").notNull(),
  suburb: text("suburb").notNull(),
  state: text("state").notNull(),
  postcode: text("postcode").notNull(),
  price: integer("price"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  parking: integer("parking"),
  landSize: integer("land_size"),
  propertyType: text("property_type"),
  status: propertyStatusEnum("status").notNull().default("saved"),
  listingUrl: text("listing_url"),
  sourceSite: text("source_site"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const inspections = pgTable("inspections", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  inspectionDate: timestamp("inspection_date", {
    withTimezone: true,
  }).notNull(),
  inspectionTime: text("inspection_time").notNull(),
  durationMinutes: integer("duration_minutes"),
  attended: boolean("attended").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const propertyNotes = pgTable("property_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const voiceNotes = pgTable("voice_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  audioUrl: text("audio_url").notNull(),
  transcript: text("transcript"),
  aiSummary: text("ai_summary"),
  pros: text("pros").array(),
  cons: text("cons").array(),
  questions: text("questions").array(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const comparisons = pgTable("comparisons", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  propertyAId: uuid("property_a_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  propertyBId: uuid("property_b_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  properties: many(properties),
  inspections: many(inspections),
  propertyNotes: many(propertyNotes),
  voiceNotes: many(voiceNotes),
  comparisons: many(comparisons),
  documents: many(documents),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  user: one(users, {
    fields: [properties.userId],
    references: [users.id],
  }),
  inspections: many(inspections),
  propertyNotes: many(propertyNotes),
  voiceNotes: many(voiceNotes),
  documents: many(documents),
}));

export const inspectionsRelations = relations(inspections, ({ one }) => ({
  property: one(properties, {
    fields: [inspections.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [inspections.userId],
    references: [users.id],
  }),
}));

export const propertyNotesRelations = relations(propertyNotes, ({ one }) => ({
  property: one(properties, {
    fields: [propertyNotes.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [propertyNotes.userId],
    references: [users.id],
  }),
}));

export const voiceNotesRelations = relations(voiceNotes, ({ one }) => ({
  property: one(properties, {
    fields: [voiceNotes.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [voiceNotes.userId],
    references: [users.id],
  }),
}));

export const comparisonsRelations = relations(comparisons, ({ one }) => ({
  user: one(users, {
    fields: [comparisons.userId],
    references: [users.id],
  }),
  propertyA: one(properties, {
    fields: [comparisons.propertyAId],
    references: [properties.id],
  }),
  propertyB: one(properties, {
    fields: [comparisons.propertyBId],
    references: [properties.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  property: one(properties, {
    fields: [documents.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));
