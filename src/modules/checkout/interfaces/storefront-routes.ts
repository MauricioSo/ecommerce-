import { Elysia, t } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import * as uc from "../application/use-cases.ts";
import { calculateShipping } from "../../pricing/application/shipping-use-cases.ts";
import { calculateTax } from "../../pricing/application/tax-use-cases.ts";
import { countryDetectPlugin } from "../../../web/middleware/country-detect.ts";
import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";
import { getAddresses, getCustomerProfile } from "../../customers/application/account-use-cases.ts";
import { CustomerSession, type CustomerInfo } from "../../../web/middleware/customer-session.ts";

async function resolveCheckoutCustomer(customer: CustomerInfo | null, cookie: Record<string, { value: unknown }>) {
  if (customer) return customer;
  return await CustomerSession.resolve(cookie);
}

export const checkoutStorefrontRoutes = new Elysia()
  .use(countryDetectPlugin)
  .get("/cart", async ({ cookie, customer }) => {
    const checkoutCustomer = customer ?? await CustomerSession.resolve(cookie as Record<string, { value: unknown }>);
    const sessionId = ensureSession(cookie, checkoutCustomer);
    const csrfToken = ensureCsrfToken(cookie);
    const { items } = await uc.getCartWithItems(sessionId, checkoutCustomer?.customerId);
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const body = renderView("pages/storefront/cart.eta", { items, total: subtotal, itemCount: items.reduce((s, i) => s + i.quantity, 0), csrfToken });
    return renderView("layouts/base.eta", { body, title: "Carrito", customer: checkoutCustomer, csrfToken });
  })
  .post("/cart/add", async ({ body, cookie, customer }) => {
    const checkoutCustomer = customer ?? await CustomerSession.resolve(cookie as Record<string, { value: unknown }>);
    const sessionId = ensureSession(cookie, checkoutCustomer);
    const cartCustomerId = checkoutCustomer?.customerId;
    try {
      await uc.addToCartUseCase(sessionId, body.skuId, parseInt(body.quantity ?? "1", 10) || 1, cartCustomerId);
      const count = await uc.getCartItemCount(sessionId, cartCustomerId);
      return `<div id="cart-count" hx-swap-oob="innerHTML">${count}</div><div class="toast toast-success">Agregado al carrito</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${(e as Error).message}</div>`;
    }
  }, { body: t.Object({ skuId: t.String(), quantity: t.Optional(t.String()) }) })
  .post("/cart/update", async ({ body }) => {
    await uc.updateCartItemUseCase(body.itemId, parseInt(body.quantity, 10));
    return new Response(null, { status: 302, headers: { Location: "/cart" } });
  }, { body: t.Object({ itemId: t.String(), quantity: t.String() }) })
  .post("/cart/remove", async ({ body }) => {
    await uc.removeCartItemUseCase(body.itemId);
    return new Response(null, { status: 302, headers: { Location: "/cart" } });
  }, { body: t.Object({ itemId: t.String() }) })
  .get("/checkout", async ({ cookie, customer, countryCode }) => {
    const checkoutCustomer = await resolveCheckoutCustomer(customer, cookie as Record<string, { value: unknown }>);
    const sessionId = ensureSession(cookie, checkoutCustomer);
    const csrfToken = ensureCsrfToken(cookie);
    try {
      const { checkoutId } = await uc.startCheckoutUseCase(sessionId, checkoutCustomer?.customerId);
      const { items } = await uc.getCartWithItems(sessionId, checkoutCustomer?.customerId);
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const prefill: Record<string, string> = {};
      if (checkoutCustomer) {
        const profile = await getCustomerProfile(checkoutCustomer.customerId);
        prefill.email = checkoutCustomer.email;
        prefill.firstName = profile.firstName ?? "";
        prefill.lastName = profile.lastName ?? "";
        prefill.phone = profile.phone ?? "";
        const addresses = await getAddresses(checkoutCustomer.customerId);
        const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
        if (defaultAddr) {
          const address = {
            line1: defaultAddr.line1,
            line2: defaultAddr.line2 ?? "",
            neighborhood: defaultAddr.neighborhood ?? "",
            city: defaultAddr.city,
            state: defaultAddr.state,
            postalCode: defaultAddr.postalCode,
            country: defaultAddr.country ?? countryCode,
            reference: defaultAddr.reference ?? "",
          };
          await uc.setCheckoutShippingUseCase(checkoutId, {
            email: checkoutCustomer.email,
            firstName: profile.firstName ?? "",
            lastName: profile.lastName ?? "",
            phone: defaultAddr.phone ?? profile.phone ?? "",
            shippingAddress: address,
            shippingMethod: null,
            shippingCostCents: 0,
            countryCode: defaultAddr.country ?? countryCode,
            notes: "",
          });
          const shippingOptions = await calculateShipping({
            countryCode: defaultAddr.country ?? countryCode,
            region: defaultAddr.state,
            orderSubtotalCents: subtotal,
          });
          const body = renderView("pages/storefront/checkout-shipping.eta", {
            checkoutId,
            items,
            subtotal,
            shippingOptions,
            address,
            error: null,
            csrfToken,
          });
          return renderView("layouts/base.eta", { body, title: "Envio", customer: checkoutCustomer, csrfToken });
        }
      }
      const body = renderView("pages/storefront/checkout.eta", {
        checkoutId,
        items,
        subtotal,
        countryCode,
        prefill,
        error: null,
        customer: checkoutCustomer,
        csrfToken,
      });
      return renderView("layouts/base.eta", { body, title: "Checkout", customer: checkoutCustomer, csrfToken });
    } catch {
      return new Response(null, { status: 302, headers: { Location: "/cart" } });
    }
  })
  .post("/checkout/direccion", async ({ body, cookie, customer, countryCode }) => {
    const checkoutCustomer = await resolveCheckoutCustomer(customer, cookie as Record<string, { value: unknown }>);
    const sessionId = ensureSession(cookie, checkoutCustomer);
    const csrfToken = ensureCsrfToken(cookie);
    try {
      const email = checkoutCustomer?.email ?? body.email?.trim();
      if (!email || !email.includes("@")) throw new Error("Email válido es requerido");
      if (!body.line1?.trim()) throw new Error("Dirección es requerida");
      if (!body.city?.trim()) throw new Error("Ciudad es requerida");
      if (!body.state?.trim()) throw new Error("Región es requerida");
      if (!body.postalCode?.trim()) throw new Error("Código postal es requerido");
      await uc.setCheckoutShippingUseCase(body.checkoutId, {
        email,
        firstName: body.firstName?.trim() ?? checkoutCustomer?.firstName ?? "",
        lastName: body.lastName?.trim() ?? checkoutCustomer?.lastName ?? "",
        phone: body.phone?.trim() ?? "",
        shippingAddress: {
          line1: body.line1.trim(),
          line2: body.line2?.trim() ?? "",
          neighborhood: body.neighborhood?.trim() ?? "",
          city: body.city.trim(),
          state: body.state.trim(),
          postalCode: body.postalCode.trim(),
          country: body.country ?? countryCode,
          reference: body.reference?.trim() ?? "",
        },
        shippingMethod: null,
        shippingCostCents: 0,
        countryCode: body.country ?? countryCode,
        notes: body.notes?.trim() ?? "",
      });
      const { items } = await uc.getCartWithItems(sessionId, checkoutCustomer?.customerId);
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const shippingOptions = await calculateShipping({
        countryCode: body.country ?? countryCode,
        region: body.state.trim(),
        orderSubtotalCents: subtotal,
      });
      const bodyHtml = renderView("pages/storefront/checkout-shipping.eta", {
        checkoutId: body.checkoutId,
        items,
        subtotal,
        shippingOptions,
        address: {
          line1: body.line1.trim(),
          line2: body.line2?.trim(),
          city: body.city.trim(),
          state: body.state.trim(),
          postalCode: body.postalCode.trim(),
        },
        error: null,
        csrfToken,
      });
      return renderView("layouts/base.eta", { body: bodyHtml, title: "Envío", customer: checkoutCustomer, csrfToken });
    } catch (e) {
      const { checkoutId } = await uc.startCheckoutUseCase(sessionId, checkoutCustomer?.customerId);
      const { items } = await uc.getCartWithItems(sessionId, checkoutCustomer?.customerId);
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const bodyHtml = renderView("pages/storefront/checkout.eta", {
        checkoutId,
        items,
        subtotal,
        countryCode,
        prefill: body,
        error: (e as Error).message,
        customer: checkoutCustomer,
        csrfToken,
      });
      return renderView("layouts/base.eta", { body: bodyHtml, title: "Checkout", customer: checkoutCustomer, csrfToken });
    }
  }, {
    body: t.Object({
      checkoutId: t.String(),
      email: t.Optional(t.String()),
      firstName: t.Optional(t.String()),
      lastName: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      line1: t.String(),
      line2: t.Optional(t.String()),
      neighborhood: t.Optional(t.String()),
      city: t.String(),
      state: t.String(),
      postalCode: t.String(),
      country: t.Optional(t.String()),
      reference: t.Optional(t.String()),
      notes: t.Optional(t.String()),
    }),
  })
  .get("/checkout/envio", async ({ cookie, customer, set }) => {
    const checkoutCustomer = await resolveCheckoutCustomer(customer, cookie as Record<string, { value: unknown }>);
    const sessionId = ensureSession(cookie, checkoutCustomer);
    const csrfToken = ensureCsrfToken(cookie);
    const { items } = await uc.getCartWithItems(sessionId, checkoutCustomer?.customerId);
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const session = await uc.findLatestPendingCheckout(sessionId);
    if (!session || !session.shippingAddress) { set.redirect = "/checkout"; return; }
    const addr = session.shippingAddress as Record<string, string>;
    const shippingOptions = await calculateShipping({
      countryCode: session.countryCode ?? "CHL",
      region: addr.state,
      orderSubtotalCents: subtotal,
    });
    const body = renderView("pages/storefront/checkout-shipping.eta", {
      checkoutId: session.id,
      items,
      subtotal,
      shippingOptions,
      address: addr,
      error: null,
      csrfToken,
    });
    return renderView("layouts/base.eta", { body, title: "Envío", customer: checkoutCustomer, csrfToken });
  })
  .post("/checkout/envio", async ({ body, cookie, customer, countryCode }) => {
    const checkoutCustomer = await resolveCheckoutCustomer(customer, cookie as Record<string, { value: unknown }>);
    const sessionId = ensureSession(cookie, checkoutCustomer);
    const csrfToken = ensureCsrfToken(cookie);
    try {
      const { items } = await uc.getCartWithItems(sessionId, checkoutCustomer?.customerId);
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const session = await uc.getCheckoutSession(body.checkoutId);
      const addr = (session?.shippingAddress ?? {}) as Record<string, string>;
      const shippingOptions = await calculateShipping({
        countryCode: session?.countryCode ?? countryCode,
        region: addr.state,
        orderSubtotalCents: subtotal,
      });
      if (!body.shippingRateId) throw new Error("Selecciona un método de envío");
      const selected = shippingOptions.find((o) => o.rateId === body.shippingRateId);
      if (!selected) throw new Error("Selecciona un método de envío");
      await uc.setCheckoutShippingRate(body.checkoutId, {
        shippingMethod: selected.name,
        shippingCostCents: selected.priceCents,
        shippingRateId: body.shippingRateId,
      });
      const tax = await calculateTax({
        subtotalCents: subtotal,
        countryCode: session?.countryCode ?? countryCode,
        region: addr.state,
      });
      const discountCents = session?.appliedDiscountCents ?? 0;
      const totalCents = subtotal - discountCents + selected.priceCents + tax.taxCents;
      const bodyHtml = renderView("pages/storefront/checkout-review.eta", {
        checkoutId: body.checkoutId,
        items,
        subtotal,
        discountCents,
        shippingCents: selected.priceCents,
        taxCents: tax.taxCents,
        taxName: tax.taxName,
        totalCents,
        address: addr,
        shippingName: selected.name,
        shippingDays: `${selected.estimatedDaysMin}-${selected.estimatedDaysMax}`,
        customer: checkoutCustomer,
        csrfToken,
      });
      return renderView("layouts/base.eta", { body: bodyHtml, title: "Confirmar", customer: checkoutCustomer, csrfToken });
    } catch (e) {
      const { items } = await uc.getCartWithItems(sessionId, checkoutCustomer?.customerId);
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const session = await uc.getCheckoutSession(body.checkoutId);
      const addr = (session?.shippingAddress ?? {}) as Record<string, string>;
      const shippingOptions = await calculateShipping({
        countryCode: session?.countryCode ?? countryCode,
        region: addr.state,
        orderSubtotalCents: subtotal,
      });
      const bodyHtml = renderView("pages/storefront/checkout-shipping.eta", {
        checkoutId: body.checkoutId,
        items,
        subtotal,
        shippingOptions,
        address: addr,
        error: (e as Error).message,
        csrfToken,
      });
      return renderView("layouts/base.eta", { body: bodyHtml, title: "Envío", customer: checkoutCustomer, csrfToken });
    }
  }, {
    body: t.Object({ checkoutId: t.String(), shippingRateId: t.Optional(t.String()) }),
  })
  .post("/checkout/confirmar", async ({ body, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    try {
      const result = await uc.confirmCheckoutUseCase(body.checkoutId);
      const paymentRepo = await import("../../payments/infrastructure/repository.ts");
      const attempt = result.paymentAttemptId
        ? await paymentRepo.findPaymentAttemptById(result.paymentAttemptId)
        : null;
      if (attempt?.metadata && typeof attempt.metadata === "object") {
        const meta = attempt.metadata as Record<string, unknown>;
        if (meta.initPoint) {
          return new Response(null, { status: 302, headers: { Location: meta.initPoint as string } });
        }
        if (meta.url && meta.token) {
          const formHtml = `<!DOCTYPE html><html><head><script src="/static/js/main.js"></script></head><body><form id="wp" method="POST" action="${meta.url}" data-autosubmit><input type="hidden" name="token_ws" value="${meta.token}"></form></body></html>`;
          return new Response(formHtml, { headers: { "Content-Type": "text/html" } });
        }
      }
      if (result.paymentStatus === "failed") {
        const bodyHtml = renderView("pages/storefront/checkout-success.eta", {
          orderId: result.orderId,
          orderPublicToken: result.orderPublicToken,
          paymentStatus: "failed",
          title: "Error en el pago",
          retryUrl: `/checkout/retry/${result.orderId}`,
          csrfToken,
        });
        return renderView("layouts/base.eta", { body: bodyHtml, title: "Error en el pago", csrfToken });
      }
      const bodyHtml = renderView("pages/storefront/checkout-success.eta", {
        orderId: result.orderId,
        orderPublicToken: result.orderPublicToken,
        paymentStatus: result.paymentStatus,
        title: result.paymentStatus === "approved" ? "Pedido confirmado" : "Procesando pago",
        csrfToken,
      });
      return renderView("layouts/base.eta", { body: bodyHtml, title: "Checkout", csrfToken });
    } catch (e) {
      return `<div class="toast toast-error">${(e as Error).message}</div>`;
    }
  }, { body: t.Object({ checkoutId: t.String() }) })
  .get("/checkout/retry/:orderId", async ({ params, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const paymentRepo = await import("../../payments/infrastructure/repository.ts");
    const order = await paymentRepo.findOrderById(params.orderId);
    if (!order || (order.status !== "pending")) {
      return new Response(null, { status: 302, headers: { Location: "/cart" } });
    }
    const bodyHtml = `<div class="order-success"><h2>Reintentar pago</h2><p>Orden ${params.orderId.slice(0, 8)} pendiente de pago.</p><form action="/checkout/retry" method="POST"><input type="hidden" name="csrfToken" value="${csrfToken}"><input type="hidden" name="orderId" value="${params.orderId}"><button type="submit" class="btn btn-primary btn-lg">Reintentar pago</button></form></div>`;
    return renderView("layouts/base.eta", { body: bodyHtml, title: "Reintentar pago", csrfToken });
  })
  .post("/checkout/retry", async ({ body }) => {
    try {
      const { initiatePaymentUseCase } = await import("../../payments/application/use-cases.ts");
      const paymentRepo = await import("../../payments/infrastructure/repository.ts");
      const order = await paymentRepo.findOrderById(body.orderId);
      if (!order || order.status !== "pending") {
        return new Response(null, { status: 302, headers: { Location: "/cart" } });
      }
      const result = await initiatePaymentUseCase({
        orderId: body.orderId,
        amountCents: order.totalCents,
        currency: order.currency,
        idempotencyKey: crypto.randomUUID(),
      });
      const attempt = await paymentRepo.findPaymentAttemptById(result.attemptId);
      if (attempt?.metadata && typeof attempt.metadata === "object") {
        const meta = attempt.metadata as Record<string, unknown>;
        if (meta.initPoint) {
          return new Response(null, { status: 302, headers: { Location: meta.initPoint as string } });
        }
        if (meta.url && meta.token) {
          const formHtml = `<!DOCTYPE html><html><head><script src="/static/js/main.js"></script></head><body><form id="wp" method="POST" action="${meta.url}" data-autosubmit><input type="hidden" name="token_ws" value="${meta.token}"></form></body></html>`;
          return new Response(formHtml, { headers: { "Content-Type": "text/html" } });
        }
      }
      if (result.status === "approved") {
        return new Response(null, { status: 302, headers: { Location: `/checkout/success?order=${body.orderId}` } });
      }
      return `<div class="toast toast-error">No se pudo iniciar el pago. Intenta nuevamente.</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${(e as Error).message}</div>`;
    }
  }, { body: t.Object({ orderId: t.String(), csrfToken: t.String() }) });

function ensureSession(cookie: Record<string, any>, _customer: { customerId: string } | null): string {
  const existing = cookie.sessionId?.value ?? cookie._cart?.value;
  if (existing && typeof existing === "string") return existing;
  const sid = crypto.randomUUID();
  cookie.sessionId?.set?.({ value: sid, httpOnly: true, maxAge: 60 * 60 * 24 * 30, path: "/" });
  return sid;
}
