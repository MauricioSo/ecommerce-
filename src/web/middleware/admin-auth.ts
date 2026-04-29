import { Elysia, t } from "elysia";
import { renderView } from "../templates/engine.ts";
import { authenticateAdminUseCase, getAdminUserFromSession, seedSuperAdmin } from "../../modules/admin/application/use-cases.ts";
import { hasPermission } from "../../modules/admin/infrastructure/repository.ts";
import { type Permission } from "../../shared/infrastructure/db/schema.ts";
import { ensureCsrfToken } from "../helpers/csrf.ts";

const ADMIN_BOOTSTRAP_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_BOOTSTRAP_PASSWORD = process.env.ADMIN_PASSWORD;
const SHOULD_BOOTSTRAP_ADMIN = process.env.NODE_ENV !== "production" && Boolean(ADMIN_BOOTSTRAP_EMAIL && ADMIN_BOOTSTRAP_PASSWORD);

if (SHOULD_BOOTSTRAP_ADMIN && ADMIN_BOOTSTRAP_EMAIL && ADMIN_BOOTSTRAP_PASSWORD) {
  seedSuperAdmin(ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD).catch(() => {});
}

const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/admin/payments/reconciliation": "reconciliation:run",
  "/admin": "orders:read",
  "/admin/products": "catalog:read",
  "/admin/categories": "catalog:read",
  "/admin/inventory": "inventory:read",
  "/admin/orders": "orders:read",
  "/admin/payments": "payments:read",
  "/admin/promotions": "promotions:read",
  "/admin/fulfillment": "orders:read",
  "/admin/crm": "crm:read",
};

function getRequiredPermission(path: string): Permission | null {
  const entries = Object.entries(ROUTE_PERMISSIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, perm] of entries) {
    if (path.startsWith(prefix)) return perm;
  }
  return null;
}

function isWriteAction(path: string, method: string): boolean {
  if (method !== "POST") return false;
  return !path.endsWith("/login") && !path.endsWith("/logout");
}

export const adminAuthPlugin = new Elysia({ name: "admin-auth" })
  .onBeforeHandle(async ({ cookie, path, request, set }) => {
    if (!path.startsWith("/admin")) return;
    if (path === "/admin/login" && request.method === "GET") return;
    if (path === "/admin/login" && request.method === "POST") return;
    if (path.startsWith("/health")) return;
    if (path.startsWith("/webhooks")) return;

    const sessionValue = cookie.admin_session?.value as string | undefined;
    const user = await getAdminUserFromSession(sessionValue);
    if (!user) {
      if (request.headers.get("hx-request") === "true") {
        set.status = 401;
        return "Unauthorized";
      }
      set.redirect = "/admin/login";
      return;
    }

    const requiredPerm = getRequiredPermission(path);
    if (requiredPerm && !hasPermission(user.role, requiredPerm)) {
      set.status = 403;
      return "Forbidden: insufficient permissions";
    }

    if (isWriteAction(path, request.method)) {
      const writePerm = requiredPerm?.replace(":read", ":write") as Permission | null;
      if (writePerm && !hasPermission(user.role, writePerm)) {
        set.status = 403;
        return "Forbidden: insufficient permissions for write action";
      }
    }
  });

export const adminLoginRoutes = new Elysia({ prefix: "/admin" })
  .get("/login", ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const body = renderView("pages/admin/login.eta", { csrfToken });
    return renderView("layouts/admin.eta", { body, title: "Login", csrfToken });
  })
  .post("/login", async ({ body, cookie, set }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const user = await authenticateAdminUseCase(body.email, body.password);
    if (user) {
      cookie.admin_session?.set?.({
        value: user.id,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
      return new Response(null, { status: 302, headers: { Location: "/admin" } });
    }
    const pageBody = renderView("pages/admin/login.eta", { error: "Invalid email or password", csrfToken });
    return renderView("layouts/admin.eta", { body: pageBody, title: "Login", csrfToken });
  }, {
    body: t.Object({ email: t.String(), password: t.String(), csrfToken: t.Optional(t.String()) }),
  })
  .post("/logout", ({ cookie }) => {
    cookie.admin_session?.remove?.();
    return new Response(null, { status: 302, headers: { Location: "/admin/login" } });
  });
