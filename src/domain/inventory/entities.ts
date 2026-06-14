import {
  type ReservationStatus,
  type LedgerReason,
  ReservationStatus as RS,
  RESERVATION_TRANSITIONS,
  LedgerReason as LR,
} from "./types.ts";

export type InventoryItem = {
  readonly id: string;
  readonly skuId: string;
  readonly physicalStock: number;
  readonly reservedStock: number;
  readonly adjustedStock: number;
  readonly updatedAt: Date;
};

export type InventoryReservation = {
  readonly id: string;
  readonly skuId: string;
  readonly quantity: number;
  readonly status: ReservationStatus;
  readonly checkoutSessionId: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
};

export type InventoryLedgerEntry = {
  readonly id: string;
  readonly skuId: string;
  readonly delta: number;
  readonly reason: LedgerReason;
  readonly referenceId: string | null;
  readonly actorId: string | null;
  readonly createdAt: Date;
};

export function getAvailableStock(item: InventoryItem): number {
  return item.physicalStock - item.reservedStock + item.adjustedStock;
}

export function createInventoryItem(input: {
  skuId: string;
  physicalStock?: number;
}): InventoryItem {
  if (!input.skuId) throw new Error("Inventory must belong to a SKU");
  return Object.freeze({
    id: crypto.randomUUID(),
    skuId: input.skuId,
    physicalStock: input.physicalStock ?? 0,
    reservedStock: 0,
    adjustedStock: 0,
    updatedAt: new Date(),
  });
}

export function createReservation(input: {
  skuId: string;
  quantity: number;
  checkoutSessionId?: string;
  ttlMinutes?: number;
}): InventoryReservation {
  if (!input.skuId) throw new Error("Reservation must reference a SKU");
  if (input.quantity <= 0) throw new Error("Reservation quantity must be positive");
  const ttl = input.ttlMinutes ?? 60;
  return Object.freeze({
    id: crypto.randomUUID(),
    skuId: input.skuId,
    quantity: input.quantity,
    status: RS.ACTIVE,
    checkoutSessionId: input.checkoutSessionId ?? null,
    expiresAt: new Date(Date.now() + ttl * 60 * 1000),
    createdAt: new Date(),
  });
}

export function createLedgerEntry(input: {
  skuId: string;
  delta: number;
  reason: LedgerReason;
  referenceId?: string;
  actorId?: string;
}): InventoryLedgerEntry {
  if (input.delta === 0) throw new Error("Ledger delta cannot be zero");
  return Object.freeze({
    id: crypto.randomUUID(),
    skuId: input.skuId,
    delta: input.delta,
    reason: input.reason,
    referenceId: input.referenceId ?? null,
    actorId: input.actorId ?? null,
    createdAt: new Date(),
  });
}

export function reserveStock(
  item: InventoryItem,
  quantity: number
): { item: InventoryItem; ledger: InventoryLedgerEntry } {
  const available = getAvailableStock(item);
  if (quantity <= 0) throw new Error("Reservation quantity must be positive");
  if (quantity > available) {
    throw new Error(
      `Insufficient stock: available=${available}, requested=${quantity}`
    );
  }
  const updated = Object.freeze({
    ...item,
    reservedStock: item.reservedStock + quantity,
    updatedAt: new Date(),
  });
  const ledger = createLedgerEntry({
    skuId: item.skuId,
    delta: -quantity,
    reason: LR.RESERVATION_CREATED,
  });
  return { item: updated, ledger };
}

export function confirmReservation(
  item: InventoryItem,
  reservation: InventoryReservation
): { item: InventoryItem; ledger: InventoryLedgerEntry } {
  assertReservationTransition(reservation.status, RS.CONFIRMED);
  const updated = Object.freeze({
    ...item,
    physicalStock: item.physicalStock - reservation.quantity,
    reservedStock: item.reservedStock - reservation.quantity,
    updatedAt: new Date(),
  });
  const ledger = createLedgerEntry({
    skuId: item.skuId,
    delta: -reservation.quantity,
    reason: LR.RESERVATION_CONFIRMED,
    referenceId: reservation.id,
  });
  return { item: updated, ledger };
}

export function releaseReservation(
  item: InventoryItem,
  reservation: InventoryReservation
): { item: InventoryItem; ledger: InventoryLedgerEntry } {
  assertReservationTransition(reservation.status, RS.RELEASED);
  const updated = Object.freeze({
    ...item,
    reservedStock: item.reservedStock - reservation.quantity,
    updatedAt: new Date(),
  });
  const ledger = createLedgerEntry({
    skuId: item.skuId,
    delta: reservation.quantity,
    reason: LR.RESERVATION_RELEASED,
    referenceId: reservation.id,
  });
  return { item: updated, ledger };
}

export function expireReservation(
  item: InventoryItem,
  reservation: InventoryReservation
): { item: InventoryItem; ledger: InventoryLedgerEntry } {
  assertReservationTransition(reservation.status, RS.EXPIRED);
  const updated = Object.freeze({
    ...item,
    reservedStock: item.reservedStock - reservation.quantity,
    updatedAt: new Date(),
  });
  const ledger = createLedgerEntry({
    skuId: item.skuId,
    delta: reservation.quantity,
    reason: LR.RESERVATION_EXPIRED,
    referenceId: reservation.id,
  });
  return { item: updated, ledger };
}

export function adjustStock(
  item: InventoryItem,
  delta: number,
  actorId?: string
): { item: InventoryItem; ledger: InventoryLedgerEntry } {
  if (delta === 0) throw new Error("Adjustment delta cannot be zero");
  const updated = Object.freeze({
    ...item,
    adjustedStock: item.adjustedStock + delta,
    updatedAt: new Date(),
  });
  const ledger = createLedgerEntry({
    skuId: item.skuId,
    delta,
    reason: delta > 0 ? LR.STOCK_RECEIPT : LR.MANUAL_ADJUSTMENT,
    actorId,
  });
  return { item: updated, ledger };
}

export function transitionReservation(
  reservation: InventoryReservation,
  target: ReservationStatus
): InventoryReservation {
  assertReservationTransition(reservation.status, target);
  return Object.freeze({ ...reservation, status: target });
}

function assertReservationTransition(
  current: ReservationStatus,
  target: ReservationStatus
): void {
  const allowed = RESERVATION_TRANSITIONS[current];
  if (!allowed.includes(target)) {
    throw new Error(
      `Invalid reservation transition: ${current} -> ${target}`
    );
  }
}

export function isReservationExpired(reservation: InventoryReservation): boolean {
  return reservation.status === RS.ACTIVE && reservation.expiresAt < new Date();
}
