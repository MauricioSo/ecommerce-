import { Elysia, t } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import { registerCustomer, loginCustomer, logoutCustomer, requestPasswordReset, resetPassword } from "../application/auth-use-cases.ts";
import { customerSessionPlugin } from "../../../web/middleware/customer-session.ts";
import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";

function safeRedirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

function sanitizeNext(next: unknown): string {
  if (typeof next !== "string") return "/cuenta";
  if (!next.startsWith("/")) return "/cuenta";
  if (next.startsWith("//")) return "/cuenta";
  if (next.toLowerCase().startsWith("http")) return "/cuenta";
  return next;
}

export const storefrontAuthRoutes = new Elysia({ prefix: "/cuenta" })
  .use(customerSessionPlugin)
  .get("/login", async ({ customer, query, cookie }) => {
    if (customer) return safeRedirect("/cuenta");
    const csrfToken = ensureCsrfToken(cookie);
    const next = sanitizeNext(query?.next);
    const body = renderView("pages/storefront/auth/login.eta", { error: null, next, csrfToken });
    return renderView("layouts/base.eta", { body, title: "Iniciar sesion", csrfToken });
  })
  .post("/login", async ({ body, cookie, request }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const email = input.email as string ?? "";
    const password = input.password as string ?? "";
    const next = sanitizeNext(input.next);
    try {
      const result = await loginCustomer({
        email,
        password,
        ip: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
      cookie._session?.set?.({
        value: result.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      // Clear any anonymous/previous-user cart so cart-session resolves the correct one
      cookie._cart?.set?.({ value: "", maxAge: 0, path: "/" });
      return safeRedirect(next);
    } catch {
      const pageBody = renderView("pages/storefront/auth/login.eta", { error: "Email o contrasena incorrectos", email, next, csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Iniciar sesion", csrfToken });
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      csrfToken: t.Optional(t.String()),
      next: t.Optional(t.String()),
    }),
  })
  .get("/registro", async ({ customer, cookie }) => {
    if (customer) return safeRedirect("/cuenta");
    const csrfToken = ensureCsrfToken(cookie);
    const body = renderView("pages/storefront/auth/register.eta", { error: null, csrfToken });
    return renderView("layouts/base.eta", { body, title: "Crear cuenta", csrfToken });
  })
  .post("/registro", async ({ body, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const email = input.email as string ?? "";
    const password = input.password as string ?? "";
    const passwordConfirm = input.passwordConfirm as string ?? "";
    const firstName = input.firstName as string ?? "";
    const lastName = input.lastName as string ?? "";
    const country = input.country as string ?? "CHL";
    if (password !== passwordConfirm) {
      const pageBody = renderView("pages/storefront/auth/register.eta", { error: "Las contrasenas no coinciden", email, firstName, lastName, country, csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Crear cuenta", csrfToken });
    }
    if (password.length < 8 || !/\d/.test(password)) {
      const pageBody = renderView("pages/storefront/auth/register.eta", { error: "La contrasena debe tener al menos 8 caracteres y 1 numero", email, firstName, lastName, country, csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Crear cuenta", csrfToken });
    }
    try {
      await registerCustomer({ email, password, firstName, lastName, countryCode: country });
      const result = await loginCustomer({ email, password });
      cookie._session?.set?.({
        value: result.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      cookie._cart?.set?.({ value: "", maxAge: 0, path: "/" });
      return safeRedirect("/cuenta");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al crear la cuenta";
      const pageBody = renderView("pages/storefront/auth/register.eta", { error: msg, email, firstName, lastName, country, csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Crear cuenta", csrfToken });
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      passwordConfirm: t.String(),
      firstName: t.Optional(t.String()),
      lastName: t.Optional(t.String()),
      country: t.Optional(t.String()),
      csrfToken: t.Optional(t.String()),
    }),
  })
  .post("/logout", async ({ cookie }) => {
    const token = cookie._session?.value as string | undefined;
    if (token) {
      await logoutCustomer(token).catch(() => {});
    }
    cookie._session?.set?.({ value: "", maxAge: 0, path: "/" });
    cookie._cart?.set?.({ value: "", maxAge: 0, path: "/" });
    return safeRedirect("/");
  }, {
    body: t.Optional(t.Object({ csrfToken: t.Optional(t.String()) })),
  })
  .get("/recuperar", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const body = renderView("pages/storefront/auth/recover.eta", { success: false, csrfToken });
    return renderView("layouts/base.eta", { body, title: "Recuperar contrasena", csrfToken });
  })
  .post("/recuperar", async ({ body, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const email = input.email as string ?? "";
    await requestPasswordReset(email);
    const pageBody = renderView("pages/storefront/auth/recover.eta", { success: true, csrfToken });
    return renderView("layouts/base.eta", { body: pageBody, title: "Recuperar contrasena", csrfToken });
  }, {
    body: t.Object({ email: t.String(), csrfToken: t.Optional(t.String()) }),
  })
  .get("/reset/:token", async ({ params, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const body = renderView("pages/storefront/auth/reset.eta", { token: params.token, error: null, csrfToken });
    return renderView("layouts/base.eta", { body, title: "Nueva contrasena", csrfToken });
  })
  .post("/reset/:token", async ({ params, body, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const password = input.password as string ?? "";
    const passwordConfirm = input.passwordConfirm as string ?? "";
    if (password !== passwordConfirm || password.length < 8) {
      const pageBody = renderView("pages/storefront/auth/reset.eta", { token: params.token, error: "Las contrasenas no coinciden o son muy cortas", csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Nueva contrasena", csrfToken });
    }
    try {
      await resetPassword(params.token, password);
      return safeRedirect("/cuenta/login?reset=success");
    } catch {
      const pageBody = renderView("pages/storefront/auth/reset.eta", { token: params.token, error: "Token invalido o expirado", csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Nueva contrasena", csrfToken });
    }
  }, {
    body: t.Object({
      password: t.String(),
      passwordConfirm: t.String(),
      csrfToken: t.Optional(t.String()),
    }),
  });
