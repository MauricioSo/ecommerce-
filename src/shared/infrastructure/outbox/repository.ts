import { eq, and, lt, desc } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import * as s from "../db/schema.ts";

type Db = ReturnType<typeof getDb>;

export async function insertOutboxEvent(input: {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
}, db: Db = getDb()) {
  await db.insert(s.outboxEvents).values(input);
}

export async function findPendingOutboxEvents(limit: number = 50) {
  const now = new Date();
  return getDb().select().from(s.outboxEvents)
    .where(and(
      eq(s.outboxEvents.status, "pending"),
      lt(s.outboxEvents.nextRetryAt, now),
    ))
    .orderBy(s.outboxEvents.createdAt)
    .limit(limit);
}

export async function updateOutboxEvent(id: string, data: {
  status?: string;
  attempts?: number;
  nextRetryAt?: Date | null;
  processedAt?: Date | null;
}) {
  await getDb().update(s.outboxEvents).set(data).where(eq(s.outboxEvents.id, id));
}

export async function findStuckOutboxEvents() {
  return getDb().select().from(s.outboxEvents)
    .where(eq(s.outboxEvents.status, "failed"))
    .orderBy(desc(s.outboxEvents.createdAt));
}
