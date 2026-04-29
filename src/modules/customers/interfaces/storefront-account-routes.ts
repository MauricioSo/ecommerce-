import { Elysia, t } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import {
  getCustomerProfile,
  updateCustomerProfile,
  getAddresses,
  addAddress,
  removeAddress,
  setCustomerDefaultAddress,
  getOrderHistory,
  getOrderDetail,
} from "../application/account-use-cases.ts";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { findWishlistByCustomerId } from "../infrastructure/repository.ts";
import { CustomerSession, customerSessionPlugin, type CustomerInfo } from "../../../web/middleware/customer-session.ts";
import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";

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
      console.error("Account dashboard failed", error);
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
      console.error("Orders list failed", error);
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
      console.error("Order detail failed", error);
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
      console.error("Addresses failed", error);
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
      console.error("Address form failed", error);
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
      console.error("Add address failed", error);
      const body = renderView("pages/storefront/account/address-form.eta", { csrfToken, error: "Error al guardar la direccion" });
      return renderView("layouts/base.eta", { body, title: "Agregar direccion", csrfToken });
    }
  }, {
    body: t.Object({
      csrfToken: t.Optional(t.String()),
      line1: t.String(),
      line2: t.Optional(t.String()),
      neighborhood: t.Optional(t.String()),
      city: t.String(),
      state: t.String(),
      postalCode: t.String(),
      phone: t.Optional(t.String()),
      country: t.Optional(t.String()),
      reference: t.Optional(t.String()),
    }),
  })
  .post("/direcciones/:id/default", async ({ customer, cookie, params }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      await setCustomerDefaultAddress(c.customerId, params.id);
      return safeRedirect("/cuenta/direcciones");
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/direcciones");
      console.error("Set default address failed", error);
      return safeRedirect("/cuenta/direcciones");
    }
  }, {
    body: t.Object({ csrfToken: t.Optional(t.String()) }),
  })
  .post("/direcciones/:id/eliminar", async ({ customer, cookie, params }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      await removeAddress(c.customerId, params.id);
      return safeRedirect("/cuenta/direcciones");
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/direcciones");
      console.error("Remove address failed", error);
      return safeRedirect("/cuenta/direcciones");
    }
  }, {
    body: t.Object({ csrfToken: t.Optional(t.String()) }),
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
      console.error("Profile failed", error);
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
      console.error("Update profile failed", error);
      const body = renderView("pages/storefront/account/profile.eta", { customer: null, success: false, csrfToken, error: "Error al actualizar perfil" });
      return renderView("layouts/base.eta", { body, title: "Mi perfil", csrfToken });
    }
  }, {
    body: t.Object({
      csrfToken: t.Optional(t.String()),
      firstName: t.Optional(t.String()),
      lastName: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      documentType: t.Optional(t.String()),
      documentNumber: t.Optional(t.String()),
    }),
  })
  .get("/favoritos", async ({ customer, cookie }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const csrfToken = ensureCsrfToken(cookie);
      const db = getDb();
      const wishlist = await findWishlistByCustomerId(c.customerId);
      const items: Array<Record<string, unknown>> = [];
      if (wishlist) {
        const wlItems = await db.select({
          skuId: s.wishlistItems.skuId,
          addedAt: s.wishlistItems.addedAt,
        }).from(s.wishlistItems).where(eq(s.wishlistItems.wishlistId, wishlist.id));
        for (const wl of wlItems) {
          const [skuRow] = await db.select().from(s.skus).where(eq(s.skus.id, wl.skuId)).limit(1);
          if (!skuRow) continue;
          const [productRow] = await db.select().from(s.products).where(eq(s.products.id, skuRow.productId)).limit(1);
          const [invRow] = await db.select().from(s.inventoryItems).where(eq(s.inventoryItems.skuId, skuRow.id)).limit(1);
          items.push({
            skuId: skuRow.id,
            productName: productRow?.name ?? "",
            productSlug: productRow?.slug ?? "",
            priceCents: skuRow.priceCents,
            inStock: invRow ? invRow.physicalStock - invRow.reservedStock + invRow.adjustedStock > 0 : false,
          });
        }
      }
      const body = renderView("pages/storefront/account/favorites.eta", { items, csrfToken });
      return renderView("layouts/base.eta", { body, title: "Mis favoritos", customer: c, csrfToken });
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/favoritos");
      console.error("Favorites failed", error);
      return loginRedirect("/cuenta/favoritos");
    }
  })
  .post("/favoritos/:skuId/eliminar", async ({ customer, cookie, params }) => {
    try {
      const c = await resolveCustomer(customer, cookie as Record<string, { value: unknown }>);
      const db = getDb();
      const wishlist = await findWishlistByCustomerId(c.customerId);
      if (wishlist) {
        await db.delete(s.wishlistItems).where(and(eq(s.wishlistItems.wishlistId, wishlist.id), eq(s.wishlistItems.skuId, params.skuId)));
      }
      return safeRedirect("/cuenta/favoritos");
    } catch (error) {
      if (isUnauthorized(error)) return loginRedirect("/cuenta/favoritos");
      console.error("Remove favorite failed", error);
      return safeRedirect("/cuenta/favoritos");
    }
  }, {
    body: t.Object({ csrfToken: t.Optional(t.String()) }),
  });
