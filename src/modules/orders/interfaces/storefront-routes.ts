import { Elysia, t } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import * as orderUc from "../application/use-cases.ts";
import * as trackingUc from "../../fulfillment/application/tracking-use-cases.ts";
import { retryPaymentForOrderUseCase } from "../../checkout/application/use-cases.ts";

import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";

export const orderStorefrontRoutes = new Elysia()
  .get("/orders/:id", async ({ params, query, cookie }) => {
    let order;
    try {
      order = await orderUc.getOrderDetailUseCase(params.id);
    } catch {
      return new Response("Order not found", { status: 404 });
    }
    const token = (query as Record<string, string>).token ?? "";
    if (!order.publicToken || token !== order.publicToken) {
      return new Response("Order not found", { status: 404 });
    }
    const csrfToken = ensureCsrfToken(cookie);
    const timeline = await orderUc.getOrderTimelineUseCase(params.id);
    const latestPayment = order.payments?.[0] ?? null;
    const trackingInfo = await trackingUc.getPublicOrderTrackingUseCase(order.publicToken);
    const body = renderView("pages/storefront/order-status.eta", {
      order,
      orderPublicToken: order.publicToken,
      timeline,
      latestPayment,
      trackingInfo,
      title: `Order ${order.id.substring(0, 8)}`,
      csrfToken,
    });
    return renderView("layouts/base.eta", { body, title: `Order ${order.id.substring(0, 8)}`, csrfToken });
  })
  .post("/orders/:id/retry-payment", async ({ params, body, cookie }) => {
    let order;
    try {
      order = await orderUc.getOrderDetailUseCase(params.id);
    } catch {
      return new Response("Order not found", { status: 404 });
    }
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    if (input.token !== order.publicToken) return new Response("Order not found", { status: 404 });
    if (order.status !== "payment_pending" && order.status !== "payment_failed") return new Response(null, { status: 302, headers: { Location: `/orders/${params.id}?token=${order.publicToken}` } });

    const result = await retryPaymentForOrderUseCase({
      orderId: params.id,
      publicToken: order.publicToken,
    });

    if (result.paymentStatus === "approved") {
      return new Response(null, { status: 302, headers: { Location: `/orders/${params.id}?token=${order.publicToken}` } });
    }

    const csrfToken = ensureCsrfToken(cookie);
    const bodyHtml = renderView("pages/storefront/checkout-success.eta", {
      orderId: params.id,
      orderPublicToken: order.publicToken,
      paymentStatus: result.paymentStatus,
      paymentAttemptId: result.paymentAttemptId,
      totalCents: order.totalCents,
      currency: order.currency,
      title: "Payment Result",
      csrfToken,
    });
    return renderView("layouts/base.eta", { body: bodyHtml, title: "Payment Result", csrfToken });
  }, { body: t.Object({ token: t.String({ maxLength: 256 }), paymentAttemptId: t.Optional(t.String({ maxLength: 64 })) }) });
