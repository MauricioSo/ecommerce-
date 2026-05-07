import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import * as uc from "../application/use-cases.ts";
import { escapeHtml } from "../../../web/helpers/escape.ts";

export const fulfillmentStorefrontRoutes = new Elysia()
  .post("/orders/:id/returns", async ({ params, body }) => {
    try {
      const orders = await getDb().select().from(s.orders).where(eq(s.orders.id, params.id));
      const order = orders[0];
      if (!order || body.token !== order.publicToken) {
        return new Response("Order not found", { status: 404 });
      }
      await uc.createReturnRequestUseCase({
        orderId: params.id,
        orderItemId: body.orderItemId,
        reason: body.reason,
      });
      return new Response(null, { status: 302, headers: { Location: `/orders/${params.id}?token=${order.publicToken}` } });
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, { body: t.Object({ token: t.String({ maxLength: 256 }), orderItemId: t.String({ maxLength: 64 }), reason: t.String({ maxLength: 500 }) }) });
