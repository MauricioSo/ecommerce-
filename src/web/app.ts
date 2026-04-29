import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import { getConfig } from "../shared/infrastructure/config.ts";
import { createLogger } from "../shared/infrastructure/logger/index.ts";
import { renderView } from "./templates/engine.ts";
import { catalogAdminRoutes } from "../modules/catalog/interfaces/admin-routes.ts";
import { inventoryAdminRoutes } from "../modules/inventory/interfaces/admin-routes.ts";
import { pricingAdminRoutes } from "../modules/pricing/interfaces/admin-routes.ts";
import { checkoutStorefrontRoutes } from "../modules/checkout/interfaces/storefront-routes.ts";
import { paymentWebhookRoutes, paymentAdminRoutes } from "../modules/payments/interfaces/routes.ts";
import { paymentReturnRoutes } from "../modules/payments/interfaces/return-routes.ts";
import { orderAdminRoutes } from "../modules/orders/interfaces/admin-routes.ts";
import { orderStorefrontRoutes } from "../modules/orders/interfaces/storefront-routes.ts";
import { getDashboardDataUseCase } from "../modules/orders/application/use-cases.ts";
import { adminAuthPlugin, adminLoginRoutes } from "./middleware/admin-auth.ts";
import { storefrontRoutes } from "./routes/storefront.ts";
import { fulfillmentAdminRoutes } from "../modules/fulfillment/interfaces/admin-routes.ts";
import { crmAdminRoutes } from "../modules/crm/interfaces/admin-routes.ts";
import { fulfillmentStorefrontRoutes } from "../modules/fulfillment/interfaces/storefront-routes.ts";
import { customerSessionPlugin } from "./middleware/customer-session.ts";
import { storefrontAuthRoutes } from "../modules/customers/interfaces/storefront-auth-routes.ts";
import { storefrontAccountRoutes } from "../modules/customers/interfaces/storefront-account-routes.ts";
import { securityHeadersPlugin } from "./middleware/security-headers.ts";
import { rateLimitPlugin } from "./middleware/rate-limit.ts";
import { csrfPlugin } from "./middleware/csrf.ts";
import { ensureCsrfToken } from "./helpers/csrf.ts";

const config = getConfig();
const logger = createLogger(config.LOG_LEVEL);

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
    const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
    logger.info("Incoming request", {
      method: request.method,
      url: request.url,
      correlationId,
    });
  })
  .use(customerSessionPlugin)
  .use(csrfPlugin)
  .use(storefrontRoutes)
  .use(storefrontAuthRoutes)
  .use(storefrontAccountRoutes)
  .use(checkoutStorefrontRoutes)
  .use(paymentReturnRoutes)
  .use(orderStorefrontRoutes)
  .use(fulfillmentStorefrontRoutes)
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
  .get("/health", async () => {
    const { healthCheck } = await import("../shared/infrastructure/db/index.ts");
    const dbOk = await healthCheck().catch(() => false);
    return { status: dbOk ? "ok" : "degraded", timestamp: new Date().toISOString() };
  })
  .listen({ port: config.PORT });

logger.info(`Server started on port ${config.PORT}`, {
  env: config.NODE_ENV,
  port: config.PORT,
});

export type App = typeof app;
