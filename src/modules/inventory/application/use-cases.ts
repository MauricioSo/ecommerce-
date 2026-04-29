import { eq } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import {
  findInventoryBySkuIdForUpdate,
  ensureInventoryItem,
  saveInventoryItem,
  saveLedgerEntry,
  saveReservation,
  updateReservationStatus,
  findReservationById,
  findExpiredReservations,
  findAllInventoryItems,
  findLedgerHistory,
  findReservationsByCheckoutSession,
  asDb,
  type InventoryItemView,
} from "../infrastructure/repository.ts";
import {
  type InventoryItem,
  type InventoryReservation,
  reserveStock,
  confirmReservation,
  releaseReservation,
  expireReservation,
  adjustStock,
  createReservation,
  transitionReservation,
  getAvailableStock,
} from "../domain/entities.ts";
import { type ReservationStatus, ReservationStatus as RS } from "../domain/types.ts";

export type { InventoryItemView };

export async function getInventoryList(): Promise<InventoryItemView[]> {
  return findAllInventoryItems();
}

export async function getInventoryLedger(skuId: string) {
  return findLedgerHistory(skuId);
}

export async function reserveStockUseCase(input: {
  skuId: string;
  quantity: number;
  checkoutSessionId?: string;
  ttlMinutes?: number;
}): Promise<{ reservation: InventoryReservation; availableAfter: number }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const t = asDb(tx);
    const item = await ensureInventoryItem(input.skuId, t);
    const reservation = createReservation({
      skuId: input.skuId,
      quantity: input.quantity,
      checkoutSessionId: input.checkoutSessionId,
      ttlMinutes: input.ttlMinutes,
    });
    const { item: updated, ledger } = reserveStock(item, input.quantity);
    await saveInventoryItem(updated, t);
    await saveLedgerEntry(ledger, t);
    await saveReservation(reservation, t);
    return { reservation, availableAfter: getAvailableStock(updated) };
  });
}

export async function confirmReservationUseCase(reservationId: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const t = asDb(tx);
    const row = await findReservationById(reservationId, t);
    if (!row) throw new Error(`Reservation ${reservationId} not found`);
    const reservation: InventoryReservation = { ...row, status: row.status as ReservationStatus };
    const item = await findInventoryBySkuIdForUpdate(reservation.skuId, t);
    if (!item) throw new Error(`Inventory for SKU ${reservation.skuId} not found`);
    const confirmed = transitionReservation(reservation, RS.CONFIRMED);
    const { item: updated, ledger } = confirmReservation(item, confirmed);
    await saveInventoryItem(updated, t);
    await saveLedgerEntry(ledger, t);
    await updateReservationStatus(confirmed, t);
  });
}

export async function releaseReservationUseCase(reservationId: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const t = asDb(tx);
    const row = await findReservationById(reservationId, t);
    if (!row) throw new Error(`Reservation ${reservationId} not found`);
    const reservation: InventoryReservation = { ...row, status: row.status as ReservationStatus };
    const item = await findInventoryBySkuIdForUpdate(reservation.skuId, t);
    if (!item) throw new Error(`Inventory for SKU ${reservation.skuId} not found`);
    const released = transitionReservation(reservation, RS.RELEASED);
    const { item: updated, ledger } = releaseReservation(item, released);
    await saveInventoryItem(updated, t);
    await saveLedgerEntry(ledger, t);
    await updateReservationStatus(released, t);
  });
}

export async function adjustStockUseCase(input: {
  skuId: string;
  delta: number;
  actorId?: string;
  correlationId?: string;
}): Promise<InventoryItem> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const t = asDb(tx);
    const item = await ensureInventoryItem(input.skuId, t);
    const { item: updated, ledger } = adjustStock(item, input.delta, input.actorId);
    await saveInventoryItem(updated, t);
    await saveLedgerEntry(ledger, t);
    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "inventory",
      aggregateId: input.skuId,
      eventType: `stock_adjusted_delta_${input.delta}`,
      payload: { delta: input.delta, availableAfter: getAvailableStock(updated), actorId: input.actorId ?? null },
      actorId: input.actorId ?? null,
      correlationId: input.correlationId ?? null,
    });
    return updated;
  });
}

export async function expireReservationsJob(): Promise<number> {
  const db = getDb();
  const expired = await findExpiredReservations(db);
  let count = 0;
  for (const row of expired) {
    try {
      await db.transaction(async (tx) => {
        const t = asDb(tx);
        const reservation: InventoryReservation = { ...row, status: row.status as ReservationStatus };
        const item = await findInventoryBySkuIdForUpdate(reservation.skuId, t);
        if (!item) return;
        const expired_r = transitionReservation(reservation, RS.EXPIRED);
        const { item: updated, ledger } = expireReservation(item, expired_r);
        await saveInventoryItem(updated, t);
        await saveLedgerEntry(ledger, t);
        await updateReservationStatus(expired_r, t);
      });
      count++;
    } catch {
      continue;
    }
  }
  return count;
}

export async function confirmReservationsForCheckout(checkoutSessionId: string): Promise<number> {
  const db = getDb();
  const reservations = await findReservationsByCheckoutSession(checkoutSessionId, db);
  const active = reservations.filter((r) => r.status === "active");
  let count = 0;
  for (const row of active) {
    try {
      await db.transaction(async (tx) => {
        const t = asDb(tx);
        const reservation: InventoryReservation = { ...row, status: row.status as ReservationStatus };
        const item = await findInventoryBySkuIdForUpdate(reservation.skuId, t);
        if (!item) return;
        const confirmed = transitionReservation(reservation, RS.CONFIRMED);
        const { item: updated, ledger } = confirmReservation(item, confirmed);
        await saveInventoryItem(updated, t);
        await saveLedgerEntry(ledger, t);
        await updateReservationStatus(confirmed, t);
      });
      count++;
    } catch {
      continue;
    }
  }
  return count;
}

export async function confirmReservationsForOrder(orderId: string): Promise<number> {
  const db = getDb();
  const order = await db.select().from(s.orders).where(eq(s.orders.id, orderId));
  if (!order[0] || !order[0].checkoutSessionId) return 0;
  return confirmReservationsForCheckout(order[0].checkoutSessionId);
}
