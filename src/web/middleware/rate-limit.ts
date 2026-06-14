import Elysia from "elysia";
import { getConfig } from "../../shared/infrastructure/config.ts";

type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;

const config = getConfig();
const RATE_LIMIT_SCALE = config.RATE_LIMIT_SCALE;

const RATE_LIMITS: Record<string, { paths: Set<string>; max: number }> = {
  adminAuth: { paths: new Set(["/admin/login"]), max: 5 * RATE_LIMIT_SCALE },
  auth: { paths: new Set(["/cuenta/login", "/cuenta/registro", "/cuenta/recuperar"]), max: 10 * RATE_LIMIT_SCALE },
  cart: { paths: new Set(["/cart/add", "/cart/update", "/cart/remove"]), max: 20 * RATE_LIMIT_SCALE },
  checkout: { paths: new Set(["/checkout/direccion", "/checkout/envio", "/checkout/confirmar", "/checkout/retry"]), max: 10 * RATE_LIMIT_SCALE },
  search: { paths: new Set(["/api/search/suggest"]), max: 30 * RATE_LIMIT_SCALE },
  webhook: { paths: new Set(["/webhooks/payments"]), max: 100 * RATE_LIMIT_SCALE },
};

const GLOBAL_MAX = 120 * RATE_LIMIT_SCALE;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

function findLimit(path: string): { bucket: string; max: number } | null {
  for (const [bucket, config] of Object.entries(RATE_LIMITS)) {
    if (config.paths.has(path)) return { bucket, max: config.max };
  }
  return null;
}

export const rateLimitPlugin = new Elysia({ name: "rate-limit" })
  .onBeforeHandle(({ request, set }) => {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
    const path = new URL(request.url).pathname;
    const specific = findLimit(path);
    const limit = specific?.max ?? GLOBAL_MAX;
    const key = `${ip}:${specific?.bucket ?? "global"}`;

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + WINDOW_MS });
      set.headers["X-RateLimit-Limit"] = String(limit);
      set.headers["X-RateLimit-Remaining"] = String(limit - 1);
      return;
    }

    entry.count++;
    if (entry.count > limit) {
      const headers = {
        "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      };
      set.status = 429;
      set.headers = headers;
      return new Response("Too many requests. Please try again later.", { status: 429, headers });
    }

    set.headers["X-RateLimit-Limit"] = String(limit);
    set.headers["X-RateLimit-Remaining"] = String(limit - entry.count);
  })
  .as("global");
