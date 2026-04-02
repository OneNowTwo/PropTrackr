import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const propertyStatusEnum = pgEnum("property_status", [
  "saved",
  "inspecting",
  "shortlisted",
  "passed",
]);

export const discoveredPropertyStatusEnum = pgEnum("discovered_property_status", [
  "pending",
  "saved",
  "maybe",
  "not_interested",
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

export const searchPreferences = pgTable("search_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  suburbs: text("suburbs").array().notNull(),
  minPrice: integer("min_price"),
  maxPrice: integer("max_price"),
  propertyTypes: text("property_types").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const suburbAgencyUrls = pgTable(
  "suburb_agency_urls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    suburb: text("suburb").notNull(),
    agencyName: text("agency_name").notNull(),
    agencyUrl: text("agency_url").notNull(),
    lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userSuburbUrlUnique: uniqueIndex("suburb_agency_urls_user_suburb_url").on(
      t.userId,
      t.suburb,
      t.agencyUrl,
    ),
  }),
);

export const discoveredProperties = pgTable(
  "discovered_properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    address: text("address").notNull(),
    suburb: text("suburb").notNull(),
    state: text("state").notNull().default(""),
    postcode: text("postcode").notNull().default(""),
    price: integer("price"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    parkingSpaces: integer("parking_spaces"),
    propertyType: text("property_type"),
    imageUrl: text("image_url"),
    imageUrls: text("image_urls").array(),
    listingUrl: text("listing_url").notNull(),
    notes: text("notes").notNull().default(""),
    agentName: text("agent_name"),
    agencyName: text("agency_name"),
    status: discoveredPropertyStatusEnum("status").notNull().default("pending"),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userListingUnique: uniqueIndex("discovered_properties_user_listing_url").on(
      t.userId,
      t.listingUrl,
    ),
  }),
);

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  agencyName: text("agency_name"),
  photoUrl: text("photo_url"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  address: text("address").notNull(),
  suburb: text("suburb").notNull(),
  state: text("state").notNull().default(""),
  postcode: text("postcode").notNull().default(""),
  price: integer("price"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  parking: integer("parking"),
  landSize: integer("land_size"),
  propertyType: text("property_type"),
  status: propertyStatusEnum("status").notNull().default("saved"),
  listingUrl: text("listing_url"),
  imageUrl: text("image_url"),
  /** Additional listing photos (hero stays in imageUrl); up to 7 extras in normal use. */
  imageUrls: text("image_urls").array(),
  sourceSite: text("source_site"),
  notes: text("notes"),
  agentName: text("agent_name"),
  agencyName: text("agency_name"),
  agentPhotoUrl: text("agent_photo_url"),
  agentEmail: text("agent_email"),
  agentPhone: text("agent_phone"),
  /** YYYY-MM-DD when an auction is scheduled (from listing extract or manual). */
  auctionDate: text("auction_date"),
  auctionTime: text("auction_time"),
  auctionVenue: text("auction_venue"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const agentChecklistItems = pgTable("agent_checklist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  content: text("content").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
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
  notes: text("notes"),
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
  /** When set, file is streamed from Gmail via API using these ids. */
  gmailMessageId: text("gmail_message_id"),
  gmailAttachmentId: text("gmail_attachment_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const gmailConnections = pgTable(
  "gmail_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    gmailEmail: text("gmail_email").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    tokenExpiry: timestamp("token_expiry", { withTimezone: true }).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const propertyEmails = pgTable("property_emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  gmailMessageId: text("gmail_message_id").notNull().unique(),
  threadId: text("thread_id").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  subject: text("subject").notNull(),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  isRead: boolean("is_read").notNull().default(false),
  aiSummary: text("ai_summary"),
  actionItems: text("action_items").array(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  properties: many(properties),
  agents: many(agents),
  inspections: many(inspections),
  propertyNotes: many(propertyNotes),
  voiceNotes: many(voiceNotes),
  comparisons: many(comparisons),
  documents: many(documents),
  agentChecklistItems: many(agentChecklistItems),
  searchPreferences: one(searchPreferences, {
    fields: [users.id],
    references: [searchPreferences.userId],
  }),
  discoveredProperties: many(discoveredProperties),
  suburbAgencyUrls: many(suburbAgencyUrls),
  gmailConnection: one(gmailConnections, {
    fields: [users.id],
    references: [gmailConnections.userId],
  }),
  propertyEmails: many(propertyEmails),
}));

export const suburbAgencyUrlsRelations = relations(
  suburbAgencyUrls,
  ({ one }) => ({
    user: one(users, {
      fields: [suburbAgencyUrls.userId],
      references: [users.id],
    }),
  }),
);

export const searchPreferencesRelations = relations(
  searchPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [searchPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const discoveredPropertiesRelations = relations(
  discoveredProperties,
  ({ one }) => ({
    user: one(users, {
      fields: [discoveredProperties.userId],
      references: [users.id],
    }),
  }),
);

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  properties: many(properties),
  checklistItems: many(agentChecklistItems),
  propertyEmails: many(propertyEmails),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  user: one(users, {
    fields: [properties.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [properties.agentId],
    references: [agents.id],
  }),
  inspections: many(inspections),
  propertyNotes: many(propertyNotes),
  voiceNotes: many(voiceNotes),
  documents: many(documents),
  propertyEmails: many(propertyEmails),
}));

export const agentChecklistItemsRelations = relations(
  agentChecklistItems,
  ({ one }) => ({
    agent: one(agents, {
      fields: [agentChecklistItems.agentId],
      references: [agents.id],
    }),
    user: one(users, {
      fields: [agentChecklistItems.userId],
      references: [users.id],
    }),
    property: one(properties, {
      fields: [agentChecklistItems.propertyId],
      references: [properties.id],
    }),
  }),
);

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

export const gmailConnectionsRelations = relations(
  gmailConnections,
  ({ one }) => ({
    user: one(users, {
      fields: [gmailConnections.userId],
      references: [users.id],
    }),
  }),
);

export const propertyEmailsRelations = relations(propertyEmails, ({ one }) => ({
  user: one(users, {
    fields: [propertyEmails.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [propertyEmails.propertyId],
    references: [properties.id],
  }),
  agent: one(agents, {
    fields: [propertyEmails.agentId],
    references: [agents.id],
  }),
}));
