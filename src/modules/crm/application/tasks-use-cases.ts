import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import * as repo from "../infrastructure/repository.ts";
import { isValidTaskStatus, isValidTaskPriority, isValidTaskType, isValidInteractionChannel, isValidInteractionDirection } from "../domain/types.ts";

type Db = ReturnType<typeof getDb>;

export async function listOpenTasksUseCase(filters?: {
  assignedTo?: string;
  priority?: string;
}) {
  const db = getDb();
  let tasks = await repo.findOpenTasks(db);

  if (filters?.assignedTo) {
    tasks = tasks.filter((t) => t.assignedTo === filters.assignedTo);
  }
  if (filters?.priority) {
    tasks = tasks.filter((t) => t.priority === filters.priority);
  }

  return tasks;
}

export async function createCrmTaskUseCase(input: {
  customerId?: string;
  orderId?: string;
  assignedTo?: string;
  createdBy?: string;
  type: string;
  title: string;
  description?: string;
  priority?: string;
  dueAt?: Date;
}) {
  const db = getDb();

  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Task title cannot be empty");
  }

  if (input.title.length > 255) {
    throw new Error("Task title exceeds maximum length of 255 characters");
  }

  if (!isValidTaskType(input.type)) {
    throw new Error(`Invalid task type: ${input.type}`);
  }

  if (input.priority && !isValidTaskPriority(input.priority)) {
    throw new Error(`Invalid task priority: ${input.priority}`);
  }

  if (input.customerId) {
    const customer = await repo.findCustomerById(input.customerId, db);
    if (!customer) throw new Error("Customer not found");
  }

  const task = await db.transaction(async (tx) => {
    const created = await repo.insertCrmTask({
      customerId: input.customerId,
      orderId: input.orderId,
      assignedTo: input.assignedTo,
      createdBy: input.createdBy,
      type: input.type,
      title: input.title.trim(),
      description: input.description,
      priority: input.priority ?? "normal",
      dueAt: input.dueAt,
    }, tx as unknown as Db);

    if (!created) throw new Error("Failed to create task");

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "crm_task",
      aggregateId: created.id,
      eventType: "crm_task_created",
      payload: {
        customerId: input.customerId,
        type: input.type,
        title: input.title,
        priority: input.priority ?? "normal",
      },
      actorId: input.createdBy ?? null,
      correlationId: null,
    });

    if (input.customerId) {
      await tx.insert(s.auditEvents).values({
        id: crypto.randomUUID(),
        aggregateType: "customer",
        aggregateId: input.customerId,
        eventType: "crm_task_created",
        payload: { taskId: created.id, type: input.type, title: input.title, priority: input.priority ?? "normal" },
        actorId: input.createdBy ?? null,
        correlationId: null,
      });
    }

    return created;
  });

  return task;
}

export async function updateCrmTaskStatusUseCase(input: {
  taskId: string;
  status: string;
  updatedBy?: string;
}): Promise<void> {
  const db = getDb();

  if (!isValidTaskStatus(input.status)) {
    throw new Error(`Invalid task status: ${input.status}`);
  }

  const task = await repo.findTaskById(input.taskId, db);
  if (!task) throw new Error("Task not found");

  await db.transaction(async (tx) => {
    await repo.updateCrmTaskStatus(input.taskId, input.status, tx as unknown as Db);

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "crm_task",
      aggregateId: input.taskId,
      eventType: "crm_task_status_changed",
      payload: { from: task.status, to: input.status },
      actorId: input.updatedBy ?? null,
      correlationId: null,
    });

    if (task.customerId) {
      await tx.insert(s.auditEvents).values({
        id: crypto.randomUUID(),
        aggregateType: "customer",
        aggregateId: task.customerId,
        eventType: "crm_task_status_changed",
        payload: { taskId: input.taskId, from: task.status, to: input.status },
        actorId: input.updatedBy ?? null,
        correlationId: null,
      });
    }
  });
}

export async function addCrmInteractionUseCase(input: {
  customerId: string;
  orderId?: string;
  adminId?: string;
  channel: string;
  direction?: string;
  summary: string;
}): Promise<void> {
  const db = getDb();

  const customer = await repo.findCustomerById(input.customerId, db);
  if (!customer) throw new Error("Customer not found");

  if (!input.summary || input.summary.trim().length === 0) {
    throw new Error("Interaction summary cannot be empty");
  }

  if (input.summary.length > 5000) {
    throw new Error("Interaction summary exceeds maximum length of 5000 characters");
  }

  if (!isValidInteractionChannel(input.channel)) {
    throw new Error(`Invalid interaction channel: ${input.channel}`);
  }

  if (input.direction && !isValidInteractionDirection(input.direction)) {
    throw new Error(`Invalid interaction direction: ${input.direction}`);
  }

  await db.transaction(async (tx) => {
    await repo.insertCrmInteraction({
      customerId: input.customerId,
      orderId: input.orderId,
      adminId: input.adminId,
      channel: input.channel,
      direction: input.direction,
      summary: input.summary.trim(),
    }, tx as unknown as Db);

    await repo.updateCrmCustomerProfile(input.customerId, {
      lastContactedAt: new Date(),
    }, tx as unknown as Db);

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "customer",
      aggregateId: input.customerId,
      eventType: "crm_interaction_added",
      payload: { channel: input.channel, direction: input.direction ?? "internal" },
      actorId: input.adminId ?? null,
      correlationId: null,
    });
  });
}