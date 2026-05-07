import { Elysia, t } from "elysia";
import { getPaymentProvider } from "../application/provider.ts";
import { finalizePaymentAttemptFromProvider } from "../application/finalize.ts";
import { MercadoPagoProvider } from "../infrastructure/mercadopago-provider.ts";
import { WebPayProvider } from "../infrastructure/webpay-provider.ts";
import * as repo from "../infrastructure/repository.ts";
import { renderView } from "../../../web/templates/engine.ts";

function renderRejected(orderId: string, message: string, title = "Pago rechazado") {
  const bodyHtml = renderView("pages/storefront/checkout-success.eta", {
    title,
    paymentStatus: "rejected",
    message,
    orderId,
  });
  return renderView("layouts/base.eta", { body: bodyHtml, title });
}

function renderPending(orderId: string, message: string) {
  const bodyHtml = renderView("pages/storefront/checkout-success.eta", {
    title: "Pago pendiente",
    paymentStatus: "pending",
    message,
    orderId,
  });
  return renderView("layouts/base.eta", { body: bodyHtml, title: "Pago pendiente" });
}

function redirectSuccess(orderId: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/checkout/success?order=${orderId}` },
  });
}

export const paymentReturnRoutes = new Elysia({ prefix: "/checkout/return" })
  .get("/mercadopago", async ({ query }) => {
    const status = (query as Record<string, string>).status ?? "unknown";
    const orderId = (query as Record<string, string>).order_id ?? "";
    const paymentId = (query as Record<string, string>).payment_id ?? "";

    if (status === "success" && paymentId) {
      const provider = getPaymentProvider();
      if (provider instanceof MercadoPagoProvider) {
        const result = await provider.fetchPaymentStatus(paymentId);
        if (!result) {
          return renderPending(orderId, "No se pudo verificar el estado del pago.");
        }

        const mpData = result.metadata as Record<string, unknown>;
        const externalRef = mpData.external_reference as string | undefined;
        if (!externalRef) {
          return renderPending(orderId, "El pago no tiene referencia externa.");
        }

        const order = await repo.findOrderById(externalRef);
        if (!order) {
          return renderPending(externalRef, "Orden no encontrada para la referencia del pago.");
        }

        if (result.status === "approved") {
          const attempts = await repo.findPaymentAttemptsByOrderId(externalRef);
          const active = attempts.find(
            (a) => a.status === "pending" || a.status === "processing",
          );

          if (
            !active
            || active.provider !== "mercadopago"
            || active.amountCents !== order.totalCents
            || active.currency !== order.currency
          ) {
            return renderPending(externalRef, "No se encontro un intento de pago valido para esta orden.");
          }

          const mpResultMeta = result.metadata as Record<string, unknown>;
          const mpAmount = Number(mpResultMeta.transaction_amount ?? 0) * 100;
          const mpCurrency = String(mpResultMeta.currency_id ?? "");
          if (mpAmount > 0 && Math.round(mpAmount) !== active.amountCents) {
            return renderRejected(externalRef, "El monto del pago no coincide con la orden.");
          }
          if (mpCurrency && mpCurrency !== active.currency) {
            return renderRejected(externalRef, "La moneda del pago no coincide con la orden.");
          }

          const mpMetadata = active.metadata as Record<string, unknown> | null;
          const activePreferenceId = String(mpMetadata?.preferenceId ?? active.providerIntentId);
          if (activePreferenceId && result.metadata) {
            const mpResult = result.metadata as Record<string, unknown>;
            const resultPreferenceId = String(mpResult.preference_id ?? "");
            if (resultPreferenceId && resultPreferenceId !== activePreferenceId) {
              return renderPending(externalRef, "El pago no corresponde al intento activo.");
            }
          }

          await finalizePaymentAttemptFromProvider({
            attemptId: active.id,
            newStatus: "approved",
            eventType: "mp_return_approved",
            providerEventId: `mp_return_${paymentId}`,
            payload: { paymentId, providerStatus: result.status, externalReference: externalRef },
          });
          return redirectSuccess(externalRef);
        }
      }
    }

    if (status === "failure") {
      if (orderId) {
        const attempts = await repo.findPaymentAttemptsByOrderId(orderId);
        const active = attempts.find(
          (a) => a.status === "pending" || a.status === "processing",
        );
        if (active && active.provider === "mercadopago") {
          await finalizePaymentAttemptFromProvider({
            attemptId: active.id,
            newStatus: "rejected",
            eventType: "mp_return_rejected",
            providerEventId: `mp_return_${paymentId || "unknown"}`,
            payload: { paymentId, providerStatus: status },
          });
        }
      }
      return renderRejected(orderId, "El pago fue rechazado. Intenta con otro medio de pago.");
    }

    return renderPending(orderId, "Tu pago esta siendo procesado. Te notificaremos cuando se confirme.");
  })
  .get("/webpay", async ({ query }) => {
    return handleWebPayReturn(query as Record<string, string>);
  })
  .post("/webpay", async ({ body }) => {
    return handleWebPayReturn(body as Record<string, string>);
  }, {
    body: t.Object({
      token_ws: t.Optional(t.String({ maxLength: 256 })),
    }),
  });

async function handleWebPayReturn(params: Record<string, string>) {
  const tokenWs = params.token_ws ?? "";

  if (!tokenWs) {
    return new Response(null, { status: 302, headers: { Location: "/cart" } });
  }

  const attempt = await repo.findPaymentAttemptByProviderIntentId(tokenWs);
  if (!attempt) {
    return renderRejected("", "No se encontro un intento de pago para este token.");
  }

  if (attempt.status === "approved") {
    return redirectSuccess(attempt.orderId);
  }

  if (attempt.provider !== "webpay") {
    return renderRejected(attempt.orderId, "El intento de pago no corresponde a WebPay.");
  }

  if (attempt.status !== "pending" && attempt.status !== "processing") {
    return renderRejected(attempt.orderId, "El intento de pago ya no esta activo.");
  }

  const order = await repo.findOrderById(attempt.orderId);
  if (!order) {
    return renderRejected(attempt.orderId, "Orden no encontrada.");
  }

  if (attempt.amountCents !== order.totalCents || attempt.currency !== order.currency) {
    return renderRejected(attempt.orderId, "El monto o moneda del intento no coincide con la orden.");
  }

  const provider = getPaymentProvider();
  if (!(provider instanceof WebPayProvider)) {
    return redirectSuccess(attempt.orderId);
  }

  const result = await provider.commitTransaction(tokenWs);
  if (!result) {
    return renderRejected(attempt.orderId, "No se pudo confirmar la transaccion con WebPay.");
  }

  const commitData = result.metadata as Record<string, unknown>;

  const commitBuyOrder = String(commitData.buy_order ?? "");
  if (commitBuyOrder && commitBuyOrder !== attempt.orderId.slice(0, 26)) {
    return renderRejected(attempt.orderId, "La orden confirmada por WebPay no coincide.");
  }

  if (result.status === "approved") {
    const commitAmount = Number(commitData.amount);
    if (commitAmount !== attempt.amountCents / 100) {
      return renderRejected(attempt.orderId, "El monto confirmado por WebPay no coincide.");
    }

    await finalizePaymentAttemptFromProvider({
      attemptId: attempt.id,
      newStatus: "approved",
      eventType: "webpay_commit_approved",
      providerEventId: `webpay_commit_${tokenWs}`,
      payload: { tokenWs, providerStatus: result.status, metadata: result.metadata },
    });
    return redirectSuccess(attempt.orderId);
  }

  await finalizePaymentAttemptFromProvider({
    attemptId: attempt.id,
    newStatus: "rejected",
    eventType: "webpay_commit_rejected",
    providerEventId: `webpay_commit_${tokenWs}`,
    payload: { tokenWs, providerStatus: result.status, metadata: result.metadata },
  });

  return renderRejected(attempt.orderId, "Transaccion rechazada por WebPay. Intenta nuevamente.");
}
