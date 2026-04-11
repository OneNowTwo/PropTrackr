import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { agents, properties, propertySaleResults, users } from "@/lib/db/schema";

import { isValidPropertyId } from "./queries";

export type SaleResultWithAgent = typeof propertySaleResults.$inferSelect & {
  agentName: string | null;
};

export async function fetchSaleResultsForUser(
  dbUserId: string,
): Promise<SaleResultWithAgent[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: propertySaleResults.id,
      propertyId: propertySaleResults.propertyId,
      userId: propertySaleResults.userId,
      address: propertySaleResults.address,
      suburb: propertySaleResults.suburb,
      postcode: propertySaleResults.postcode,
      propertyType: propertySaleResults.propertyType,
      bedrooms: propertySaleResults.bedrooms,
      salePrice: propertySaleResults.salePrice,
      saleDate: propertySaleResults.saleDate,
      saleType: propertySaleResults.saleType,
      reservePrice: propertySaleResults.reservePrice,
      passedIn: propertySaleResults.passedIn,
      daysOnMarket: propertySaleResults.daysOnMarket,
      agentId: propertySaleResults.agentId,
      notes: propertySaleResults.notes,
      source: propertySaleResults.source,
      createdAt: propertySaleResults.createdAt,
      agentName: agents.name,
    })
    .from(propertySaleResults)
    .leftJoin(agents, eq(propertySaleResults.agentId, agents.id))
    .where(eq(propertySaleResults.userId, dbUserId))
    .orderBy(desc(propertySaleResults.saleDate), desc(propertySaleResults.createdAt));

  return rows.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    userId: r.userId,
    address: r.address,
    suburb: r.suburb,
    postcode: r.postcode,
    propertyType: r.propertyType,
    bedrooms: r.bedrooms,
    salePrice: r.salePrice,
    saleDate: r.saleDate,
    saleType: r.saleType,
    reservePrice: r.reservePrice,
    passedIn: r.passedIn,
    daysOnMarket: r.daysOnMarket,
    agentId: r.agentId,
    notes: r.notes,
    source: r.source,
    createdAt: r.createdAt,
    agentName: r.agentName,
  }));
}

export async function fetchSaleResultsForSuburb(
  dbUserId: string,
  suburb: string,
  postcode: string,
): Promise<SaleResultWithAgent[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: propertySaleResults.id,
      propertyId: propertySaleResults.propertyId,
      userId: propertySaleResults.userId,
      address: propertySaleResults.address,
      suburb: propertySaleResults.suburb,
      postcode: propertySaleResults.postcode,
      propertyType: propertySaleResults.propertyType,
      bedrooms: propertySaleResults.bedrooms,
      salePrice: propertySaleResults.salePrice,
      saleDate: propertySaleResults.saleDate,
      saleType: propertySaleResults.saleType,
      reservePrice: propertySaleResults.reservePrice,
      passedIn: propertySaleResults.passedIn,
      daysOnMarket: propertySaleResults.daysOnMarket,
      agentId: propertySaleResults.agentId,
      notes: propertySaleResults.notes,
      source: propertySaleResults.source,
      createdAt: propertySaleResults.createdAt,
      agentName: agents.name,
    })
    .from(propertySaleResults)
    .leftJoin(agents, eq(propertySaleResults.agentId, agents.id))
    .where(
      and(
        eq(propertySaleResults.userId, dbUserId),
        eq(propertySaleResults.suburb, suburb),
        eq(propertySaleResults.postcode, postcode),
      ),
    )
    .orderBy(desc(propertySaleResults.saleDate), desc(propertySaleResults.createdAt));

  return rows.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    userId: r.userId,
    address: r.address,
    suburb: r.suburb,
    postcode: r.postcode,
    propertyType: r.propertyType,
    bedrooms: r.bedrooms,
    salePrice: r.salePrice,
    saleDate: r.saleDate,
    saleType: r.saleType,
    reservePrice: r.reservePrice,
    passedIn: r.passedIn,
    daysOnMarket: r.daysOnMarket,
    agentId: r.agentId,
    notes: r.notes,
    source: r.source,
    createdAt: r.createdAt,
    agentName: r.agentName,
  }));
}

export async function fetchSaleResultsForProperty(
  dbUserId: string,
  propertyId: string,
): Promise<SaleResultWithAgent[]> {
  if (!isValidPropertyId(propertyId)) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: propertySaleResults.id,
      propertyId: propertySaleResults.propertyId,
      userId: propertySaleResults.userId,
      address: propertySaleResults.address,
      suburb: propertySaleResults.suburb,
      postcode: propertySaleResults.postcode,
      propertyType: propertySaleResults.propertyType,
      bedrooms: propertySaleResults.bedrooms,
      salePrice: propertySaleResults.salePrice,
      saleDate: propertySaleResults.saleDate,
      saleType: propertySaleResults.saleType,
      reservePrice: propertySaleResults.reservePrice,
      passedIn: propertySaleResults.passedIn,
      daysOnMarket: propertySaleResults.daysOnMarket,
      agentId: propertySaleResults.agentId,
      notes: propertySaleResults.notes,
      source: propertySaleResults.source,
      createdAt: propertySaleResults.createdAt,
      agentName: agents.name,
    })
    .from(propertySaleResults)
    .leftJoin(agents, eq(propertySaleResults.agentId, agents.id))
    .where(
      and(
        eq(propertySaleResults.userId, dbUserId),
        eq(propertySaleResults.propertyId, propertyId),
      ),
    )
    .orderBy(desc(propertySaleResults.saleDate), desc(propertySaleResults.createdAt));

  return rows.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    userId: r.userId,
    address: r.address,
    suburb: r.suburb,
    postcode: r.postcode,
    propertyType: r.propertyType,
    bedrooms: r.bedrooms,
    salePrice: r.salePrice,
    saleDate: r.saleDate,
    saleType: r.saleType,
    reservePrice: r.reservePrice,
    passedIn: r.passedIn,
    daysOnMarket: r.daysOnMarket,
    agentId: r.agentId,
    notes: r.notes,
    source: r.source,
    createdAt: r.createdAt,
    agentName: r.agentName,
  }));
}

export async function assertPropertyOwnedByUser(
  propertyId: string,
  dbUserId: string,
): Promise<boolean> {
  if (!isValidPropertyId(propertyId)) return false;
  const db = getDb();
  const [p] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.userId, dbUserId)))
    .limit(1);
  return !!p;
}

export async function assertAgentOwnedByUser(
  agentId: string,
  dbUserId: string,
): Promise<boolean> {
  if (!isValidPropertyId(agentId)) return false;
  const db = getDb();
  const [a] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, dbUserId)))
    .limit(1);
  return !!a;
}
