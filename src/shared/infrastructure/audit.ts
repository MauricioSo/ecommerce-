import { getDb } from "../infrastructure/db/index.ts";
import * as s from "../infrastructure/db/schema.ts";
import { createAuditEvent } from "../../domain/audit/index.ts";

export type AuditEventInput = Parameters<typeof createAuditEvent>[0];

export function auditEventRow(input: AuditEventInput) {
  const e = createAuditEvent(input);
  return {
    id: e.id,
    aggregateType: e.aggregateType,
    aggregateId: e.aggregateId,
    eventType: e.eventType,
    payload: e.payload,
    actorId: e.actorId,
    correlationId: e.correlationId,
  };
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  await getDb().insert(s.auditEvents).values(auditEventRow(input));
}
