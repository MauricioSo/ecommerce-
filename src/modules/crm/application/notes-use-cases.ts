import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import * as repo from "../infrastructure/repository.ts";

type Db = ReturnType<typeof getDb>;

export async function addCustomerNoteUseCase(input: {
  customerId: string;
  authorAdminId?: string;
  body: string;
  visibility?: string;
}): Promise<void> {
  const db = getDb();

  const customer = await repo.findCustomerById(input.customerId, db);
  if (!customer) throw new Error("Customer not found");

  if (!input.body || input.body.trim().length === 0) {
    throw new Error("Note body cannot be empty");
  }

  if (input.body.length > 10000) {
    throw new Error("Note body exceeds maximum length of 10000 characters");
  }

  await db.transaction(async (tx) => {
    await repo.insertCustomerNote({
      customerId: input.customerId,
      authorAdminId: input.authorAdminId,
      body: input.body.trim(),
      visibility: input.visibility,
    }, tx as unknown as Db);

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "customer",
      aggregateId: input.customerId,
      eventType: "crm_note_added",
      payload: { bodyLength: input.body.length, visibility: input.visibility ?? "internal" },
      actorId: input.authorAdminId ?? null,
      correlationId: null,
    });
  });
}

export async function updateCustomerNoteUseCase(input: {
  noteId: string;
  authorAdminId?: string;
  body?: string;
  visibility?: string;
}): Promise<void> {
  const db = getDb();

  const note = await repo.findCustomerNoteById(input.noteId, db);
  if (!note) throw new Error("Note not found");

  if (input.body !== undefined) {
    if (input.body.trim().length === 0) {
      throw new Error("Note body cannot be empty");
    }
    if (input.body.length > 10000) {
      throw new Error("Note body exceeds maximum length of 10000 characters");
    }
  }

  await db.transaction(async (tx) => {
    await repo.updateCustomerNote(input.noteId, {
      body: input.body?.trim(),
      visibility: input.visibility,
    }, tx as unknown as Db);

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "customer",
      aggregateId: note.customerId,
      eventType: "crm_note_updated",
      payload: { noteId: input.noteId, bodyLength: input.body?.length, visibility: input.visibility },
      actorId: input.authorAdminId ?? null,
      correlationId: null,
    });
  });
}