import { Elysia, t } from "elysia";
import { renderView } from "../../web/templates/engine.ts";
import * as cockpitUc from "../../application/crm/customer-cockpit-use-cases.ts";
import * as notesUc from "../../application/crm/notes-use-cases.ts";
import * as tagsUc from "../../application/crm/tags-use-cases.ts";
import * as tasksUc from "../../application/crm/tasks-use-cases.ts";
import { getAdminUserFromSession } from "../../application/admin/use-cases.ts";

import { ensureCsrfToken } from "../../web/helpers/csrf.ts";
import { escapeHtml } from "../../web/helpers/escape.ts";

async function getAdminId(cookie: Record<string, unknown>): Promise<string | undefined> {
  const sessionValue = (cookie as Record<string, { value?: string }>).admin_session?.value;
  if (!sessionValue || typeof sessionValue !== "string") return undefined;
  const user = await getAdminUserFromSession(sessionValue);
  return user?.id;
}

export const crmAdminRoutes = new Elysia({ prefix: "/admin/crm" })
  .get("/customers", async ({ query, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const result = await cockpitUc.listCrmCustomersUseCase({
      query: query.q as string | undefined,
      tagId: query.tag as string | undefined,
      status: query.status as string | undefined,
      hasOpenTasks: query.hasTasks === "true",
      page: query.page ? Number(query.page) : undefined,
      pageSize: 20,
    });
    const tags = await tagsUc.listCrmTagsUseCase();
    const body = renderView("pages/admin/crm-customers.eta", {
      customers: result.customers,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      tags,
      filters: {
        q: query.q ?? "",
        tag: query.tag ?? "",
        status: query.status ?? "",
        hasTasks: query.hasTasks === "true",
      },
      title: "CRM Customers",
      csrfToken,
    });
    return renderView("layouts/admin.eta", { body, title: "CRM Customers", csrfToken });
  })
  .get("/customers/:id", async ({ params, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const cockpit = await cockpitUc.getCustomerCockpitUseCase(params.id);
    if (!cockpit) {
      return new Response("Customer not found", { status: 404 });
    }
    const tags = await tagsUc.listCrmTagsUseCase();
    const body = renderView("pages/admin/crm-customer-detail.eta", {
      cockpit,
      tags,
      title: `CRM: ${cockpit.customer.email}`,
      csrfToken,
    });
    return renderView("layouts/admin.eta", { body, title: `CRM: ${cockpit.customer.email}`, csrfToken });
  })
  .post("/customers/:id/notes", async ({ params, body, cookie }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const adminId = await getAdminId(cookie);
    try {
      await notesUc.addCustomerNoteUseCase({
        customerId: params.id,
        body: input.body as string,
        visibility: input.visibility as string | undefined,
        authorAdminId: adminId,
      });
      return `<div class="toast toast-success">Note added</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ body: t.String({ maxLength: 5000 }), visibility: t.Optional(t.String({ maxLength: 20 })) }) })
  .post("/notes/:id", async ({ params, body, cookie }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const adminId = await getAdminId(cookie);
    try {
      await notesUc.updateCustomerNoteUseCase({
        noteId: params.id,
        body: input.body as string | undefined,
        visibility: input.visibility as string | undefined,
        authorAdminId: adminId,
      });
      return `<div class="toast toast-success">Note updated</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ body: t.Optional(t.String({ maxLength: 5000 })), visibility: t.Optional(t.String({ maxLength: 20 })) }) })
  .post("/tags", async ({ body, cookie }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const adminId = await getAdminId(cookie);
    try {
      const tag = await tagsUc.createCrmTagUseCase({
        name: input.name as string,
        color: input.color as string | undefined,
        description: input.description as string | undefined,
        actorId: adminId,
      });
      if (!tag) throw new Error("Failed to create tag");
      return `<div class="toast toast-success">Tag "${escapeHtml(tag.name)}" created</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ name: t.String({ maxLength: 50 }), color: t.Optional(t.String({ maxLength: 7 })), description: t.Optional(t.String({ maxLength: 500 })) }) })
  .post("/customers/:id/tags", async ({ params, body, cookie }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const adminId = await getAdminId(cookie);
    try {
      await tagsUc.assignCrmTagUseCase({
        customerId: params.id,
        tagId: input.tagId as string,
        assignedBy: adminId,
      });
      return `<div class="toast toast-success">Tag assigned</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ tagId: t.String({ maxLength: 64 }) }) })
  .post("/customers/:id/tags/remove", async ({ params, body, cookie }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const adminId = await getAdminId(cookie);
    try {
      await tagsUc.removeCrmTagUseCase({
        customerId: params.id,
        tagId: input.tagId as string,
        removedBy: adminId,
      });
      return `<div class="toast toast-success">Tag removed</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ tagId: t.String({ maxLength: 64 }) }) })
  .get("/tasks", async ({ query, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const tasks = await tasksUc.listOpenTasksUseCase({
      assignedTo: query.assignedTo as string | undefined,
      priority: query.priority as string | undefined,
    });
    const body = renderView("pages/admin/crm-tasks.eta", {
      tasks,
      filters: {
        assignedTo: query.assignedTo ?? "",
        priority: query.priority ?? "",
      },
      title: "CRM Tasks",
      csrfToken,
    });
    return renderView("layouts/admin.eta", { body, title: "CRM Tasks", csrfToken });
  })
  .post("/customers/:id/tasks", async ({ params, body, cookie }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const adminId = await getAdminId(cookie);
    try {
      await tasksUc.createCrmTaskUseCase({
        customerId: params.id,
        type: input.type as string,
        title: input.title as string,
        description: input.description as string | undefined,
        priority: input.priority as string | undefined,
        dueAt: input.dueAt ? new Date(input.dueAt as string) : undefined,
        createdBy: adminId,
      });
      return `<div class="toast toast-success">Task created</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({
    type: t.String({ maxLength: 30 }),
    title: t.String({ maxLength: 200 }),
    description: t.Optional(t.String({ maxLength: 2000 })),
    priority: t.Optional(t.String({ maxLength: 20 })),
    dueAt: t.Optional(t.String({ maxLength: 30 })),
  }) })
  .post("/tasks/:id/status", async ({ params, body, cookie }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const adminId = await getAdminId(cookie);
    try {
      await tasksUc.updateCrmTaskStatusUseCase({
        taskId: params.id,
        status: input.status as string,
        updatedBy: adminId,
      });
      return `<div class="toast toast-success">Task updated</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ status: t.String({ maxLength: 30 }) }) })
  .post("/customers/:id/interactions", async ({ params, body, cookie }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const adminId = await getAdminId(cookie);
    try {
      await tasksUc.addCrmInteractionUseCase({
        customerId: params.id,
        channel: input.channel as string,
        summary: input.summary as string,
        direction: input.direction as string | undefined,
        adminId: adminId,
      });
      return `<div class="toast toast-success">Interaction recorded</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({
    channel: t.String({ maxLength: 20 }),
    summary: t.String({ maxLength: 1000 }),
    direction: t.Optional(t.String({ maxLength: 20 })),
  }) })
  .post("/customers/:id/status", async ({ params, body, cookie }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const adminId = await getAdminId(cookie);
    try {
      await cockpitUc.updateCrmCustomerStatusUseCase(params.id, input.status as string, adminId);
      return `<div class="toast toast-success">Customer status updated</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ status: t.String({ maxLength: 30 }) }) });
