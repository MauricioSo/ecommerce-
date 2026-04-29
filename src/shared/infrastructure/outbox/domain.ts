export type OutboxEvent = {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown> | null;
  readonly status: OutboxEventStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly nextRetryAt: Date | null;
  readonly processedAt: Date | null;
  readonly createdAt: Date;
};

export const OutboxEventStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type OutboxEventStatus = (typeof OutboxEventStatus)[keyof typeof OutboxEventStatus];

export function createOutboxEvent(input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}): OutboxEvent {
  if (!input.aggregateType) throw new Error("Aggregate type is required");
  if (!input.aggregateId) throw new Error("Aggregate ID is required");
  if (!input.eventType) throw new Error("Event type is required");
  return Object.freeze({
    id: crypto.randomUUID(),
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: input.payload ?? null,
    status: OutboxEventStatus.PENDING,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 5,
    nextRetryAt: new Date(),
    processedAt: null,
    createdAt: new Date(),
  });
}

export function markProcessing(event: OutboxEvent): OutboxEvent {
  return Object.freeze({ ...event, status: OutboxEventStatus.PROCESSING });
}

export function markCompleted(event: OutboxEvent): OutboxEvent {
  return Object.freeze({
    ...event,
    status: OutboxEventStatus.COMPLETED,
    processedAt: new Date(),
    nextRetryAt: null,
  });
}

export function markFailed(event: OutboxEvent): OutboxEvent {
  const attempts = event.attempts + 1;
  if (attempts >= event.maxAttempts) {
    return Object.freeze({
      ...event,
      status: OutboxEventStatus.FAILED,
      attempts,
      nextRetryAt: null,
    });
  }
  const delayMs = Math.min(30000, 1000 * Math.pow(2, attempts));
  return Object.freeze({
    ...event,
    status: OutboxEventStatus.PENDING,
    attempts,
    nextRetryAt: new Date(Date.now() + delayMs),
  });
}

export function isRetryable(event: OutboxEvent): boolean {
  return (
    event.status === OutboxEventStatus.PENDING &&
    event.nextRetryAt !== null &&
    event.nextRetryAt <= new Date()
  );
}
