import { describe, test, expect } from "bun:test";
import {
  reserveStock,
  confirmReservation,
  releaseReservation,
  adjustStock,
  getAvailableStock,
  createReservation,
  type InventoryItem,
} from "../src/domain/inventory/entities.ts";
import { canTransitionTo as orderCanTransition, ORDER_TRANSITIONS } from "../src/domain/orders/types.ts";
import { canTransitionTo as paymentCanTransition, PAYMENT_TRANSITIONS } from "../src/domain/payments/types.ts";
import { canTransitionTo as shipmentCanTransition } from "../src/domain/fulfillment/types.ts";
import {
  createShipment,
  createReturnRequest,
  approveReturn,
} from "../src/domain/fulfillment/entities.ts";
import {
  createOutboxEvent,
  markCompleted,
  markFailed,
  OutboxEventStatus,
} from "../src/shared/infrastructure/outbox/domain.ts";
import { Money } from "../src/shared/domain/money.ts";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: crypto.randomUUID(),
    skuId: crypto.randomUUID(),
    physicalStock: 100,
    reservedStock: 0,
    adjustedStock: 0,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Inventory - sobreventa", () => {
  test("no se puede reservar mas stock del disponible", () => {
    const item = makeItem({ physicalStock: 10, reservedStock: 0 });
    expect(() => reserveStock(item, 11)).toThrow("Insufficient stock");
  });

  test("no se puede reservar mas del vendible tras reservas existentes", () => {
    const item = makeItem({ physicalStock: 10, reservedStock: 8 });
    expect(() => reserveStock(item, 5)).toThrow("Insufficient stock");
  });

  test("reserva exitosa cuando hay stock suficiente", () => {
    const item = makeItem({ physicalStock: 10, reservedStock: 0 });
    const { item: updated } = reserveStock(item, 5);
    expect(updated.reservedStock).toBe(5);
    expect(getAvailableStock(updated)).toBe(5);
  });

  test("cantidad de reserva debe ser positiva", () => {
    const item = makeItem();
    expect(() => reserveStock(item, 0)).toThrow("positive");
    expect(() => reserveStock(item, -1)).toThrow("positive");
  });

  test("confirmar reserva reduce stock fisico y reservado", () => {
    const item = makeItem({ physicalStock: 10, reservedStock: 3 });
    const reservation = createReservation({ skuId: item.skuId, quantity: 3 });
    const { item: updated } = confirmReservation(item, reservation);
    expect(updated.physicalStock).toBe(7);
    expect(updated.reservedStock).toBe(0);
  });

  test("liberar reserva restaura stock vendible", () => {
    const item = makeItem({ physicalStock: 10, reservedStock: 5 });
    const reservation = createReservation({ skuId: item.skuId, quantity: 5 });
    const { item: updated } = releaseReservation(item, reservation);
    expect(updated.reservedStock).toBe(0);
    expect(getAvailableStock(updated)).toBe(10);
  });
});

describe("Inventory - ajuste de stock", () => {
  test("ajuste positivo incrementa adjustedStock", () => {
    const item = makeItem({ adjustedStock: 0 });
    const { item: updated } = adjustStock(item, 10, "admin");
    expect(updated.adjustedStock).toBe(10);
  });

  test("ajuste negativo decrementa adjustedStock", () => {
    const item = makeItem({ adjustedStock: 5 });
    const { item: updated } = adjustStock(item, -3, "admin");
    expect(updated.adjustedStock).toBe(2);
  });

  test("delta cero lanza error", () => {
    const item = makeItem();
    expect(() => adjustStock(item, 0, "admin")).toThrow("zero");
  });
});

describe("Orders - maquina de estado", () => {
  test("transiciones validas funcionan", () => {
    expect(orderCanTransition("pending", "confirmed")).toBe(true);
    expect(orderCanTransition("confirmed", "processing")).toBe(true);
    expect(orderCanTransition("processing", "shipped")).toBe(true);
    expect(orderCanTransition("shipped", "delivered")).toBe(true);
  });

  test("transiciones invalidas son bloqueadas", () => {
    expect(orderCanTransition("pending", "shipped")).toBe(false);
    expect(orderCanTransition("delivered", "pending")).toBe(false);
    expect(orderCanTransition("cancelled", "confirmed")).toBe(false);
    expect(orderCanTransition("refunded", "pending")).toBe(false);
  });

  test("estados finales no tienen transiciones salientes", () => {
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(ORDER_TRANSITIONS.refunded).toEqual([]);
  });
});

describe("Payments - maquina de estado", () => {
  test("transiciones validas de pago", () => {
    expect(paymentCanTransition("pending", "processing")).toBe(true);
    expect(paymentCanTransition("processing", "approved")).toBe(true);
    expect(paymentCanTransition("processing", "rejected")).toBe(true);
    expect(paymentCanTransition("processing", "failed")).toBe(true);
  });

  test("no se puede aprobar desde pending directamente en algunos modelos", () => {
    expect(PAYMENT_TRANSITIONS.pending).not.toContain("approved");
  });

  test("estados finales no tienen transiciones", () => {
    expect(PAYMENT_TRANSITIONS.approved).toEqual([]);
    expect(PAYMENT_TRANSITIONS.rejected).toEqual([]);
  });
});

describe("Fulfillment - shipments", () => {
  test("shipment requiere orderId", () => {
    expect(() => createShipment({ orderId: "" })).toThrow("requires an order");
  });

  test("shipment se crea en estado pending", () => {
    const s = createShipment({ orderId: "ord-1" });
    expect(s.status).toBe("pending");
    expect(s.orderId).toBe("ord-1");
  });

  test("transiciones de shipment validas", () => {
    expect(shipmentCanTransition("pending", "picked_up")).toBe(true);
    expect(shipmentCanTransition("pending", "cancelled")).toBe(true);
    expect(shipmentCanTransition("picked_up", "in_transit")).toBe(true);
    expect(shipmentCanTransition("delivered", "pending")).toBe(false);
  });
});

describe("Fulfillment - devoluciones", () => {
  test("return requiere reason", () => {
    expect(() => createReturnRequest({ orderId: "o1", orderItemId: "i1", reason: "" })).toThrow("required");
  });

  test("return se crea en estado requested", () => {
    const r = createReturnRequest({ orderId: "o1", orderItemId: "i1", reason: "broken" });
    expect(r.status).toBe("requested");
    expect(r.reason).toBe("broken");
  });

  test("approve desde requested funciona", () => {
    const r = createReturnRequest({ orderId: "o1", orderItemId: "i1", reason: "broken" });
    const approved = approveReturn(r);
    expect(approved.status).toBe("approved");
  });

  test("approve desde estado incorrecto falla", () => {
    const r = createReturnRequest({ orderId: "o1", orderItemId: "i1", reason: "broken" });
    const approved = approveReturn(r);
    expect(() => approveReturn(approved)).toThrow();
  });
});

describe("Outbox - retry y estados", () => {
  test("evento se crea en pending", () => {
    const e = createOutboxEvent({ aggregateType: "order", aggregateId: "id", eventType: "created" });
    expect(e.status).toBe(OutboxEventStatus.PENDING);
    expect(e.attempts).toBe(0);
  });

  test("markCompleted cambia estado", () => {
    const e = createOutboxEvent({ aggregateType: "order", aggregateId: "id", eventType: "created" });
    const completed = markCompleted(e);
    expect(completed.status).toBe(OutboxEventStatus.COMPLETED);
    expect(completed.processedAt).toBeDefined();
  });

  test("markFailed incrementa intentos y hace retry hasta maxAttempts", () => {
    const e = createOutboxEvent({ aggregateType: "order", aggregateId: "id", eventType: "created", maxAttempts: 3 });
    let current = e;
    for (let i = 0; i < 2; i++) {
      current = markFailed(current);
      expect(current.attempts).toBe(i + 1);
      expect(current.status).toBe(OutboxEventStatus.PENDING);
    }
    current = markFailed(current);
    expect(current.status).toBe(OutboxEventStatus.FAILED);
  });
});

describe("Money - value object", () => {
  test("creacion desde centavos", () => {
    const m = Money.fromCents(1000, "USD");
    expect(m.amount).toBe(1000);
    expect(m.currency).toBe("USD");
  });

  test("suma correctamente", () => {
    const a = Money.fromCents(500, "USD");
    const b = Money.fromCents(300, "USD");
    const total = a.add(b);
    expect(total.amount).toBe(800);
  });

  test("isZero funciona", () => {
    expect(Money.fromCents(0, "USD").isZero()).toBe(true);
    expect(Money.fromCents(100, "USD").isZero()).toBe(false);
  });
});
