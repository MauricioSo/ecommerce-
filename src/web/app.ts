import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import { getConfig } from "../shared/infrastructure/config.ts";
import { createLogger, runWithContext, type LogContext } from "../shared/infrastructure/logger/index.ts";
import { renderView } from "./templates/engine.ts";
import { catalogAdminRoutes } from "../presentation/catalog/admin-routes.ts";
import { inventoryAdminRoutes } from "../presentation/inventory/admin-routes.ts";
import { pricingAdminRoutes } from "../presentation/pricing/admin-routes.ts";
import { checkoutStorefrontRoutes } from "../presentation/checkout/storefront-routes.ts";
import { paymentWebhookRoutes, paymentAdminRoutes } from "../presentation/payments/routes.ts";
import { paymentReturnRoutes } from "../presentation/payments/return-routes.ts";
import { orderAdminRoutes } from "../presentation/orders/admin-routes.ts";
import { orderStorefrontRoutes } from "../presentation/orders/storefront-routes.ts";
import { getDashboardDataUseCase } from "../application/orders/use-cases.ts";
import { adminAuthPlugin, adminLoginRoutes } from "./middleware/admin-auth.ts";
import { storefrontRoutes } from "./routes/storefront.ts";
import { fulfillmentAdminRoutes } from "../presentation/fulfillment/admin-routes.ts";
import { crmAdminRoutes } from "../presentation/crm/admin-routes.ts";
import { stylistStorefrontRoutes } from "./composition/stylist.ts";
import { fulfillmentStorefrontRoutes } from "../presentation/fulfillment/storefront-routes.ts";
import { customerSessionPlugin } from "./middleware/customer-session.ts";
import { storefrontAuthRoutes } from "../presentation/customers/storefront-auth-routes.ts";
import { storefrontAccountRoutes } from "../presentation/customers/storefront-account-routes.ts";
import { securityHeadersPlugin } from "./middleware/security-headers.ts";
import { rateLimitPlugin } from "./middleware/rate-limit.ts";
import { csrfPlugin } from "./middleware/csrf.ts";
import { ensureCsrfToken } from "./helpers/csrf.ts";
import { sanitizeInputPlugin } from "./middleware/sanitize-input.ts";
import { metrics, recordHttpRequest } from "../shared/infrastructure/metrics.ts";
import { getPool } from "../shared/infrastructure/db/index.ts";

const config = getConfig();
const logger = createLogger(config.LOG_LEVEL);

export function createApp() {
  const app = new Elysia()
    .use(html())
    .use(securityHeadersPlugin)
    .use(rateLimitPlugin)
    .use(
      staticPlugin({
        assets: "./src/web/static",
        prefix: "/static",
      })
    )
    .onRequest(({ request }) => {
      const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
      const ctx: LogContext = { correlationId };
      return runWithContext(ctx, () => {
        (request as unknown as Record<string, unknown>).__startTime = Date.now();
        (request as unknown as Record<string, unknown>).__correlationId = correlationId;
        const setHeader = new Headers();
        setHeader.set("x-correlation-id", correlationId);
      });
    })
    .onAfterHandle(({ request, set }) => {
      const req = request as unknown as Record<string, unknown>;
      const startTime = req.__startTime as number | undefined;
      const correlationId = req.__correlationId as string | undefined;
      const duration = startTime ? Date.now() - startTime : -1;
      const status = typeof set.status === "number" ? set.status : 200;
      const url = new URL(request.url).pathname;

      if (set.headers && !set.headers["x-correlation-id"] && correlationId) {
        set.headers["x-correlation-id"] = correlationId;
      }

      if (!url.startsWith("/static/") && !url.startsWith("/favicon")) {
        recordHttpRequest(request.method, url, status, duration);
        const lvl = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
        if (lvl === "error") {
          logger.error("Request completed", { method: request.method, url, statusCode: status, duration, correlationId });
        } else if (lvl === "warn") {
          logger.warn("Request completed", { method: request.method, url, statusCode: status, duration, correlationId });
        } else {
          logger.info("Request completed", { method: request.method, url, statusCode: status, duration, correlationId });
        }
      }
    })
    .onError(({ request, error, set, code }) => {
      const req = request as unknown as Record<string, unknown>;
      const startTime = req.__startTime as number | undefined;
      const correlationId = req.__correlationId as string | undefined;
      const duration = startTime ? Date.now() - startTime : -1;
      const url = new URL(request.url).pathname;
      const status = typeof set.status === "number" ? set.status : 500;

      recordHttpRequest(request.method, url, status, duration);

      logger.error("Unhandled error", {
        method: request.method,
        url,
        statusCode: status,
        duration,
        correlationId,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
        code,
      });

      if (config.NODE_ENV === "production") {
        return new Response("Internal Server Error", { status: 500 });
      }
      return new Response(
        `Internal Server Error\n\n${error instanceof Error ? error.stack : String(error)}`,
        { status: 500, headers: { "Content-Type": "text/plain" } }
      );
    })
    .use(customerSessionPlugin)
    .use(sanitizeInputPlugin)
    .use(csrfPlugin)
    .use(storefrontRoutes)
    .use(storefrontAuthRoutes)
    .use(storefrontAccountRoutes)
    .use(checkoutStorefrontRoutes)
    .use(paymentReturnRoutes)
    .use(orderStorefrontRoutes)
    .use(fulfillmentStorefrontRoutes)
    .use(stylistStorefrontRoutes)
    .use(adminLoginRoutes)
    .use(adminAuthPlugin)
    .get("/admin", async ({ cookie }) => {
      const csrfToken = ensureCsrfToken(cookie);
      const dashboard = await getDashboardDataUseCase();
      const body = renderView("pages/admin/dashboard.eta", { dashboard });
      return renderView("layouts/admin.eta", { body, title: "Dashboard", csrfToken });
    })
    .use(orderAdminRoutes)
    .use(catalogAdminRoutes)
    .use(inventoryAdminRoutes)
    .use(pricingAdminRoutes)
    .use(paymentAdminRoutes)
    .use(paymentWebhookRoutes)
    .use(fulfillmentAdminRoutes)
    .use(crmAdminRoutes)
    .get("/metrics", () => {
      return new Response(metrics.format(), {
        headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
      });
    })
    .get("/health", async () => {
      const checks: Record<string, { status: string; latencyMs?: number; error?: string; [k: string]: unknown }> = {};

      const dbStart = Date.now();
      try {
        const client = await getPool().connect();
        try {
          await client.query("SELECT 1");
          checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
        } finally {
          client.release();
        }
      } catch (e) {
        checks.database = { status: "unhealthy", error: (e as Error).message };
      }

      const overallStatus = Object.values(checks).every((c) => c.status === "ok") ? "ok" : "unhealthy";
      return { status: overallStatus, timestamp: new Date().toISOString(), checks, version: config.APP_VERSION };
    })
    .get("/health/ready", async () => {
      try {
        const client = await getPool().connect();
        try { await client.query("SELECT 1"); } finally { client.release(); }
        return { status: "ready" };
      } catch {
        return new Response(JSON.stringify({ status: "not ready" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
    })
    .get("/health/live", () => ({ status: "alive" }));

  return app;
}
