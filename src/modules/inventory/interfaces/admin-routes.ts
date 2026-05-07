import { Elysia, t } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import * as uc from "../application/use-cases.ts";

import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";
import { escapeHtml } from "../../../web/helpers/escape.ts";
import { getAdminUserFromCookie } from "../../../web/middleware/admin-auth.ts";
import { writeAuditEvent } from "../../../shared/infrastructure/audit.ts";

export const inventoryAdminRoutes = new Elysia({ prefix: "/admin/inventory" })
  .get("/", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const items = await uc.getInventoryList();
    const body = renderView("pages/admin/inventory.eta", { items, title: "Inventory", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "Inventory", csrfToken });
  })
  .get("/:skuId/ledger", async ({ params, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const entries = await uc.getInventoryLedger(params.skuId);
    const body = renderView("pages/admin/inventory-ledger.eta", { entries, skuId: params.skuId, title: `Ledger - ${params.skuId}`, csrfToken });
    return renderView("layouts/admin.eta", { body, title: `Ledger - ${params.skuId}`, csrfToken });
  })
  .post(
    "/adjust",
    async ({ body, cookie }) => {
      try {
        const delta = parseInt(body.delta, 10);
        if (isNaN(delta) || delta === 0) throw new Error("Delta must be a non-zero integer");
        const admin = await getAdminUserFromCookie(cookie);
        const item = await uc.adjustStockUseCase({ skuId: body.skuId, delta, actorId: admin?.id });
        await writeAuditEvent({
          aggregateType: "inventory",
          aggregateId: body.skuId,
          eventType: "admin.inventory.adjust",
          payload: { delta },
          actorId: admin?.id,
        }).catch(() => {});
        return           `<div id="stock-${escapeHtml(body.skuId)}" hx-swap-oob="innerHTML">` +
          `<span>${item.physicalStock - item.reservedStock + item.adjustedStock}</span>` +
          `</div>` +
          `<div class="toast toast-success">Stock adjusted</div>`;
      } catch (e) {
        return `<div class="toast toast-error">${escapeHtml((e as Error).message)}</div>`;
      }
    },
    { body: t.Object({ skuId: t.String({ maxLength: 64 }), delta: t.String({ maxLength: 10 }) }) }
  );
