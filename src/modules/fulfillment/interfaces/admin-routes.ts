import { Elysia, t } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import * as uc from "../application/use-cases.ts";
import * as trackingUc from "../application/tracking-use-cases.ts";

import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";
import { escapeHtml } from "../../../web/helpers/escape.ts";

export const fulfillmentAdminRoutes = new Elysia({ prefix: "/admin/fulfillment" })
  .get("/shipments/:orderId", async ({ params, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const shipment = await uc.getOrderShipment(params.orderId);
    const events = shipment ? await uc.getShipmentEvents(shipment.id) : [];
    const body = renderView("pages/admin/shipment-detail.eta", { shipment, events, orderId: params.orderId, title: "Shipment", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "Shipment", csrfToken });
  })
  .post("/shipments", async ({ body }) => {
    try {
      await trackingUc.createShipmentWithEventUseCase({ orderId: body.orderId, carrier: body.carrier || undefined });
      return new Response(null, { status: 302, headers: { Location: `/admin/orders/${body.orderId}` } });
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ orderId: t.String({ maxLength: 64 }), carrier: t.Optional(t.String({ maxLength: 100 })) }) })
  .post("/shipments/:id/status", async ({ params, body }) => {
    try {
      await trackingUc.updateShipmentStatusUseCase(params.id, body.targetStatus as any);
      return `<div class="toast toast-success">Shipment updated to ${escapeHtml(body.targetStatus)}</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ targetStatus: t.String({ maxLength: 30 }) }) })
  .post("/shipments/:id/tracking", async ({ params, body }) => {
    try {
      await trackingUc.updateShipmentTrackingUseCase({
        shipmentId: params.id,
        trackingCode: body.trackingCode,
        trackingUrl: body.trackingUrl,
        carrier: body.carrier,
      });
      return `<div class="toast toast-success">Tracking updated</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({
    trackingCode: t.String({ maxLength: 100 }),
    trackingUrl: t.Optional(t.String({ maxLength: 2048 })),
    carrier: t.Optional(t.String({ maxLength: 100 })),
    estimatedDeliveryDate: t.Optional(t.String({ maxLength: 30 })),
  }) })
  .get("/returns", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const returns = await uc.listAllReturns();
    const body = renderView("pages/admin/returns.eta", { returns, title: "Returns", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "Returns", csrfToken });
  })
  .post("/returns/:id/approve", async ({ params }) => {
    try {
      await uc.approveReturnUseCase(params.id);
      return `<div class="toast toast-success">Return approved</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  })
  .post("/returns/:id/reject", async ({ params }) => {
    try {
      await uc.rejectReturnUseCase(params.id);
      return `<div class="toast toast-success">Return rejected</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  });
