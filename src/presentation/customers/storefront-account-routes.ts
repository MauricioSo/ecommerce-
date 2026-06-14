import { Elysia, t } from "elysia";
import { renderView } from "../../web/templates/engine.ts";
import {
  getCustomerProfile,
  updateCustomerProfile,
  getAddresses,
  addAddress,
  removeAddress,
  setCustomerDefaultAddress,
  getOrderHistory,
  getOrderDetail,
  getCustomerFavoritesUseCase,
  removeFavoriteUseCase,
} from "../../application/customers/account-use-cases.ts";
import { CustomerSession, customerSessionPlugin, type CustomerInfo } from "../../web/middleware/customer-session.ts";
import { ensureCsrfToken } from "../../web/helpers/csrf.ts";
import { vs } from "../../web/schemas/validation.ts";
import { requestAccountDeletionUseCase, exportCustomerDataUseCase } from "../../application/customers/data-protection-use-cases.ts";
import { escapeHtml } from "../../web/helpers/escape.ts";
import { createLogger } from "../../shared/infrastructure/logger/index.ts";

const accountLogger = createLogger();

function requireCustomer(customer: CustomerInfo | null): CustomerInfo {
  if (!customer) throw new Error("Unauthorized");
  return customer;
}

async function resolveCustomer(customer: CustomerInfo | null, cookie: Record<string, { value: unknown }>): Promise<CustomerInfo> {
  if (customer) return customer;
  const resolved = await CustomerSession.resolve(cookie);
  return requireCustomer(resolved);
}

function loginRedirect(next?: string) {
  const location = next ? `/cuenta/login?next=${encodeURIComponent(next)}` : "/cuenta/login";
  return new Response(null, { status: 302, headers: { Location: location } });
}

function safeRedirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

function isUnauthorized(error: unknown): boolean {
  if (error instanceof Error && error.message === "Unauthorized") return true;
  return false;
}

export const storefrontAccountRoutes = new Elysia({ prefix: "/cuenta" })
  .use(customerSessionPlugin)
  .get("/", async ({ customer, cookie }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const csrfToken = ensureCsrfToken(cookie);
      const profile = await getCustomerProfile(c.customerId);
      const { orders } = await getOrderHistory(c.customerId, 1, 3);
      const customerName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email;
      const body = renderView("pages/storefront/account/dashboard.eta", { customerName, recentOrders: orders });
      return renderView("layouts/base.eta", { body, title: "Mi cuenta", customer: c, csrfToken });
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect();
      accountLogger.error("Account dashboard failed", { error });
      return loginRedirect();
    }
  })
  .get("/pedidos", async ({ customer, query, cookie }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const csrfToken = ensureCsrfToken(cookie);
      const page = Number(query?.page ?? 1);
      const { orders, total, perPage } = await getOrderHistory(c.customerId, page, 10);
      const body = renderView("pages/storefront/account/orders.eta", { orders, page, hasMore: page * perPage < total });
      return renderView("layouts/base.eta", { body, title: "Mis pedidos", customer: c, csrfToken });
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/pedidos");
      accountLogger.error("Orders list failed", { error: String(error) });
      return loginRedirect("/cuenta/pedidos");
    }
  })
  .get("/pedidos/:orderId", async ({ customer, params, cookie }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const csrfToken = ensureCsrfToken(cookie);
      const detail = await getOrderDetail(c.customerId, params.orderId);
      const body = renderView("pages/storefront/account/order-detail.eta", { order: detail, items: detail.items });
      return renderView("layouts/base.eta", { body, title: "Pedido", customer: c, csrfToken });
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/pedidos");
      accountLogger.error("Order detail failed", { error: String(error) });
      return loginRedirect("/cuenta/pedidos");
    }
  })
  .get("/direcciones", async ({ customer, cookie }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const csrfToken = ensureCsrfToken(cookie);
      const addresses = await getAddresses(c.customerId);
      const body = renderView("pages/storefront/account/addresses.eta", { addresses, csrfToken });
      return renderView("layouts/base.eta", { body, title: "Mis direcciones", customer: c, csrfToken });
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/direcciones");
      accountLogger.error("Addresses failed", { error: String(error) });
      return loginRedirect("/cuenta/direcciones");
    }
  })
  .get("/direcciones/nueva", async ({ customer, cookie }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const csrfToken = ensureCsrfToken(cookie);
      const body = renderView("pages/storefront/account/address-form.eta", { csrfToken });
      return renderView("layouts/base.eta", { body, title: "Agregar direccion", customer: c, csrfToken });
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/direcciones/nueva");
      accountLogger.error("Address form failed", { error: String(error) });
      return loginRedirect("/cuenta/direcciones/nueva");
    }
  })
  .post("/direcciones", async ({ customer, cookie, body: requestBody }) => {
    const csrfToken = ensureCsrfToken(cookie);
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const input = typeof requestBody === "object" && requestBody !== null ? requestBody as Record<string, string> : {};
      await addAddress(c.customerId, {
        line1: input.line1 ?? "",
        line2: input.line2,
        neighborhood: input.neighborhood,
        city: input.city ?? "",
        state: input.state ?? "",
        postalCode: input.postalCode ?? "",
        country: input.country,
        phone: input.phone,
        reference: input.reference,
      });
      return safeRedirect("/cuenta/direcciones");
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/direcciones/nueva");
      accountLogger.error("Add address failed", { error: String(error) });
      const body = renderView("pages/storefront/account/address-form.eta", { csrfToken, error: "Error al guardar la direccion" });
      return renderView("layouts/base.eta", { body, title: "Agregar direccion", csrfToken });
    }
  }, {
    body: t.Object({
      csrfToken: vs.csrfToken,
      line1: vs.line1,
      line2: vs.line2,
      neighborhood: vs.neighborhood,
      city: vs.city,
      state: vs.state,
      postalCode: vs.postalCode,
      phone: vs.phone,
      country: vs.country,
      reference: vs.reference,
    }),
  })
  .post("/direcciones/:id/default", async ({ customer, cookie, params }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      await setCustomerDefaultAddress(c.customerId, params.id);
      return safeRedirect("/cuenta/direcciones");
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/direcciones");
      accountLogger.error("Set default address failed", { error: String(error) });
      return safeRedirect("/cuenta/direcciones");
    }
  }, {
    body: t.Object({ csrfToken: vs.csrfToken }),
  })
  .post("/direcciones/:id/eliminar", async ({ customer, cookie, params }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      await removeAddress(c.customerId, params.id);
      return safeRedirect("/cuenta/direcciones");
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/direcciones");
      accountLogger.error("Remove address failed", { error: String(error) });
      return safeRedirect("/cuenta/direcciones");
    }
  }, {
    body: t.Object({ csrfToken: vs.csrfToken }),
  })
  .get("/perfil", async ({ customer, cookie }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const csrfToken = ensureCsrfToken(cookie);
      const profile = await getCustomerProfile(c.customerId);
      const body = renderView("pages/storefront/account/profile.eta", { customer: profile, success: false, csrfToken });
      return renderView("layouts/base.eta", { body, title: "Mi perfil", customer: c, csrfToken });
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/perfil");
      accountLogger.error("Profile failed", { error: String(error) });
      return loginRedirect("/cuenta/perfil");
    }
  })
  .post("/perfil", async ({ customer, cookie, body: requestBody }) => {
    const csrfToken = ensureCsrfToken(cookie);
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const input = typeof requestBody === "object" && requestBody !== null ? requestBody as Record<string, string> : {};
      await updateCustomerProfile(c.customerId, {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
      });
      const profile = await getCustomerProfile(c.customerId);
      const body = renderView("pages/storefront/account/profile.eta", { customer: profile, success: true, csrfToken });
      return renderView("layouts/base.eta", { body, title: "Mi perfil", customer: c, csrfToken });
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/perfil");
      accountLogger.error("Update profile failed", { error: String(error) });
      const body = renderView("pages/storefront/account/profile.eta", { customer: null, success: false, csrfToken, error: "Error al actualizar perfil" });
      return renderView("layouts/base.eta", { body, title: "Mi perfil", csrfToken });
    }
  }, {
    body: t.Object({
      csrfToken: vs.csrfToken,
      firstName: vs.firstName,
      lastName: vs.lastName,
      phone: vs.phone,
      documentType: t.Optional(t.String({ maxLength: 20 })),
      documentNumber: t.Optional(t.String({ maxLength: 30 })),
    }),
  })
  .get("/favoritos", async ({ customer, cookie }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const csrfToken = ensureCsrfToken(cookie);
      const items = await getCustomerFavoritesUseCase(c.customerId);
      const body = renderView("pages/storefront/account/favorites.eta", { items, csrfToken });
      return renderView("layouts/base.eta", { body, title: "Mis favoritos", customer: c, csrfToken });
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/favoritos");
      accountLogger.error("Favorites failed", { error: String(error) });
      return loginRedirect("/cuenta/favoritos");
    }
  })
  .post("/favoritos/:skuId/eliminar", async ({ customer, cookie, params }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      await removeFavoriteUseCase(c.customerId, params.skuId);
      return safeRedirect("/cuenta/favoritos");
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/favoritos");
      accountLogger.error("Remove favorite failed", { error: String(error) });
      return safeRedirect("/cuenta/favoritos");
    }
  }, {
    body: t.Object({ csrfToken: vs.csrfToken }),
  })
  .get("/mis-datos", async ({ customer }) => {
    if (!customer) return loginRedirect("/cuenta/mis-datos");
    const data = await exportCustomerDataUseCase(customer.customerId);
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=mis-datos.json" },
    });
  })
  .get("/eliminar-cuenta", async ({ customer, cookie }) => {
    if (!customer) return loginRedirect("/cuenta");
    const csrfToken = ensureCsrfToken(cookie);
    const body = renderView("pages/storefront/account/delete-account.eta", { csrfToken });
    return renderView("layouts/base.eta", { body, title: "Eliminar cuenta", customer, csrfToken });
  })
  .post("/eliminar-cuenta", async ({ customer, body }) => {
    if (!customer) return loginRedirect("/cuenta");
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const confirm = input.confirm as string ?? "";
    if (confirm !== "ELIMINAR") {
      return `<div class="toast toast-error">Debes escribir ELIMINAR para confirmar</div>`;
    }
    try {
      await requestAccountDeletionUseCase(customer.customerId);
      return new Response(null, { status: 302, headers: { Location: "/cuenta/login?deleted=1" } });
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, {
    body: t.Object({ confirm: t.String({ maxLength: 20 }), csrfToken: vs.csrfToken }),
  });
