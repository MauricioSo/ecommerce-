import Elysia from "elysia";
import { getConfig } from "../../shared/infrastructure/config.ts";

export const securityHeadersPlugin = new Elysia({ name: "security-headers" })
  .onAfterHandle(({ set }) => {
    const isProd = getConfig().NODE_ENV === "production";
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["X-Frame-Options"] = "DENY";
    set.headers["X-XSS-Protection"] = "0";
    set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    set.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    set.headers["X-Permitted-Cross-Domain-Policies"] = "none";
    set.headers["Content-Security-Policy"] = [
      "default-src 'self'",
      `script-src 'self'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "form-action 'self' https://webpay3g.transbank.cl https://webpay3gint.transbank.cl https://mercadopago.com https://*.mercadopago.com",
      "frame-ancestors 'none'",
      isProd ? "upgrade-insecure-requests" : "",
    ].filter(Boolean).join("; ");
    if (isProd) {
      set.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
    }
  })
  .as("global");
