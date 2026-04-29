import { Elysia } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import * as uc from "../application/use-cases.ts";
import * as fulfillmentUc from "../../fulfillment/application/use-cases.ts";
import { type OrderStatus } from "../domain/types.ts";

import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";

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
  .post("/:id/status", async ({ params, body }) => {
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    try {
      await uc.transitionOrderStatusUseCase({
        orderId: params.id,
        targetStatus: input.targetStatus as OrderStatus,
        reason: (input.reason as string) ?? undefined,
      });
      return new Response(`<div class="toast toast-success">Order status updated to ${input.targetStatus}</div>`, {
        headers: { "HX-Refresh": "true" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return `<div class="toast toast-error">${msg}</div>`;
    }
  });
