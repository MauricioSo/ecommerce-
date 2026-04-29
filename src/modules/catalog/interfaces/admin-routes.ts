import { Elysia, t } from "elysia";
import { renderView } from "../../../web/templates/engine.ts";
import * as uc from "../application/use-cases.ts";

import { ensureCsrfToken } from "../../../web/helpers/csrf.ts";

export const catalogAdminRoutes = new Elysia({ prefix: "/admin" })
  .get("/products", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const products = await uc.getProductList();
    const body = renderView("pages/admin/products.eta", { products, title: "Products", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "Products", csrfToken });
  })
  .get("/products/new", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const categories = await uc.getCategoryList();
    const body = renderView("pages/admin/product-form.eta", { categories, product: null, title: "New Product", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "New Product", csrfToken });
  })
  .post("/products", async ({ body }) => {
    await uc.createProductUseCase({ name: body.name, description: body.description, categoryId: body.categoryId || undefined });
    return new Response(null, { status: 302, headers: { Location: "/admin/products" } });
  }, { body: t.Object({ name: t.String(), description: t.Optional(t.String()), categoryId: t.Optional(t.String()) }) })
  .get("/products/:id", async ({ params, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const detail = await uc.getProductDetail(params.id);
    if (!detail) return new Response("Not found", { status: 404 });
    const allAttributes = await uc.getAttributeList();
    const body = renderView("pages/admin/product-detail.eta", { ...detail, allAttributes, title: detail.product.name, csrfToken });
    return renderView("layouts/admin.eta", { body, title: detail.product.name, csrfToken });
  })
  .post("/products/:id", async ({ params, body }) => {
    await uc.updateProductUseCase(params.id, { name: body.name, description: body.description, categoryId: body.categoryId || undefined });
    return new Response(null, { status: 302, headers: { Location: `/admin/products/${params.id}` } });
  }, { body: t.Object({ name: t.String(), description: t.Optional(t.String()), categoryId: t.Optional(t.String()) }) })
  .post("/products/:id/publish", async ({ params }) => {
    try {
      await uc.changeProductStatusUseCase(params.id, "published");
      return `<div class="toast toast-success">Product published</div>`;
    } catch (e) {
      return `<div class="toast toast-error">${(e as Error).message}</div>`;
    }
  })
  .post("/products/:id/archive", async ({ params }) => {
    await uc.changeProductStatusUseCase(params.id, "archived");
    return `<div class="toast toast-success">Product archived</div>`;
  })
  .post("/products/:id/skus", async ({ params, body }) => {
    try {
      await uc.createSkuUseCase({
        productId: params.id,
        sku: body.sku,
        variantLabel: body.variantLabel || undefined,
        priceCents: parseInt(body.priceCents, 10),
        currency: body.currency || "USD",
        compareAtPriceCents: body.compareAtPriceCents ? parseInt(body.compareAtPriceCents, 10) : undefined,
      });
      return new Response(null, { status: 302, headers: { Location: `/admin/products/${params.id}` } });
    } catch (e) {
      return `<div class="toast toast-error">${(e as Error).message}</div>`;
    }
  }, { body: t.Object({ sku: t.String(), variantLabel: t.Optional(t.String()), priceCents: t.String(), currency: t.Optional(t.String()), compareAtPriceCents: t.Optional(t.String()) }) })
  .post("/products/:id/attributes", async ({ params, body }) => {
    await uc.setProductAttributeUseCase(params.id, body.attributeId, body.value);
    return new Response(null, { status: 302, headers: { Location: `/admin/products/${params.id}` } });
  }, { body: t.Object({ attributeId: t.String(), value: t.String() }) })
  .get("/categories", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const categories = await uc.getCategoryList();
    const body = renderView("pages/admin/categories.eta", { categories, title: "Categories", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "Categories", csrfToken });
  })
  .get("/categories/new", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const categories = await uc.getCategoryList();
    const body = renderView("pages/admin/category-form.eta", { categories, category: null, title: "New Category", csrfToken });
    return renderView("layouts/admin.eta", { body, title: "New Category", csrfToken });
  })
  .post("/categories", async ({ body }) => {
    try {
      await uc.createCategoryUseCase({ name: body.name, parentId: body.parentId || undefined, description: body.description });
      return new Response(null, { status: 302, headers: { Location: "/admin/categories" } });
    } catch (e) {
      return `<div class="toast toast-error">${(e as Error).message}</div>`;
    }
  }, { body: t.Object({ name: t.String(), parentId: t.Optional(t.String()), description: t.Optional(t.String()) }) })
  .get("/categories/:id", async ({ params, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const detail = await uc.getCategoryDetail(params.id);
    if (!detail) return new Response("Not found", { status: 404 });
    const allCategories = await uc.getCategoryList();
    const body = renderView("pages/admin/category-form.eta", { categories: allCategories, category: detail.category, title: detail.category.name, csrfToken });
    return renderView("layouts/admin.eta", { body, title: detail.category.name, csrfToken });
  })
  .post("/categories/:id", async ({ params, body }) => {
    await uc.updateCategoryUseCase(params.id, { name: body.name, description: body.description });
    return new Response(null, { status: 302, headers: { Location: "/admin/categories" } });
  }, { body: t.Object({ name: t.String(), description: t.Optional(t.String()) }) })
  .post("/categories/:id/delete", async ({ params }) => {
    await uc.deleteCategoryUseCase(params.id);
    return new Response(null, { status: 302, headers: { Location: "/admin/categories" } });
  });
