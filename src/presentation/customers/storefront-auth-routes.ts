import { Elysia, t } from "elysia";
import { renderView } from "../../web/templates/engine.ts";
import { registerCustomer, loginCustomer, logoutCustomer, requestPasswordReset, resetPassword } from "../../application/customers/auth-use-cases.ts";
import { customerSessionPlugin } from "../../web/middleware/customer-session.ts";
import { ensureCsrfToken } from "../../web/helpers/csrf.ts";
import { vs } from "../../web/schemas/validation.ts";
import { validatePasswordStrength } from "../../shared/domain/password.ts";
import { sendVerificationEmail, verifyEmail } from "../../application/customers/verify-email-use-cases.ts";
import { migrateGuestCartToCustomer } from "../../application/checkout/use-cases.ts";
import { verifySignedCookieValue } from "../../web/helpers/signed-cookie.ts";
import { getConfig } from "../../shared/infrastructure/config.ts";

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
      const guestSessionId = verifySignedCookieValue(cookie.sessionId?.value) ?? verifySignedCookieValue(cookie._cart?.value);
      if (guestSessionId) await migrateGuestCartToCustomer(guestSessionId, result.customerId);
      cookie._session?.set?.({
        value: result.token,
        httpOnly: true,
        secure: getConfig().NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      // Clear any anonymous/previous-user cart so cart-session resolves the correct one
      cookie._cart?.set?.({ value: "", maxAge: 0, path: "/" });
      cookie.sessionId?.set?.({ value: "", maxAge: 0, path: "/" });
      return safeRedirect(next);
    } catch {
      const pageBody = renderView("pages/storefront/auth/login.eta", { error: "Email o contrasena incorrectos", email, next, csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Iniciar sesion", csrfToken });
    }
  }, {
    body: t.Object({
      email: vs.email,
      password: vs.password,
      csrfToken: vs.csrfToken,
      next: t.Optional(t.String({ maxLength: 500 })),
    }),
  })
  .get("/registro", async ({ customer, cookie }) => {
    if (customer) return safeRedirect("/cuenta");
    const csrfToken = ensureCsrfToken(cookie);
    const body = renderView("pages/storefront/auth/register.eta", { error: null, csrfToken });
    return renderView("layouts/base.eta", { body, title: "Crear cuenta", csrfToken });
  })
  .post("/registro", async ({ body, cookie, request }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const email = input.email as string ?? "";
    const password = input.password as string ?? "";
    const passwordConfirm = input.passwordConfirm as string ?? "";
    const firstName = input.firstName as string ?? "";
    const lastName = input.lastName as string ?? "";
    const country = input.country as string ?? "CHL";
    const consentGiven = input.consentGiven === "true" || input.consentGiven === true;
    if (!consentGiven) {
      const pageBody = renderView("pages/storefront/auth/register.eta", { error: "Debes aceptar la politica de privacidad", email, firstName, lastName, country, csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Crear cuenta", csrfToken });
    }
    if (password !== passwordConfirm) {
      const pageBody = renderView("pages/storefront/auth/register.eta", { error: "Las contrasenas no coinciden", email, firstName, lastName, country, csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Crear cuenta", csrfToken });
    }
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      const pageBody = renderView("pages/storefront/auth/register.eta", { error: pwCheck.errors[0], email, firstName, lastName, country, csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Crear cuenta", csrfToken });
    }
    try {
      const { customerId } = await registerCustomer({
        email, password, firstName, lastName, countryCode: country, consentGiven,
        ip: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
      await sendVerificationEmail(customerId).catch(() => {});
      return safeRedirect("/cuenta/verificar?sent=1");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al crear la cuenta";
      const pageBody = renderView("pages/storefront/auth/register.eta", { error: msg, email, firstName, lastName, country, csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Crear cuenta", csrfToken });
    }
  }, {
    body: t.Object({
      email: vs.email,
      password: vs.password,
      passwordConfirm: vs.password,
      firstName: vs.firstName,
      lastName: vs.lastName,
      country: vs.country,
      consentGiven: t.Optional(t.String({ maxLength: 10 })),
      csrfToken: vs.csrfToken,
    }),
  })
  .post("/logout", async ({ cookie }) => {
    const token = cookie._session?.value as string | undefined;
    if (token) {
      await logoutCustomer(token).catch(() => {});
    }
    cookie._session?.set?.({ value: "", maxAge: 0, path: "/" });
    cookie._cart?.set?.({ value: "", maxAge: 0, path: "/" });
    cookie.sessionId?.set?.({ value: "", maxAge: 0, path: "/" });
    return safeRedirect("/");
  }, {
    body: t.Optional(t.Object({ csrfToken: vs.csrfToken })),
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
    body: t.Object({ email: vs.email, csrfToken: vs.csrfToken }),
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
    if (password !== passwordConfirm) {
      const pageBody = renderView("pages/storefront/auth/reset.eta", { token: params.token, error: "Las contrasenas no coinciden", csrfToken });
      return renderView("layouts/base.eta", { body: pageBody, title: "Nueva contrasena", csrfToken });
    }
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      const pageBody = renderView("pages/storefront/auth/reset.eta", { token: params.token, error: pwCheck.errors[0], csrfToken });
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
      password: vs.password,
      passwordConfirm: vs.password,
      csrfToken: vs.csrfToken,
    }),
  })
  .get("/verificar", async ({ query, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const token = typeof query?.token === "string" ? query.token : "";
    if (token) {
      const result = await verifyEmail(token);
      if (result.success) {
        const body = renderView("pages/storefront/auth/verify-email.eta", { verified: true, csrfToken });
        return renderView("layouts/base.eta", { body, title: "Email verificado", csrfToken });
      }
      const body = renderView("pages/storefront/auth/verify-email.eta", { verified: false, error: result.error, csrfToken });
      return renderView("layouts/base.eta", { body, title: "Verificacion fallida", csrfToken });
    }
    const body = renderView("pages/storefront/auth/verify-email.eta", { sent: query?.sent === "1", csrfToken });
    return renderView("layouts/base.eta", { body, title: "Verificar email", csrfToken });
  })
  .post("/reenviar-verificacion", async ({ customer }) => {
    if (customer) {
      await sendVerificationEmail(customer.customerId).catch(() => {});
    }
    return safeRedirect("/cuenta/verificar?sent=1");
  }, {
    body: t.Optional(t.Object({ csrfToken: vs.csrfToken })),
  });
