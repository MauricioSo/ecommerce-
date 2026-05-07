import Elysia from "elysia";
import { ensureCsrfToken } from "../helpers/csrf.ts";

const CSRF_COOKIE_NAME = "_csrf";
const CSRF_HEADER = "x-csrf-token";
const CSRF_BODY_FIELD = "csrfToken";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PREFIXES = ["/webhooks/", "/health"];

function isExempt(pathname: string): boolean {
  for (const prefix of EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

export const csrfPlugin = new Elysia({ name: "csrf" })
  .derive(({ cookie }) => {
    const token = ensureCsrfToken(cookie);
    return { csrfToken: token };
  })
  .onBeforeHandle(({ request, cookie, body, set }) => {
    if (SAFE_METHODS.has(request.method.toUpperCase())) return;

    const path = new URL(request.url).pathname;
    if (isExempt(path)) return;

    const cookieToken = cookie[CSRF_COOKIE_NAME]?.value as string | undefined;
    if (!cookieToken) {
      set.status = 403;
      return new Response("CSRF cookie missing", { status: 403 });
    }

    const headerToken = request.headers.get(CSRF_HEADER);
    if (headerToken && headerToken === cookieToken) return;

    if (body && typeof body === "object" && !Array.isArray(body)) {
      const bodyToken = (body as Record<string, unknown>)[CSRF_BODY_FIELD];
      if (bodyToken && typeof bodyToken === "string" && bodyToken === cookieToken) return;
    }

    set.status = 403;
    return new Response("CSRF token mismatch", { status: 403 });
  })
  .as("global");
