import { Elysia } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import * as uc from "../application/use-cases.ts";
import * as recon from "../application/reconciliation.ts";

import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";
import { getAdminUserFromCookie } from "../../../web/middleware/admin-auth.ts";
import { writeAuditEvent } from "../../../shared/infrastructure/audit.ts";
import { getConfig } from "../../../shared/infrastructure/config.ts";

export function isWebhookIpAllowed(request: Request): boolean {
  const config = getConfig();
  const allowlist = config.PAYMENT_WEBHOOK_IP_ALLOWLIST.split(",").map((ip) => ip.trim()).filter(Boolean);
  if (allowlist.length === 0) return config.NODE_ENV !== "production" && config.NODE_ENV !== "staging";

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "";
  return allowlist.includes(ip);
}

export const paymentWebhookRoutes = new Elysia({ prefix: "/webhooks" })
  .post("/payments", async ({ request }) => {
    if (!isWebhookIpAllowed(request)) {
      return new Response(JSON.stringify({ processed: false, reason: "ip_not_allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    const rawBody = await request.text();
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
  .post("/reconciliation/run", async ({ cookie }) => {
    const admin = await getAdminUserFromCookie(cookie);
    const [orphansResult, staleResult] = await Promise.all([
      recon.reconcileOrphanedPayments(),
      recon.failStalePendingPayments(60),
    ]);
    await writeAuditEvent({
      aggregateType: "payment",
      aggregateId: "reconciliation",
      eventType: "admin.reconciliation.run",
      payload: { orphanedFixed: orphansResult.fixed, staleFailed: staleResult.failed },
      actorId: admin?.id,
    }).catch(() => {});
    return `<div class="toast toast-success">Reconciled: ${orphansResult.fixed} orphaned fixed, ${staleResult.failed} stale failed</div>`;
  });
