import { Elysia } from "elysia";
import { renderView } from "../../web/templates/engine.ts";
import { getCategoryList, getPublishedProductsForSitemap, getProductDetailPage } from "../../application/catalog/use-cases.ts";
import { searchProductsUseCase, searchAutocompleteUseCase, getProductListPage } from "../../application/catalog/search-use-cases.ts";
import { getCartItemCount } from "../../application/checkout/use-cases.ts";
import { sanitizeHtml } from "../../web/middleware/sanitize.ts";
import { ensureCsrfToken } from "../../web/helpers/csrf.ts";
import { escapeHtml } from "../../web/helpers/escape.ts";
import { CustomerSession } from "../../web/middleware/customer-session.ts";
import { verifySignedCookieValue } from "../../web/helpers/signed-cookie.ts";
import { getConfig } from "../../shared/infrastructure/config.ts";
import { catalogSearchReadModel } from "../composition/catalog.ts";

async function resolveSessionContext(cookie: Record<string, { value: unknown }>) {
  const customer = await CustomerSession.resolve(cookie);
  const sessionId = verifySignedCookieValue(cookie.sessionId?.value) ?? verifySignedCookieValue(cookie._cart?.value) ?? undefined;
  const cartCount = await getCartItemCount(sessionId ?? "", customer?.customerId);
  return { customer, cartCount };
}

export const storefrontRoutes = new Elysia()
  .get("/", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const { customer, cartCount } = await resolveSessionContext(cookie as Record<string, { value: unknown }>);
    const result = await searchProductsUseCase({ sortBy: "newest", pageSize: 8 }, catalogSearchReadModel);
    const categories = await getCategoryList();
    const body = renderView("pages/storefront/home.eta", { products: result.items, categories, csrfToken });
    return renderView("layouts/base.eta", { body, title: "Home", cartCount, customer, csrfToken });
  })
  .get("/categories/:slug", async ({ params, query, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const { customer, cartCount } = await resolveSessionContext(cookie as Record<string, { value: unknown }>);
    const categories = await getCategoryList();
    const category = categories.find((c: any) => c.slug === params.slug);
    if (!category) return new Response("Category not found", { status: 404 });
    const q = query as Record<string, string>;
    const result = await getProductListPage({
      categorySlug: params.slug,
      sortBy: (q.sort as any) ?? "newest",
      page: parseInt(q.page ?? "1", 10),
      pageSize: 12,
      minPriceCents: q.minPrice ? parseInt(q.minPrice, 10) : undefined,
      maxPriceCents: q.maxPrice ? parseInt(q.maxPrice, 10) : undefined,
      inStock: q.inStock === "1",
    }, catalogSearchReadModel);
    const body = renderView("pages/storefront/plp.eta", {
      category,
      products: result.items,
      categories,
      pagination: result,
      currentSort: q.sort ?? "newest",
      filters: { minPrice: q.minPrice ?? "", maxPrice: q.maxPrice ?? "", inStock: q.inStock === "1" },
      title: category.name,
      csrfToken,
    });
    return renderView("layouts/base.eta", { body, title: category.name, cartCount, customer, csrfToken });
  })
  .get("/products/:slug", async ({ params, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const { customer, cartCount } = await resolveSessionContext(cookie as Record<string, { value: unknown }>);
    const pdp = await getProductDetailPage(params.slug);
    if (!pdp) return new Response("Product not found", { status: 404 });
    const categories = await getCategoryList();
    const relatedResult = pdp.product.categoryId
      ? await searchProductsUseCase({ categoryId: pdp.product.categoryId, pageSize: 4 }, catalogSearchReadModel)
      : { items: [] };
    const body = renderView("pages/storefront/pdp.eta", {
      product: pdp.product,
      skus: pdp.skus,
      attributes: pdp.attributes,
      category: pdp.category,
      categories,
      skuAvailability: pdp.skuAvailability,
      totalStock: pdp.totalStock,
      relatedProducts: relatedResult.items.filter((r) => r.id !== pdp.product.id).slice(0, 4),
      title: pdp.product.name,
      metaDescription: pdp.product.description ?? `${pdp.product.name} - Compra online con envío a todo el país`,
      metaImage: pdp.product.baseImage,
      csrfToken,
    });
    return renderView("layouts/base.eta", {
      body,
      title: pdp.product.name,
      metaDescription: pdp.product.description ?? `${pdp.product.name} - Compra online con envío a todo el país`,
      metaImage: pdp.product.baseImage,
      canonicalUrl: `/products/${pdp.product.slug}`,
      jsonLd: buildProductJsonLd(pdp.product, pdp.skus, pdp.skuAvailability),
      cartCount,
      customer,
      csrfToken,
    });
  })
  .get("/search", async ({ query, cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const { customer, cartCount } = await resolveSessionContext(cookie as Record<string, { value: unknown }>);
    const q = (query as Record<string, string>).q ?? "";
    const safeQ = sanitizeHtml(q);
    const sort = (query as Record<string, string>).sort ?? "newest";
    const page = parseInt((query as Record<string, string>).page ?? "1", 10);
    const result = await searchProductsUseCase({
      query: q.trim() || undefined,
      sortBy: sort as any,
      page,
      pageSize: 12,
      minPriceCents: (query as Record<string, string>).minPrice ? parseInt((query as Record<string, string>).minPrice!, 10) : undefined,
      maxPriceCents: (query as Record<string, string>).maxPrice ? parseInt((query as Record<string, string>).maxPrice!, 10) : undefined,
      inStock: (query as Record<string, string>).inStock === "1",
    }, catalogSearchReadModel);
    const categories = await getCategoryList();
    const body = renderView("pages/storefront/plp.eta", {
      category: { name: q ? `Resultados para "${safeQ}"` : "Todos los productos", slug: "" },
      products: result.items,
      categories,
      pagination: result,
      currentSort: sort,
      searchQuery: q,
      filters: {
        minPrice: (query as Record<string, string>).minPrice ?? "",
        maxPrice: (query as Record<string, string>).maxPrice ?? "",
        inStock: (query as Record<string, string>).inStock === "1",
      },
      title: "Buscar",
      csrfToken,
    });
    return renderView("layouts/base.eta", { body, title: q ? `Buscar: ${safeQ}` : "Todos los productos", cartCount, customer, csrfToken });
  })
  .get("/api/search/suggest", async ({ query }) => {
    const q = ((query as Record<string, string>).q ?? "").trim();
    const results = await searchAutocompleteUseCase(q, 5, catalogSearchReadModel);
    if (results.length === 0) return "";
    let html = '<ul class="suggest-list">';
    for (const r of results) {
      const safeName = escapeHtml(r.name);
      const safeSlug = escapeHtml(r.slug);
      const safeImage = escapeHtml(r.image ?? "");
      html += `<li><a href="/products/${safeSlug}">`;
      if (r.image) html += `<img src="${safeImage}" alt="${safeName}" class="suggest-img">`;
      html += `<span class="suggest-name">${safeName}</span>`;
      if (r.price > 0) html += `<span class="suggest-price">$${(r.price / 100).toLocaleString('es')}</span>`;
      html += `</a></li>`;
    }
    html += "</ul>";
    return html;
  })
  .get("/sitemap.xml", async () => {
    const products = await getPublishedProductsForSitemap();
    const categories = await getCategoryList();
    const config = getConfig();
    const baseUrl = config.BASE_URL;
    const today = new Date().toISOString().split("T")[0];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    xml += `\n  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
    for (const cat of categories) {
      xml += `\n  <url><loc>${baseUrl}/categories/${escapeHtml(cat.slug)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }
    for (const p of products) {
      const lastmod = p.updatedAt instanceof Date ? p.updatedAt.toISOString().split("T")[0] : today;
      xml += `\n  <url><loc>${baseUrl}/products/${escapeHtml(p.slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
    }
    xml += `\n</urlset>`;
    return new Response(xml, { headers: { "Content-Type": "application/xml" } });
  })
  .get("/robots.txt", async () => {
    const config = getConfig();
    const baseUrl = config.BASE_URL;
    return `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /cart\nDisallow: /checkout\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
  })
  .get("/privacidad", async ({ cookie }) => {
    const csrfToken = ensureCsrfToken(cookie);
    const body = renderView("pages/storefront/privacy-policy.eta", {});
    return renderView("layouts/base.eta", { body, title: "Politica de Privacidad", csrfToken });
  });

function buildProductJsonLd(product: any, skus: any[], skuAvailability: { skuId: string; available: number }[]): string {
  const offers = skus.filter((s: any) => s.isActive).map((sku: any) => {
    const avail = skuAvailability.find(a => a.skuId === sku.id);
    const inStock = (avail?.available ?? 0) > 0;
    return {
      "@type": "Offer",
      "sku": sku.sku,
      "price": (sku.priceCents / 100).toFixed(2),
      "priceCurrency": sku.currency,
      "availability": `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`,
    };
  });
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description ?? "",
    "image": product.baseImage ?? undefined,
    "offers": offers.length === 1 ? offers[0] : { "@type": "AggregateOffer", "offers": offers },
  };
  return JSON.stringify(ld);
}
