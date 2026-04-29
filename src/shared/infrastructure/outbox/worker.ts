import * as repo from "./repository.ts";
import { createOutboxEvent, markCompleted, markFailed, type OutboxEvent } from "./domain.ts";
import { getDb } from "../db/index.ts";

export async function emitEvent(input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}) {
  const event = createOutboxEvent(input);
  await repo.insertOutboxEvent({
    id: event.id,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: event.payload,
    status: event.status,
    attempts: event.attempts,
    maxAttempts: event.maxAttempts,
    nextRetryAt: event.nextRetryAt,
  });
  return event;
}

export async function emitEventWithDb(db: unknown, input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  const event = createOutboxEvent(input);
  await repo.insertOutboxEvent({
    id: event.id,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: event.payload,
    status: event.status,
    attempts: event.attempts,
    maxAttempts: event.maxAttempts,
    nextRetryAt: event.nextRetryAt,
  }, db as ReturnType<typeof getDb>);
  return event;
}

type EventHandler = (event: OutboxEvent) => Promise<void>;

const handlers: EventHandler[] = [];

export function registerEventHandler(handler: EventHandler) {
  handlers.push(handler);
}

export async function processOutboxBatch(limit: number = 50): Promise<{ processed: number; failed: number }> {
  const events = await repo.findPendingOutboxEvents(limit);
  let processed = 0;
  let failed = 0;

  for (const row of events) {
    const event: OutboxEvent = {
      id: row.id,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      payload: row.payload as Record<string, unknown> | null,
      status: row.status as OutboxEvent["status"],
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      nextRetryAt: row.nextRetryAt,
      processedAt: row.processedAt,
      createdAt: row.createdAt,
    };

    try {
      await repo.updateOutboxEvent(event.id, { status: "processing" });
      for (const handler of handlers) {
        await handler(event);
      }
      const completed = markCompleted(event);
      await repo.updateOutboxEvent(event.id, {
        status: completed.status,
        processedAt: completed.processedAt,
        nextRetryAt: null,
      });
      processed++;
    } catch {
      const failed_event = markFailed(event);
      await repo.updateOutboxEvent(event.id, {
        status: failed_event.status,
        attempts: failed_event.attempts,
        nextRetryAt: failed_event.nextRetryAt,
      });
      failed++;
    }
  }

  return { processed, failed };
}

export { findStuckOutboxEvents } from "./repository.ts";
