import { describe, test, expect } from "bun:test";
import { createReservation, isReservationExpired, reserveStock, createInventoryItem, releaseReservation, expireReservation } from "../src/domain/inventory/entities.ts";
import { ReservationStatus as RS } from "../src/domain/inventory/types.ts";
import { OrderStatus, canTransitionTo } from "../src/domain/orders/types.ts";
import { signCookieValue, verifySignedCookieValue } from "../src/web/helpers/signed-cookie.ts";

describe("Inventory reservation expiry", () => {
  test("reservation created with 60 min TTL by default", () => {
    const before = Date.now() + 59 * 60 * 1000;
    const r = createReservation({ skuId: "sku-1", quantity: 1 });
    const after = Date.now() + 61 * 60 * 1000;
    expect(r.expiresAt.getTime()).toBeGreaterThan(before);
    expect(r.expiresAt.getTime()).toBeLessThan(after);
  });

  test("reservation with custom TTL", () => {
    const r = createReservation({ skuId: "sku-1", quantity: 1, ttlMinutes: 5 });
    const expected = Date.now() + 5 * 60 * 1000;
    expect(Math.abs(r.expiresAt.getTime() - expected)).toBeLessThan(1000);
  });

  test("active reservation not expired", () => {
    const r = createReservation({ skuId: "sku-1", quantity: 1, ttlMinutes: 60 });
    expect(isReservationExpired(r)).toBe(false);
  });

  test("reservation with past expiry is expired", () => {
    const r = createReservation({ skuId: "sku-1", quantity: 1, ttlMinutes: -1 });
    expect(isReservationExpired(r)).toBe(true);
  });

  test("confirmed reservation is not expired even if past TTL", () => {
    const r = createReservation({ skuId: "sku-1", quantity: 1, ttlMinutes: -1 });
    const confirmed = { ...r, status: RS.CONFIRMED };
    expect(isReservationExpired(confirmed)).toBe(false);
  });
});

describe("Inventory stock operations", () => {
  test("reserveStock reduces available", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 10 });
    const { item: updated, ledger } = reserveStock(item, 3);
    expect(updated.reservedStock).toBe(3);
    expect(ledger.delta).toBe(-3);
  });

  test("reserveStock throws when insufficient", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 2 });
    expect(() => reserveStock(item, 5)).toThrow("Insufficient stock");
  });

  test("releaseReservation restores stock", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 10 });
    const { item: reserved } = reserveStock(item, 3);
    const r = createReservation({ skuId: "sku-1", quantity: 3 });
    const released = { ...r, status: RS.ACTIVE };
    const { item: releasedItem } = releaseReservation(reserved, released);
    expect(releasedItem.reservedStock).toBe(0);
  });

  test("expireReservation restores stock", () => {
    const item = createInventoryItem({ skuId: "sku-1", physicalStock: 10 });
    const { item: reserved } = reserveStock(item, 3);
    const r = createReservation({ skuId: "sku-1", quantity: 3 });
    const expired = { ...r, status: RS.ACTIVE };
    const { item: expiredItem } = expireReservation(reserved, expired);
    expect(expiredItem.reservedStock).toBe(0);
  });
});

describe("Cart quantity limits", () => {
  test("max quantity constant is 10", async () => {
    const mod = await import("../src/application/checkout/use-cases.ts");
    expect(mod.MAX_QUANTITY_PER_SKU).toBe(10);
  });

  test("max cart items constant is 20", async () => {
    const mod = await import("../src/application/checkout/use-cases.ts");
    expect(mod.MAX_CART_ITEMS).toBe(20);
  });

  test("checkout timeout is 30 minutes", async () => {
    const mod = await import("../src/application/checkout/use-cases.ts");
    expect(mod.CHECKOUT_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });
});

describe("Checkout recoverability", () => {
  test("order status model supports retryable payment states", () => {
    expect(OrderStatus.PAYMENT_PENDING).toBe("payment_pending");
    expect(OrderStatus.AWAITING_PAYMENT).toBe("awaiting_payment");
    expect(OrderStatus.PAYMENT_FAILED).toBe("payment_failed");
    expect(canTransitionTo("payment_pending", "awaiting_payment")).toBe(true);
    expect(canTransitionTo("payment_failed", "awaiting_payment")).toBe(true);
    expect(canTransitionTo("confirmed", "payment_failed")).toBe(false);
  });
});

describe("Signed cart/session cookies", () => {
  test("signed cookie verifies to original value", () => {
    const value = crypto.randomUUID();
    const signed = signCookieValue(value);
    expect(verifySignedCookieValue(signed)).toBe(value);
  });

  test("tampered cookie is rejected", () => {
    const value = crypto.randomUUID();
    const signed = signCookieValue(value);
    expect(verifySignedCookieValue(signed.replace(value, crypto.randomUUID()))).toBeNull();
    expect(verifySignedCookieValue(value)).toBeNull();
  });
});
