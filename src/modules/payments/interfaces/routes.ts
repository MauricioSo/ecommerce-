import { Elysia } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import * as uc from "../application/use-cases.ts";
import * as recon from "../application/reconciliation.ts";

import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";

export const paymentWebhookRoutes = new Elysia({ prefix: "/webhooks" })
  .post("/payments", async ({ request }) => {
    const rawBody = await new Response(request.body).text();
    const signature = request.headers.get("x-signature") ?? null;
    const requestId = request.headers.get("x-request-id") ?? undefined;
    let dataId: string | undefined;
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      dataId = ((parsed as Record<string, unknown>)?.data as Record<string, unknown> | undefined)?.id as string | undefined;
    } catch {}
    const result = await uc.handleWebhookUseCase(rawBody, signature, requestId, dataId);
    return result;
  });

export const paymentAdminRoutes = new Elysia({ prefix: "/admin/payments" })
  .get("/", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const payments = await uc.getPaymentList();
    const body = renderView("pages/admin/payments.eta", { payments, title: "Payments", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "Payments", csrfToken });
  })
  .get("/reconciliation", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const [stale, orphans] = await Promise.all([
      recon.findStalePendingPayments(30),
      recon.findApprovedPaymentsWithoutConfirmedOrder(),
    ]);
    const body = renderView("pages/admin/reconciliation.eta", { stale, orphans, title: "Reconciliation", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "Reconciliation", csrfToken });
  })
  .post("/reconciliation/run", async () => {
    const [orphansResult, staleResult] = await Promise.all([
      recon.reconcileOrphanedPayments(),
      recon.failStalePendingPayments(60),
    ]);
    return `<div class="toast toast-success">Reconciled: ${orphansResult.fixed} orphaned fixed, ${staleResult.failed} stale failed</div>`;
  });
