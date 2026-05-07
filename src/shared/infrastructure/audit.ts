import { getDb } from "../infrastructure/db/index.ts";
import * as s from "../infrastructure/db/schema.ts";

export async function writeAuditEvent(input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  actorId?: string;
  correlationId?: string;
}): Promise<void> {
  await getDb().insert(s.auditEvents).values({
    id: crypto.randomUUID(),
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: input.payload ?? null,
    actorId: input.actorId ?? null,
    correlationId: input.correlationId ?? null,
  });
}
