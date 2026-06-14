export type AuditEvent = {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown> | null;
  readonly actorId: string | null;
  readonly correlationId: string | null;
  readonly createdAt: Date;
};

export function createAuditEvent(input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  actorId?: string;
  correlationId?: string;
}): AuditEvent {
  if (!input.aggregateType) throw new Error("Aggregate type is required");
  if (!input.aggregateId) throw new Error("Aggregate ID is required");
  if (!input.eventType) throw new Error("Event type is required");
  return Object.freeze({
    id: crypto.randomUUID(),
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: input.payload ?? null,
    actorId: input.actorId ?? null,
    correlationId: input.correlationId ?? null,
    createdAt: new Date(),
  });
}

export const AggregateType = {
  ORDER: "order",
  PAYMENT: "payment",
  INVENTORY: "inventory",
  PRODUCT: "product",
  SKU: "sku",
  CUSTOMER: "customer",
  PROMOTION: "promotion",
  SHIPMENT: "shipment",
  RETURN: "return",
  CART: "cart",
  CHECKOUT: "checkout",
} as const;

export type AggregateType = (typeof AggregateType)[keyof typeof AggregateType];
