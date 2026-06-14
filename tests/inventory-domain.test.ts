import { describe, test, expect } from "bun:test";
import {
  createInventoryItem,
  createReservation,
  reserveStock,
  confirmReservation,
  releaseReservation,
  expireReservation,
  getAvailableStock,
  transitionReservation,
} from "../src/domain/inventory/entities.ts";
import { ReservationStatus as RS } from "../src/domain/inventory/types.ts";

describe("Inventory - InventoryItem", () => {
  test("createInventoryItem with default values", () => {
    const item = createInventoryItem({ skuId: "sku-1" });
    expect(item.skuId).toBe("sku-1");
    expect(item.physicalStock).toBe(0);
    expect(item.reservedStock).toBe(0);
    expect(item.adjustedStock).toBe(0);
  });

  test("createInventoryItem with physical stock", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 100 });
    expect(item.physicalStock).toBe(100);
  });

  test("getAvailableStock calculates correctly", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 100 });
    expect(getAvailableStock(item)).toBe(100);
  });

  test("getAvailableStock considers reserved and adjusted", () => {
    const item: ReturnType<typeof createInventoryItem> = {
      id: "id",
      skuId: "sku-1",
      physicalStock: 100,
      reservedStock: 20,
      adjustedStock: 10,
      updatedAt: new Date(),
    };
    expect(getAvailableStock(item)).toBe(90);
  });
});

describe("Inventory - Reservations", () => {
  test("createReservation with defaults", () => {
    const reservation = createReservation({ skuId: "sku-1", quantity: 5 });
    expect(reservation.skuId).toBe("sku-1");
    expect(reservation.quantity).toBe(5);
    expect(reservation.status).toBe(RS.ACTIVE);
    expect(reservation.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("createReservation rejects zero quantity", () => {
    expect(() => createReservation({ skuId: "sku-1", quantity: 0 })).toThrow("positive");
  });

  test("createReservation rejects negative quantity", () => {
    expect(() => createReservation({ skuId: "sku-1", quantity: -1 })).toThrow("positive");
  });

  test("transitionReservation from active to confirmed", () => {
    const reservation = createReservation({ skuId: "sku-1", quantity: 5 });
    const confirmed = transitionReservation(reservation, RS.CONFIRMED);
    expect(confirmed.status).toBe(RS.CONFIRMED);
  });

  test("transitionReservation from active to expired", () => {
    const reservation = createReservation({ skuId: "sku-1", quantity: 5 });
    const expired = transitionReservation(reservation, RS.EXPIRED);
    expect(expired.status).toBe(RS.EXPIRED);
  });

  test("transitionReservation rejects transition from confirmed", () => {
    const reservation = createReservation({ skuId: "sku-1", quantity: 5 });
    const confirmed = transitionReservation(reservation, RS.CONFIRMED);
    expect(() => transitionReservation(confirmed, RS.RELEASED)).toThrow("Invalid reservation transition");
  });
});

describe("Inventory - Stock Operations", () => {
  test("reserveStock reduces available stock", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 100 });
    const { item: updated, ledger } = reserveStock(item, 10);
    expect(updated.reservedStock).toBe(10);
    expect(ledger.delta).toBe(-10);
    expect(getAvailableStock(updated)).toBe(90);
  });

  test("reserveStock rejects insufficient stock", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 5 });
    expect(() => reserveStock(item, 10)).toThrow("Insufficient stock");
  });

  test("reserveStock rejects zero quantity", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 100 });
    expect(() => reserveStock(item, 0)).toThrow("positive");
  });

  test("confirmReservation deducts physical and reserved stock", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 100 });
    const { item: reservedItem } = reserveStock(item, 10);
    const reservation = createReservation({ skuId: "sku-1", quantity: 10 });
    const { item: updated, ledger } = confirmReservation(reservedItem, reservation);
    expect(updated.physicalStock).toBe(90);
    expect(updated.reservedStock).toBe(0);
    expect(ledger.delta).toBe(-10);
    expect(ledger.reason).toBe("reservation_confirmed");
  });

  test("confirmReservation rejects non-active reservation", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 100 });
    const { item: reservedItem } = reserveStock(item, 10);
    const reservation = createReservation({ skuId: "sku-1", quantity: 10 });
    const confirmed = transitionReservation(reservation, RS.CONFIRMED);
    expect(() => confirmReservation(reservedItem, confirmed)).toThrow("Invalid reservation transition");
  });

  test("releaseReservation returns reserved stock", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 100 });
    const { item: reservedItem } = reserveStock(item, 10);
    const reservation = createReservation({ skuId: "sku-1", quantity: 10 });
    const { item: updated, ledger } = releaseReservation(reservedItem, reservation);
    expect(updated.reservedStock).toBe(0);
    expect(ledger.delta).toBe(10);
    expect(ledger.reason).toBe("reservation_released");
  });

  test("expireReservation returns reserved stock", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 100 });
    const { item: reservedItem } = reserveStock(item, 10);
    const reservation = createReservation({ skuId: "sku-1", quantity: 10 });
    const { item: updated, ledger } = expireReservation(reservedItem, reservation);
    expect(updated.reservedStock).toBe(0);
    expect(ledger.delta).toBe(10);
    expect(ledger.reason).toBe("reservation_expired");
  });
});