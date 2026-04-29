import { eq } from "drizzle-orm";
import { getDb } from "../src/shared/infrastructure/db/index.ts";
import * as s from "../src/shared/infrastructure/db/schema.ts";

const db = getDb();
const BRAND = "Maison Élite";
const CURRENCY = "CLP";

const img = (query: string) =>
  `https://source.unsplash.com/900x1200/?${encodeURIComponent(query)}`;

const products = [
  ["vestido-midi-estampado-floral", "Vestido Midi Floral de Seda", img("luxury fashion editorial floral silk midi dress elegant model")],
  ["vestido-elegante-negro-largo", "Vestido Largo Negro Gala", img("luxury fashion editorial black evening gown elegant")],
  ["vestido-cocktail-bordado", "Vestido Cocktail Bordado Negro", img("luxury fashion editorial black cocktail dress embroidered")],
  ["blusa-seda-cruda-beige", "Blusa de Seda Beige Cruda", img("luxury fashion editorial beige silk blouse woman")],
  ["blusa-bordada-blanca-lino", "Blusa Blanca de Lino Bordado", img("minimal luxury fashion white linen blouse woman")],
  ["top-punto-fino-morado", "Top de Punto Fino Ciruela", img("luxury knitwear editorial purple top woman")],
  ["camisa-masculina-oversize-blanca", "Camisa Oversize Blanca Atelier", img("luxury fashion editorial oversized white shirt woman")],
  ["jeans-high-rise-skinny-negro", "Jeans Negro High Rise", img("luxury fashion editorial black jeans woman minimal")],
  ["pantalon-wide-leg-beige-franela", "Pantalón Wide Leg Beige", img("luxury fashion editorial beige wide leg trousers woman")],
  ["joggers-algodon-organico-gris", "Joggers Gris de Algodón Orgánico", img("elegant athleisure grey joggers fashion editorial")],
  ["mini-falda-plisada-gris-perla", "Mini Falda Plisada Gris Perla", img("luxury fashion editorial pleated skirt grey woman")],
  ["falda-midi-plisada-hilo-beige", "Falda Midi Plisada Beige", img("luxury fashion editorial beige pleated midi skirt")],
  ["cardigan-cashmere-cremoso", "Cardigan de Cashmere Crudo", img("luxury cashmere cardigan cream fashion editorial")],
  ["cardigan-largo-negro-lana", "Cardigan Largo Negro Merino", img("luxury black long cardigan fashion editorial")],
  ["jersey-lana-merino-azul-marino", "Jersey Merino Azul Marino", img("luxury navy merino sweater fashion editorial")],
  ["abrigo-gabardina-beige-clasico", "Abrigo Beige de Gabardina", img("luxury beige coat woman editorial street style")],
  ["trench-coat-camel-algodon", "Trench Coat Camel Signature", img("luxury camel trench coat woman editorial")],
  ["chaqueta-cuero-negro-nappa", "Chaqueta de Cuero Negro Nappa", img("luxury black leather jacket woman editorial")],
  ["cazadora-bomber-piel-marron", "Bomber Marrón de Piel Suave", img("luxury brown bomber jacket woman editorial")],
  ["conjunto-lenceria-encaje-negro", "Conjunto de Encaje Negro", img("luxury black lace lingerie editorial elegant")],
  ["camisa-clasica-oxford-blanca", "Camisa Oxford Blanca Clásica", img("luxury menswear white oxford shirt editorial")],
  ["camisa-lino-azul-celeste", "Camisa de Lino Azul Cielo", img("luxury menswear blue linen shirt editorial")],
  ["camisa-slim-estampado-leopardo", "Camisa Slim Print Heritage", img("luxury menswear patterned shirt editorial")],
  ["polera-cuello-redondo-gris-heather", "Polera Gris Heather Premium", img("luxury menswear grey t shirt editorial minimal")],
  ["polo-premium-pique-blanco", "Polo Blanco de Piqué Premium", img("luxury menswear white polo shirt editorial")],
  ["poleron-oversize-franela-cuadros", "Sobrecamisa de Franela Cuadros", img("luxury menswear plaid overshirt editorial")],
  ["sweater-cashmere-burdeos", "Sweater Cashmere Burdeos", img("luxury burgundy cashmere sweater men editorial")],
  ["pantalon-chino-slim-negro", "Pantalón Chino Negro Slim", img("luxury menswear black chinos editorial")],
  ["pantalon-vestir-gris-planas", "Pantalón de Vestir Gris con Pinzas", img("luxury menswear grey tailored trousers editorial")],
  ["jean-straight-fit-denim-oscuro", "Jean Straight Denim Oscuro", img("luxury menswear dark denim jeans editorial")],
  ["abrigo-lana-nautica-negro", "Abrigo Negro de Lana Náutica", img("luxury black wool coat men editorial")],
  ["gabardina-clasica-beige-lana", "Gabardina Beige de Lana", img("luxury beige trench coat men editorial")],
  ["chaqueta-bomber-piel-sintetica-negra", "Bomber Negra de Piel Mate", img("luxury black bomber jacket men editorial")],
  ["playa-piscina-short-negro", "Short de Baño Negro Resort", img("luxury resort black swim shorts men editorial")],
  ["bolso-tote-cuero-negro-profesional", "Tote Negro de Cuero Profesional", img("luxury black leather tote bag product editorial")],
  ["cartera-mano-piel-beige", "Cartera de Mano Beige", img("luxury beige leather handbag product editorial")],
  ["bolso-bandolera-lona-artistic", "Bandolera de Lona y Cuero", img("luxury canvas leather crossbody bag product")],
  ["clutch-noche-dorado", "Clutch Dorado de Noche", img("luxury gold evening clutch product editorial")],
  ["bolso-mochila-minimalista-negro", "Mochila Negra Minimalista", img("luxury black leather backpack product editorial")],
  ["collar-domino-dorado-fino", "Collar Eslabón Dorado Fino", img("luxury gold necklace jewelry product editorial")],
  ["aros-cilindricos-plateados", "Aros Cilíndricos de Plata", img("luxury silver earrings jewelry product editorial")],
  ["pulsera-eslabones-grises", "Pulsera de Eslabones Acero", img("luxury bracelet jewelry product editorial")],
  ["bufanda-lana-merino-gris", "Bufanda Merino Gris Perla", img("luxury grey wool scarf fashion editorial")],
  ["reloj-minimalista-negro-cuarzo", "Reloj Minimalista Negro", img("luxury black minimal watch product editorial")],
  ["zapatos-charme-nude-tacon-medio", "Stilettos Nude Tacón Medio", img("luxury nude heels product fashion editorial")],
  ["zapatos-charme-negro-tacon-alto", "Stilettos Negros de Noche", img("luxury black high heels product fashion editorial")],
  ["bailarinas-charme-negro-planas", "Bailarinas Negras de Charme", img("luxury black ballet flats product editorial")],
  ["zapatos-oxford-piel-negro-hombre", "Oxford Negro de Piel", img("luxury black oxford shoes men product editorial")],
  ["zapatillas-piel-blancas-minimalistas", "Zapatillas Blancas Minimalistas", img("luxury white leather sneakers product editorial")],
] as const;

async function getCategory(slug: string) {
  const [category] = await db.select().from(s.categories).where(eq(s.categories.slug, slug));
  if (!category) throw new Error(`Missing category ${slug}`);
  return category;
}

async function seedBeltIfMissing() {
  const accesorios = await getCategory("accesorios");
  await db.insert(s.categories).values({
    name: "Cinturones",
    slug: "cinturones",
    parentId: accesorios.id,
    description: "Cinturones de cuero y hebillas refinadas",
    sortOrder: 2,
    isActive: true,
  }).onConflictDoNothing();

  const cinturones = await getCategory("cinturones");
  await db.insert(s.products).values({
    name: "Cinturón Heritage de Cuero Negro",
    slug: "cinturon-heritage-cuero-negro",
    description: "Cinturón de cuero full grain con hebilla rectangular pulida. Una pieza discreta y precisa para elevar pantalones de vestir, denim oscuro o looks de oficina. Terminación artesanal, cantos sellados y ajuste clásico.",
    shortDescription: "Cinturón de cuero full grain con hebilla pulida",
    metaTitle: "Cinturón Heritage de Cuero Negro | Maison Élite",
    metaDescription: "Cinturón elegante de cuero full grain con hebilla pulida. Disponible en tallas S a XL.",
    brand: BRAND,
    categoryId: cinturones.id,
    editorialStatus: "published",
    isFeatured: true,
    baseImage: img("luxury black leather belt product editorial"),
    metadata: { gender: "unisex", collection: "heritage", material: "cuero full grain" },
  }).onConflictDoNothing();

  const [product] = await db.select().from(s.products).where(eq(s.products.slug, "cinturon-heritage-cuero-negro"));
  if (!product) return;

  for (const size of ["S", "M", "L", "XL"]) {
    const sku = `CH-CUE-NEG-${size}`;
    await db.insert(s.skus).values({
      productId: product.id,
      sku,
      variantLabel: `Negro / ${size}`,
      priceCents: 49990,
      currency: CURRENCY,
      isActive: true,
    }).onConflictDoNothing();
    const [skuRow] = await db.select().from(s.skus).where(eq(s.skus.sku, sku));
    if (skuRow) {
      await db.insert(s.inventoryItems).values({ skuId: skuRow.id, physicalStock: 12 }).onConflictDoNothing();
    }
  }
}

async function main() {
  // Remove demo electronics that do not belong to the Maison Élite brand.
  await db.delete(s.products).where(eq(s.products.slug, "wireless-headphones"));
  await db.delete(s.products).where(eq(s.products.slug, "usb-c-cable"));

  for (const [slug, name, baseImage] of products) {
    await db.update(s.products).set({
      name,
      brand: BRAND,
      baseImage,
      updatedAt: new Date(),
      metadata: { brandMood: "luxury editorial", imageQuery: baseImage },
    }).where(eq(s.products.slug, slug));
  }

  await seedBeltIfMissing();

  const allProducts = await db.select().from(s.products);
  console.log(`Maison Élite refined. Products in catalog: ${allProducts.length}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
