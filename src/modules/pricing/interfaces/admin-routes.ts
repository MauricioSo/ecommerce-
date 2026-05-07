import { Elysia, t } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import * as uc from "../application/use-cases.ts";

import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";
import { escapeHtml } from "../../../web/helpers/escape.ts";

export const pricingAdminRoutes = new Elysia({ prefix: "/admin/promotions" })
  .get("/", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const promotions = await uc.getPromotionList();
    const body = renderView("pages/admin/promotions.eta", { promotions, title: "Promotions", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "Promotions", csrfToken });
  })
  .get("/new", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const body = renderView("pages/admin/promotion-form.eta", { title: "New Promotion", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "New Promotion", csrfToken });
  })
  .post("/new", async ({ body }) => {
    try {
      await uc.createPromotionUseCase({
        name: body.name,
        type: body.type,
        discountValue: parseFloat(body.discountValue),
        discountType: body.discountType,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        maxUses: body.maxUses ? parseInt(body.maxUses, 10) : undefined,
      });
      return new Response(null, { status: 302, headers: { Location: "/admin/promotions" } });
    } catch (e) {
      return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
    }
  }, {
    body: t.Object({
      name: t.String({ maxLength: 200 }),
      type: t.String({ maxLength: 30 }),
      discountValue: t.String({ maxLength: 10 }),
      discountType: t.String({ maxLength: 20 }),
      startsAt: t.Optional(t.String({ maxLength: 30 })),
      endsAt: t.Optional(t.String({ maxLength: 30 })),
      maxUses: t.Optional(t.String({ maxLength: 10 })),
    }),
  })
  .post("/:id/toggle", async ({ params }) => {
    await uc.togglePromotionUseCase(params.id);
    return new Response(null, { status: 302, headers: { Location: "/admin/promotions" } });
  });
