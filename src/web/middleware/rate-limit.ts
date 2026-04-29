import Elysia from "elysia";

type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const AUTH_MAX = 10;
const AUTH_PATHS = new Set(["/cuenta/login", "/cuenta/registro", "/cuenta/recuperar"]);

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

export const rateLimitPlugin = new Elysia({ name: "rate-limit" })
  .onBeforeHandle(({ request, set }) => {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
    const path = new URL(request.url).pathname;
    const isAuth = AUTH_PATHS.has(path);
    const limit = isAuth ? AUTH_MAX : MAX_REQUESTS;
    const key = `${ip}:${isAuth ? "auth" : "global"}`;

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return;
    }

    entry.count++;
    if (entry.count > limit) {
      set.status = 429;
      set.headers = {
        "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      };
      return "Too many requests. Please try again later.";
    }

    set.headers["X-RateLimit-Limit"] = String(limit);
    set.headers["X-RateLimit-Remaining"] = String(limit - entry.count);
  });
