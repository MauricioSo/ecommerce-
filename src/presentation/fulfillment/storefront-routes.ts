import { Elysia, t } from "elysia";
import * as uc from "../../application/fulfillment/use-cases.ts";
import { escapeHtml } from "../../web/helpers/escape.ts";
import { findOrderByIdAndPublicToken } from "../../infrastructure/fulfillment/repository.ts";

export const fulfillmentStorefrontRoutes = new Elysia()
  .post("/orders/:id/returns", async ({ params, body }) => {
    try {
      const order = await findOrderByIdAndPublicToken(params.id, body.token);
      if (!order) {
        return new Response("Order not found", { status: 404 });
      }
      await uc.createReturnRequestUseCase({
        orderId: params.id,
        orderItemId: body.orderItemId,
        reason: body.reason,
      });
      return new Response(null, { status: 302, headers: { Location: `/orders/${params.id}?token=${body.token}` } });
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ token: t.String({ maxLength: 256 }), orderItemId: t.String({ maxLength: 64 }), reason: t.String({ maxLength: 500 }) }) });
