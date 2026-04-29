import { eq, and, lt, desc } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import {
  createInventoryItem,
  type InventoryItem,
  type InventoryReservation,
  type InventoryLedgerEntry,
} from "../domain/entities.ts";

type Db = ReturnType<typeof getDb>;

export type InventoryItemView = {
  id: string;
  skuId: string;
  physicalStock: number;
  reservedStock: number;
  adjustedStock: number;
  availableStock: number;
  updatedAt: Date;
  sku: string | null;
  variantLabel: string | null;
  productName: string | null;
};

export function asDb(tx: unknown): Db {
  return tx as Db;
}

export async function findAllInventoryItems(db: Db = getDb()): Promise<InventoryItemView[]> {
  const rows = await db
    .select({
      id: s.inventoryItems.id,
      skuId: s.inventoryItems.skuId,
      physicalStock: s.inventoryItems.physicalStock,
      reservedStock: s.inventoryItems.reservedStock,
      adjustedStock: s.inventoryItems.adjustedStock,
      updatedAt: s.inventoryItems.updatedAt,
      sku: s.skus.sku,
      variantLabel: s.skus.variantLabel,
      productName: s.products.name,
    })
    .from(s.inventoryItems)
    .leftJoin(s.skus, eq(s.inventoryItems.skuId, s.skus.id))
    .leftJoin(s.products, eq(s.skus.productId, s.products.id));

  return rows.map((r) => ({
    ...r,
    availableStock: r.physicalStock - r.reservedStock + r.adjustedStock,
  }));
}

export async function findInventoryBySkuId(skuId: string, db: Db = getDb()): Promise<InventoryItem | null> {
  const rows = await db.select().from(s.inventoryItems).where(eq(s.inventoryItems.skuId, skuId));
  return rows[0] ?? null;
}

export async function findInventoryBySkuIdForUpdate(skuId: string, db: Db): Promise<InventoryItem | null> {
  const rows = await db.select().from(s.inventoryItems).where(eq(s.inventoryItems.skuId, skuId)).for("update");
  return rows[0] ?? null;
}

export async function ensureInventoryItem(skuId: string, db: Db): Promise<InventoryItem> {
  const existing = await db.select().from(s.inventoryItems).where(eq(s.inventoryItems.skuId, skuId)).for("update");
  if (existing[0]) return existing[0];
  const item = createInventoryItem({ skuId });
  await db.insert(s.inventoryItems).values({
    id: item.id,
    skuId: item.skuId,
    physicalStock: item.physicalStock,
    reservedStock: item.reservedStock,
    adjustedStock: item.adjustedStock,
    updatedAt: item.updatedAt,
  });
  return item;
}

export async function saveInventoryItem(item: InventoryItem, db: Db = getDb()): Promise<void> {
  await db.update(s.inventoryItems).set({
    physicalStock: item.physicalStock,
    reservedStock: item.reservedStock,
    adjustedStock: item.adjustedStock,
    updatedAt: new Date(),
  }).where(eq(s.inventoryItems.id, item.id));
}

export async function saveLedgerEntry(entry: InventoryLedgerEntry, db: Db = getDb()): Promise<void> {
  await db.insert(s.inventoryLedger).values({
    id: entry.id,
    skuId: entry.skuId,
    delta: entry.delta,
    reason: entry.reason,
    referenceId: entry.referenceId,
    actorId: entry.actorId,
  });
}

export async function findLedgerBySkuId(skuId: string, db: Db = getDb()) {
  return db.select().from(s.inventoryLedger).where(eq(s.inventoryLedger.skuId, skuId)).orderBy(desc(s.inventoryLedger.createdAt));
}

export async function saveReservation(reservation: InventoryReservation, db: Db = getDb()): Promise<void> {
  await db.insert(s.inventoryReservations).values({
    id: reservation.id,
    skuId: reservation.skuId,
    quantity: reservation.quantity,
    status: reservation.status,
    checkoutSessionId: reservation.checkoutSessionId,
    expiresAt: reservation.expiresAt,
  });
}

export async function updateReservationStatus(reservation: InventoryReservation, db: Db = getDb()): Promise<void> {
  await db.update(s.inventoryReservations).set({ status: reservation.status }).where(eq(s.inventoryReservations.id, reservation.id));
}

export async function findReservationById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(s.inventoryReservations).where(eq(s.inventoryReservations.id, id));
  return rows[0] ?? null;
}

export async function findExpiredReservations(db: Db = getDb()) {
  return db.select().from(s.inventoryReservations)
    .where(and(eq(s.inventoryReservations.status, "active"), lt(s.inventoryReservations.expiresAt, new Date())));
}

export async function findReservationsByCheckoutSession(checkoutSessionId: string, db: Db = getDb()) {
  return db.select().from(s.inventoryReservations)
    .where(eq(s.inventoryReservations.checkoutSessionId, checkoutSessionId));
}

export async function findLedgerHistory(skuId: string, db: Db = getDb()) {
  return db.select().from(s.inventoryLedger).where(eq(s.inventoryLedger.skuId, skuId)).orderBy(desc(s.inventoryLedger.createdAt)).limit(50);
}
