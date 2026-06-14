import { getDb } from "../infrastructure/db/index.ts";
import * as s from "../infrastructure/db/schema.ts";
import { createAuditEvent } from "../../domain/audit/index.ts";

export async function writeAuditEvent(input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  actorId?: string;
  correlationId?: string;
}): Promise<void> {
  const event = createAuditEvent(input);
  await getDb().insert(s.auditEvents).values({
    id: event.id,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: event.payload,
    actorId: event.actorId,
    correlationId: event.correlationId,
  });
}
