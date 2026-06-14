import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import * as repo from "../../infrastructure/crm/repository.ts";

type Db = ReturnType<typeof getDb>;

export async function listCrmTagsUseCase() {
  const db = getDb();
  return repo.findAllCrmTags(db);
}

export async function createCrmTagUseCase(input: {
  name: string;
  color?: string;
  description?: string;
  actorId?: string;
}) {
  const db = getDb();

  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Tag name cannot be empty");
  }

  if (input.name.length > 80) {
    throw new Error("Tag name exceeds maximum length of 80 characters");
  }

  const existing = await repo.findCrmTagByName(input.name.trim(), db);
  if (existing) {
    throw new Error("Tag with this name already exists");
  }

  const tag = await repo.insertCrmTag({
    name: input.name.trim(),
    color: input.color,
    description: input.description,
  }, db);

  if (!tag) throw new Error("Failed to create tag");

  await db.insert(s.auditEvents).values({
    id: crypto.randomUUID(),
    aggregateType: "crm_tag",
    aggregateId: tag.id,
    eventType: "crm_tag_created",
    payload: { name: tag.name, color: tag.color },
    actorId: input.actorId ?? null,
    correlationId: null,
  });

  return tag;
}

export async function assignCrmTagUseCase(input: {
  customerId: string;
  tagId: string;
  assignedBy?: string;
}): Promise<void> {
  const db = getDb();

  const customer = await repo.findCustomerById(input.customerId, db);
  if (!customer) throw new Error("Customer not found");

  const tag = await repo.findCrmTagById(input.tagId, db);
  if (!tag) throw new Error("Tag not found");

  const existingTags = await repo.findCustomerTags(input.customerId, db);
  if (existingTags.some((t) => t.tagId === input.tagId)) {
    return;
  }

  const tagName = tag.name;

  await db.transaction(async (tx) => {
    await repo.assignCrmTagToCustomer({
      customerId: input.customerId,
      tagId: input.tagId,
      assignedBy: input.assignedBy,
    }, tx as unknown as Db);

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "customer",
      aggregateId: input.customerId,
      eventType: "crm_tag_assigned",
      payload: { tagId: input.tagId, tagName },
      actorId: input.assignedBy ?? null,
      correlationId: null,
    });
  });
}

export async function removeCrmTagUseCase(input: {
  customerId: string;
  tagId: string;
  removedBy?: string;
}): Promise<void> {
  const db = getDb();

  const customer = await repo.findCustomerById(input.customerId, db);
  if (!customer) throw new Error("Customer not found");

  const tag = await repo.findCrmTagById(input.tagId, db);
  if (!tag) throw new Error("Tag not found");

  const tagName = tag.name;

  await db.transaction(async (tx) => {
    await repo.removeCrmTagFromCustomer(input.customerId, input.tagId, tx as unknown as Db);

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "customer",
      aggregateId: input.customerId,
      eventType: "crm_tag_removed",
      payload: { tagId: input.tagId, tagName },
      actorId: input.removedBy ?? null,
      correlationId: null,
    });
  });
}
