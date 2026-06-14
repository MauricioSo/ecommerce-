import { Elysia, t } from "elysia";
import { renderView } from "../../web/templates/engine.ts";
import * as uc from "../../application/orders/use-cases.ts";
import * as fulfillmentUc from "../../application/fulfillment/use-cases.ts";
import { type OrderStatus } from "../../domain/orders/types.ts";

import { ensureCsrfToken } from "../../web/helpers/csrf.ts";
import { escapeHtml } from "../../web/helpers/escape.ts";
import { getAdminUserFromCookie } from "../../web/middleware/admin-auth.ts";
import { writeAuditEvent } from "../../shared/infrastructure/audit.ts";

export const orderAdminRoutes = new Elysia({ prefix: "/admin/orders" })
  .get("/", async ({ query, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const result = await uc.listOrdersUseCase({
      status: query.status as string | undefined,
      page: query.page ? Number(query.page) : undefined,
    });
    const body = renderView("pages/admin/orders.eta", {
      orders: result.orders,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      currentStatus: (query.status as string) ?? "",
      csrfToken,
    });
    return renderView("layouts/admin.eta", { body, title: "Orders", csrfToken });
  })
  .get("/:id", async ({ params, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const order = await uc.getOrderDetailUseCase(params.id);
    const timeline = await uc.getOrderTimelineUseCase(params.id);
    const shipment = await fulfillmentUc.getOrderShipment(params.id);
    const returns = await fulfillmentUc.getOrderReturns(params.id);
    const shipmentEvents = shipment ? await fulfillmentUc.getShipmentEvents(shipment.id) : [];
    const body = renderView("pages/admin/order-detail.eta", { order, timeline, shipment, shipmentEvents, returns, csrfToken });
    return renderView("layouts/admin.eta", { body, title: `Order ${order.id.substring(0, 8)}`, csrfToken });
  })
  .post("/:id/status", async ({ params, body, cookie }) => {
    const input = body as Record<string, unknown>;
    try {
      await uc.transitionOrderStatusUseCase({
        orderId: params.id,
        targetStatus: input.targetStatus as OrderStatus,
        reason: (input.reason as string) ?? undefined,
      });
      const admin = await getAdminUserFromCookie(cookie);
      await writeAuditEvent({
        aggregateType: "order",
        aggregateId: params.id,
        eventType: "admin.order.status_change",
        payload: { targetStatus: input.targetStatus, reason: input.reason },
        actorId: admin?.id,
      }).catch(() => {});
      return new Response(`<div class="toast toast-success">Order status updated to ${escapeHtml(String(input.targetStatus))}</div>`, {
        headers: { "HX-Refresh": "true" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return `<div class="toast toast-error">${escapeHtml(msg)}</div>`;
    }
  }, { body: t.Object({ targetStatus: t.String({ maxLength: 30 }), reason: t.Optional(t.String({ maxLength: 500 })) }) });
