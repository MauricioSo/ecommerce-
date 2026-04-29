import { getDb } from "../src/shared/infrastructure/db/index.ts";
import * as s from "../src/shared/infrastructure/db/schema.ts";
import { eq } from "drizzle-orm";

const db = getDb();
const BRAND = "Maison \u00c9lite";
const CURRENCY = "CLP";

const u = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

const WOMEN_SIZES = ["XS", "S", "M", "L", "XL"];
const MEN_SIZES = ["S", "M", "L", "XL", "XXL"];
const SHOES_W = ["35", "36", "37", "38", "39", "40", "41"];
const SHOES_M = ["39", "40", "41", "42", "43", "44", "45"];

const ALL_SIZES: Record<string, string[]> = {
  mujer: WOMEN_SIZES,
  hombre: MEN_SIZES,
  calzado_mujer: SHOES_W,
  calzado_hombre: SHOES_M,
  unica: ["U"],
};

// ALL_COLORS: unused, colors are defined inline per product

function makeSkus(
  productId: string,
  skuBase: string,
  variantLabel: string,
  priceCents: number,
  sizes: string[],
  colors: string[],
  stockPerSku = 10
) {
  const skus: (typeof s.skus.$inferInsert)[] = [];
  for (const color of colors) {
    for (const size of sizes) {
      skus.push({
        productId,
        sku: `${skuBase}-${color.toUpperCase().slice(0, 3)}-${size}`.replace(/\s/g, ""),
        variantLabel: `${color} / ${size}`,
        priceCents,
        currency: CURRENCY,
        isActive: true,
      });
    }
  }
  return skus;
}

async function seed() {
  console.log("Seeding Maison \u00c9lite catalog...");

  // ─── CATEGORIES ───────────────────────────────────────────────────────────
  // Step 1: Insert parent categories
  await db.insert(s.categories).values([
    { name: "Ropa de Mujer", slug: "ropa-de-mujer", description: "Prendas de alta costura para la mujer moderna", sortOrder: 0, isActive: true },
    { name: "Ropa de Hombre", slug: "ropa-de-hombre", description: "Elegancia atemporal para el hombre contempor\u00e1neo", sortOrder: 1, isActive: true },
    { name: "Accesorios", slug: "accesorios", description: "Complementos que definen el estilo personal", sortOrder: 2, isActive: true },
    { name: "Calzado", slug: "calzado", description: "Zapatos cuidadosamente seleccionados", sortOrder: 3, isActive: true },
  ]).onConflictDoNothing();

  // Step 2: Resolve parent category IDs
  const slugToCat = async (slug: string) => {
    const [row] = await db.select().from(s.categories).where(eq(s.categories.slug, slug));
    if (!row) throw new Error(`Category not found: ${slug}`);
    return row;
  };
  const catMujer = await slugToCat("ropa-de-mujer");
  const catHombre = await slugToCat("ropa-de-hombre");
  const catAcc = await slugToCat("accesorios");
  const catCalzado = await slugToCat("calzado");

  // Step 3: Insert subcategories with parent IDs
  await db.insert(s.categories).values([
    { name: "Vestidos", slug: "vestidos", description: "Vestidos para toda ocasi\u00f3n", sortOrder: 0, isActive: true, parentId: catMujer.id },
    { name: "Tops y Blusas", slug: "tops-y-blusas", description: "Blusas y tops de dise\u00f1o", sortOrder: 1, isActive: true, parentId: catMujer.id },
    { name: "Pantalones y Faldas", slug: "pantalones-y-faldas", description: "Pantalones y faldas de ocasi\u00f3n", sortOrder: 2, isActive: true, parentId: catMujer.id },
    { name: "Abrigos y Chaquetas", slug: "abrigos-mujer", description: "Abrigos de temporada", sortOrder: 3, isActive: true, parentId: catMujer.id },
    { name: "Lencer\u00eda y Homewear", slug: "lenceria", description: "Lencer\u00eda fina y ropa de descanso", sortOrder: 4, isActive: true, parentId: catMujer.id },
    { name: "Camisas", slug: "camisas-hombre", description: "Camisas formales y casuales", sortOrder: 0, isActive: true, parentId: catHombre.id },
    { name: "Poleras y Polerones", slug: "poleras-hombre", description: "Poleras y polerones de hilado fino", sortOrder: 1, isActive: true, parentId: catHombre.id },
    { name: "Pantalones", slug: "pantalones-hombre", description: "Pantalones de dise\u00f1o", sortOrder: 2, isActive: true, parentId: catHombre.id },
    { name: "Abrigos y Chaquetas", slug: "abrigos-hombre", description: "Abrigos de temporada", sortOrder: 3, isActive: true, parentId: catHombre.id },
    { name: "Bolsos y Carteras", slug: "bolsos", description: "Bolsos y carteras de dise\u00f1ador", sortOrder: 0, isActive: true, parentId: catAcc.id },
    { name: "Joyer\u00eda y Relojes", slug: "joyeria", description: "Joyas y relojes de alta joyer\u00eda", sortOrder: 1, isActive: true, parentId: catAcc.id },
    { name: "Zapatos de Mujer", slug: "zapatos-mujer", description: "Zapatos de dise\u00f1o para mujer", sortOrder: 0, isActive: true, parentId: catCalzado.id },
    { name: "Zapatos de Hombre", slug: "zapatos-hombre", description: "Zapatos de dise\u00f1o para hombre", sortOrder: 1, isActive: true, parentId: catCalzado.id },
  ]).onConflictDoNothing();

  // Step 4: Resolve all category IDs
  const catVestidos = await slugToCat("vestidos");
  const catTops = await slugToCat("tops-y-blusas");
  const catPantalonesM = await slugToCat("pantalones-y-faldas");
  const catAbrigosM = await slugToCat("abrigos-mujer");
  const catLenceria = await slugToCat("lenceria");
  const catCamisas = await slugToCat("camisas-hombre");
  const catPoleras = await slugToCat("poleras-hombre");
  const catPantalonesH = await slugToCat("pantalones-hombre");
  const catAbrigosH = await slugToCat("abrigos-hombre");
  const catBolsos = await slugToCat("bolsos");
  const catJoyeria = await slugToCat("joyeria");
  const catZapatosM = await slugToCat("zapatos-mujer");
  const catZapatosH = await slugToCat("zapatos-hombre");

  // ─── ATTRIBUTES ────────────────────────────────────────────────────────────
  await db.insert(s.attributes).values([
    {
      name: "Color",
      slug: "color",
      type: "select",
      options: ["Negro", "Blanco", "Gris", "Beige", "Crudo", "Camel", "Azul Marino", "Bord\u00f3", "Rojo", "Marr\u00f3n", "Dorado", "Plateado", "Nude", "Azul Oscuro", "Estampado"],
      isRequired: true,
      isFilterable: true,
    },
    {
      name: "Talla",
      slug: "talla",
      type: "select",
      options: ["XS", "S", "M", "L", "XL", "XXL", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "U"],
      isRequired: true,
      isFilterable: true,
    },
  ]).onConflictDoNothing();

  const [attrColor] = await db.select().from(s.attributes).where(eq(s.attributes.slug, "color"));
  const [attrTalla] = await db.select().from(s.attributes).where(eq(s.attributes.slug, "talla"));

  // Link attributes to categories
  const allCatIds = [
    catMujer.id, catHombre.id, catAcc.id, catCalzado.id,
    catVestidos.id, catTops.id, catPantalonesM.id, catAbrigosM.id, catLenceria.id,
    catCamisas.id, catPoleras.id, catPantalonesH.id, catAbrigosH.id,
    catBolsos.id, catJoyeria.id, catZapatosM.id, catZapatosH.id,
  ];
  await db.insert(s.categoryAttributes).values(
    allCatIds.flatMap((catId) => [
      { categoryId: catId, attributeId: attrColor.id, sortOrder: 0 },
      { categoryId: catId, attributeId: attrTalla.id, sortOrder: 1 },
    ])
  ).onConflictDoNothing();

  // ─── PRODUCTS ──────────────────────────────────────────────────────────────
  const products = [
    // ── WOMEN 1–20 ──────────────────────────────────────────────────────────
    {
      name: "Vestido Midi Estampado Floral",
      slug: "vestido-midi-estampado-floral",
      description: "Un vestido midi de silueta fluida con estampado floral de inspiraci\u00f3n art\u00edstica. Confeccionado en seda artificial de alta calidad con ca\u00edda elegante. El escote en V y la manga abullonada lo convierten en una pieza protagonista para cualquier ocasi\u00f3n especial.",
      shortDescription: "Vestido midi estampado floral con ca\u00edda fluida",
      categoryId: catVestidos.id,
      editorialStatus: "published",
      baseImage: u("1515886657613-9f3515b0c78f"),
      metadata: { gender: "woman", collection: "primavera-verano" },
      skus: makeSkus("", "VM-EFL", "Estampado / Talla", 89990, ["XS","S","M","L"], ["Estampado"]),
    },
    {
      name: "Vestido Elegante Negro Largo",
      slug: "vestido-elegante-negro-largo",
      description: "Vestido largo de gasa con drapeado en la cintura que crea un efecto de silueta impresionantemente esbelto. El negro profundo y la ca\u00edda suave lo hacen perfecto para eventos de etiqueta. Forro interior en acetato para mayor comodidad.",
      shortDescription: "Vestido largo negro en gasa con drapeado",
      categoryId: catVestidos.id,
      editorialStatus: "published",
      baseImage: u("1594938298603-c8148c4b4a0e"),
      metadata: { gender: "woman", collection: "noche" },
      skus: makeSkus("", "VE-NEG", "Negro / Talla", 129990, WOMEN_SIZES, ["Negro"]),
    },
    {
      name: "Vestido Cocktail Bordado",
      slug: "vestido-cocktail-bordado",
      description: "Mini vestido de punto con bordados artesanales en el busto y la espalda. La combinaci\u00f3n de bordados sobre tela negra crea un contraste sofisticado. Perfecto para cenas de gala y eventos cocktail.",
      shortDescription: "Mini vestido bordado con detalles artesanales",
      categoryId: catVestidos.id,
      editorialStatus: "published",
      baseImage: u("1572804013309-59a88b7e92f1"),
      metadata: { gender: "woman", collection: "cocktail" },
      skus: makeSkus("", "VC-BOR", "Bordado / Talla", 79990, ["XS","S","M","L"], ["Negro"]),
    },
    {
      name: "Blusa de Seda Cruda Beige",
      slug: "blusa-seda-cruda-beige",
      description: "Blusa de seda cruda con textura natural org\u00e1nica. El color beige versatilidad permite combinarla desde looks de oficina hasta outfits nocturna. Con cuello solapa y botonadura oculta.",
      shortDescription: "Blusa de seda cruda con cuello solapa",
      categoryId: catTops.id,
      editorialStatus: "published",
      baseImage: u("1485968579580-b6d095142e6e"),
      metadata: { gender: "woman", collection: "office" },
      skus: makeSkus("", "BS-BEI", "Beige / Talla", 54990, ["XS","S","M","L","XL"], ["Beige"]),
    },
    {
      name: "Blusa Bordada Blanca de Lino",
      slug: "blusa-bordada-blanca-lino",
      description: "Blusa de lino 100% con bordados geom\u00e9tricos en las mangas. El lino es perfecto para la temporada c\u00e1lida ofreciendo frescura y estilo. Cada bordado es realizado a mano por artesanos locales.",
      shortDescription: "Blusa de lino con bordados artesanales",
      categoryId: catTops.id,
      editorialStatus: "published",
      baseImage: u("1523381294911-8d3cead5c2b0"),
      metadata: { gender: "woman", collection: "artesanal" },
      skus: makeSkus("", "BB-LIN", "Blanco / Talla", 45990, ["XS","S","M","L"], ["Blanco"]),
    },
    {
      name: "Top de Punto Fino Morado",
      slug: "top-punto-fino-morado",
      description: "Top de punto fino con textura acanalada que se adapta perfectamente al cuerpo. El color morado intenso a\u00f1ade un toque de personalidad a cualquier outfit. Mangas ragl\u00e1n para mayor libertad de movimiento.",
      shortDescription: "Top de punto fino morado con textura acanalada",
      categoryId: catTops.id,
      editorialStatus: "published",
      baseImage: u("1564257631407-4deb1f99d992"),
      metadata: { gender: "woman", collection: "essentials" },
      skus: makeSkus("", "TP-MOR", "Morado / Talla", 32990, ["XS","S","M","L","XL"], ["Morado"]),
    },
    {
      name: "Camisa Masculina Oversize Blanca",
      slug: "camisa-masculina-oversize-blanca",
      description: "Inspirada en la camisa cl\u00e1sica masculina pero reinterpretada con proporciones oversize para la mujer moderna. Algod\u00f3n egipcio 200 hilos con acabado suave. Pu\u00f1os con bot\u00f3n y cuello italiano.",
      shortDescription: "Camisa oversize en algod\u00f3n puro",
      categoryId: catTops.id,
      editorialStatus: "published",
      baseImage: u("1509631179647-0177331693ae"),
      metadata: { gender: "woman", collection: "unisex" },
      skus: makeSkus("", "CM-OVS", "Blanco / Talla", 42990, ["XS","S","M","L","XL"], ["Blanco"]),
    },
    {
      name: "Jeans High Rise Skinny Negro",
      slug: "jeans-high-rise-skinny-negro",
      description: "Jeans de corte skinny con tiro alto que alarga visualmente la silueta. Denim con elastano para maxima comodidad sin perder forma. Five pockets clasico con acabados negro oxido.",
      shortDescription: "Jeans skinny tiro alto en denim negro",
      categoryId: catPantalonesM.id,
      editorialStatus: "published",
      baseImage: u("1541099649105-f865ad2e3aef"),
      metadata: { gender: "woman", collection: "essentials" },
      skus: makeSkus("", "JN-SKN", "Negro / Talla", 64990, ["XS","S","M","L","XL"], ["Negro"]),
    },
    {
      name: "Pantalón Wide Leg Beige de Franela",
      slug: "pantalon-wide-leg-beige-franela",
      description: "Pantal\u00f3n wide leg de franela weight que drapea con una elegancia incomparable. El tiro medio y la pinza frontal crean una silueta sofisticada. Perfecto para combinar con blazers o jerseys de punto.",
      shortDescription: "Pantal\u00f3n wide leg en franela beige",
      categoryId: catPantalonesM.id,
      editorialStatus: "published",
      baseImage: u("1594938298603-c8148c4b4a0e"),
      metadata: { gender: "woman", collection: "office" },
      skus: makeSkus("", "PW-BEI", "Beige / Talla", 58990, ["XS","S","M","L","XL"], ["Beige"]),
    },
    {
      name: "Joggers de Algodón Orgánico Gris",
      slug: "joggers-algodon-organico-gris",
      description: "Joggers de corte contempor\u00e1neo en algod\u00f3n org\u00e1nico certificado. La cintura el\u00e1stica con cord\u00f3n y los pu\u00f1os ajustados ofrecen el equilibrio perfecto entre comodidad y estilo. Ideales para el d\u00eda a d\u00eda.",
      shortDescription: "Joggers en algod\u00f3n org\u00e1nico con corte moderno",
      categoryId: catPantalonesM.id,
      editorialStatus: "published",
      baseImage: u("1554568218-0f1715e72254"),
      metadata: { gender: "woman", collection: "loungewear" },
      skus: makeSkus("", "JG-GRIS", "Gris / Talla", 39990, ["XS","S","M","L","XL"], ["Gris"]),
    },
    {
      name: "Mini Falda Plisada Gris Perla",
      slug: "mini-falda-plisada-gris-perla",
      description: "Mini falda de pliegues cl\u00e1sicos en gabo que a\u00f1ade movimiento y vida a cada paso. El gris perla es un tono vers\u00e1til que combina con todo el guardarropa. Forro interior para mayor confort.",
      shortDescription: "Mini falda plisada en gabo gris perla",
      categoryId: catPantalonesM.id,
      editorialStatus: "published",
      baseImage: u("1583496661160-fb5218afa5a2"),
      metadata: { gender: "woman", collection: "essentials" },
      skus: makeSkus("", "SF-PLS", "Gris / Talla", 44990, ["XS","S","M","L"], ["Gris"]),
    },
    {
      name: "Falda Midi Plisada en Hilo Beige",
      slug: "falda-midi-plisada-hilo-beige",
      description: "Falda midi de pliegues anchos en hilo de verano. La silueta fluida y el largo midi la convierten en una prenda sofisticada para cualquier ocasi\u00f3n. Costuras escondidas para un acabado impecable.",
      shortDescription: "Falda midi plisada en hilo natural",
      categoryId: catPantalonesM.id,
      editorialStatus: "published",
      baseImage: u("1583744946564-b52ac1c389c8"),
      metadata: { gender: "woman", collection: "primavera-verano" },
      skus: makeSkus("", "FM-PLI", "Beige / Talla", 52990, ["XS","S","M","L","XL"], ["Beige"]),
    },
    {
      name: "Cardigan de Cashmere Cremoso",
      slug: "cardigan-cashmere-cremoso",
      description: "Cardigan de cashmere 100% de pelo extra suave con textura de punto cardinal. El color crudo permite infinitas combinaciones. Pu\u00f1os y bajo de canal\u00e9 que impiden que pierdan forma.",
      shortDescription: "Cardigan de cashmere puro de punto cardinal",
      categoryId: catAbrigosM.id,
      editorialStatus: "published",
      baseImage: u("1544022613-e87ca75a178a"),
      metadata: { gender: "woman", collection: "invierno" },
      skus: makeSkus("", "CD-CSH", "Crudo / Talla", 149990, ["XS","S","M","L"], ["Crudo"]),
    },
    {
      name: "Cardigan Largo Negro de Lana",
      slug: "cardigan-largo-negro-lana",
      description: "Cardigan extralargo de lana merino con tacto suave y abrigador. El diseno abierto sin botonadura permite usarlo como capa sobre cualquier outfit. Bolsos escondidos para un look limpio.",
      shortDescription: "Cardigan extralargo en lana merino",
      categoryId: catAbrigosM.id,
      editorialStatus: "published",
      baseImage: u("1434389677669-e08b4cac3105"),
      metadata: { gender: "woman", collection: "invierno" },
      skus: makeSkus("", "CL-NEG", "Negro / Talla", 119990, ["XS","S","M","L","XL"], ["Negro"]),
    },
    {
      name: "Jersey de Lana Merino Azul Marino",
      slug: "jersey-lana-merino-azul-marino",
      description: "Jersey de punto liso en lana merino extrafina 18.5 micras. El azul marino es un cl\u00e1sico que no pasa de moda. Cuello redondo con acabado de canal\u00e9 que mantiene la forma.",
      shortDescription: "Jersey de lana merino azul marino",
      categoryId: catAbrigosM.id,
      editorialStatus: "published",
      baseImage: u("1576566588028-4147f3842f27"),
      metadata: { gender: "woman", collection: "invierno" },
      skus: makeSkus("", "JL-MER", "Azul Marino / Talla", 79990, ["XS","S","M","L","XL"], ["Azul Marino"]),
    },
    {
      name: "Abrigo de Gabardina Beige Cl\u00e1sico",
      slug: "abrigo-gabardina-beige-clasico",
      description: "Abrigo de gabardina de peso medio con corte cl\u00e1sico de cuello de solapa. Un basic atemporal que dura generaciones. Forrado en acetato de seda para una ca\u00edda perfecta.",
      shortDescription: "Abrigo de gabardina beige de corte cl\u00e1sico",
      categoryId: catAbrigosM.id,
      editorialStatus: "published",
      baseImage: u("1539109136881-3be0616acf4b"),
      metadata: { gender: "woman", collection: "todo-tempo" },
      skus: makeSkus("", "AG-GAB", "Beige / Talla", 189990, ["XS","S","M","L"], ["Beige"]),
    },
    {
      name: "Trench Coat Camel de Algodón",
      slug: "trench-coat-camel-algodon",
      description: "Trench coat iconico en gabardina de algodon con tratamiento hidrofugo. El color camel es sinonimo de elegancia casual. Con hombreras y cinturon de cuero sintetico.",
      shortDescription: "Trench coat en gabardina de algod\u00f3n",
      categoryId: catAbrigosM.id,
      editorialStatus: "published",
      baseImage: u("1523381210434-271e8be1c52b"),
      metadata: { gender: "woman", collection: "todo-tempo" },
      skus: makeSkus("", "TR-CAM", "Camel / Talla", 219990, ["XS","S","M","L","XL"], ["Camel"]),
    },
    {
      name: "Chaqueta de Cuero Negro Nappa",
      slug: "chaqueta-cuero-negro-nappa",
      description: "Chaqueta de cuero nappa graso con acabado texturizado \u00fanico. El cuero nappa es conocido por su suavidad excepcional y durabilidad. Forro interior de punto para mayor calidez.",
      shortDescription: "Chaqueta de cuero nappa con acabado graso",
      categoryId: catAbrigosM.id,
      editorialStatus: "published",
      baseImage: u("1551028719-00167b16eac5"),
      metadata: { gender: "woman", collection: "glam" },
      skus: makeSkus("", "CK-NAP", "Negro / Talla", 249990, ["XS","S","M","L"], ["Negro"]),
    },
    {
      name: "Cazadora Bomber de Piel Marrón",
      slug: "cazadora-bomber-piel-marron",
      description: "Cazadora bomber en piel sint\u00e9tica de alta calidad con acabados met\u00e1licos dorados. La silueta relajada y el color marr\u00f3n chocolate a\u00f1aden un toque effortless chic. Ribete en cuello, pu\u00f1os y bajo.",
      shortDescription: "Cazadora bomber en piel sint\u00e9tica dorada",
      categoryId: catAbrigosM.id,
      editorialStatus: "published",
      baseImage: u("1548126039-4c325c8c2d8b"),
      metadata: { gender: "woman", collection: "glam" },
      skus: makeSkus("", "BZ-BR", "Marr\u00f3n / Talla", 139990, ["XS","S","M","L","XL"], ["Marr\u00f3n"]),
    },
    {
      name: "Conjunto Lencería de Encaje Negro",
      slug: "conjunto-lenceria-encaje-negro",
      description: "Conjunto de lencer\u00eda en encaje floral bordado con clip en la parte superior. La combinaci\u00f3n de encaje stretch y a\u00f1o realza la figura con delicadeza. Includes tanga y brawl a juego.",
      shortDescription: "Conjunto de lencer\u00eda en encaje floral",
      categoryId: catLenceria.id,
      editorialStatus: "published",
      baseImage: u("1617331140175-45b8d6e8595c"),
      metadata: { gender: "woman", collection: "lenceria" },
      skus: makeSkus("", "LN-ENC", "Negro / Talla", 59990, ["XS","S","M","L"], ["Negro"]),
    },
    // ── MEN 21–35 ────────────────────────────────────────────────────────────
    {
      name: "Camisa Clásica Oxford Blanca",
      slug: "camisa-clasica-oxford-blanca",
      description: "Camisa oxford cl\u00e1sica en algod\u00f3n 100% con cuello button-down. El tejido oxford a\u00f1ade textura y car\u00e1cter sin perder formalidad. Perfecta para la oficina o eventos semiformales.",
      shortDescription: "Camisa oxford cl\u00e1sica en algod\u00f3n puro",
      categoryId: catCamisas.id,
      editorialStatus: "published",
      baseImage: u("1602810318383-e386cc2a3ccf"),
      metadata: { gender: "man", collection: "office" },
      skus: makeSkus("", "CO-WHT", "Blanco / Talla", 54990, MEN_SIZES, ["Blanco"]),
    },
    {
      name: "Camisa de Lino Azul C\u00e9leste",
      slug: "camisa-lino-azul-celeste",
      description: "Camisa de lino 100% con textura natural \u00fanica. El color azul c\u00e9leste aporta frescura y versatilidad para looks de primavera-verano. Pu\u00f1os con botones y mirada con tabla posterior.",
      shortDescription: "Camisa de lino puro en azul c\u00e9leste",
      categoryId: catCamisas.id,
      editorialStatus: "published",
      baseImage: u("1620012253292-c15cc3e6df9d"),
      metadata: { gender: "man", collection: "primavera-verano" },
      skus: makeSkus("", "CL-AZU", "Azul / Talla", 49990, MEN_SIZES, ["Azul"]),
    },
    {
      name: "Camisa Slim Fit Estampado Leopardo",
      slug: "camisa-slim-estampado-leopardo",
      description: "Camisa slim fit con estampado de leopardo en tonos tierras. Un impreso audaz que se convierte en el protagonista del outfit. Confeccionada en viscosa con ca\u00edda suave y elegante.",
      shortDescription: "Camisa slim fit con estampado leopard",
      categoryId: catCamisas.id,
      editorialStatus: "published",
      baseImage: u("1607587247740-0f6ad7d47b3f"),
      metadata: { gender: "man", collection: "statement" },
      skus: makeSkus("", "CS-LEO", "Estampado / Talla", 64990, ["S","M","L","XL"], ["Estampado"]),
    },
    {
      name: "Polera Cuello Redondo Gris Heather",
      slug: "polera-cuello-redondo-gris-heather",
      description: "Polera b\u00e1sica de corte regular en meccla de algod\u00f3n p\u00e9ruviano y poli\u00e9ster. El acabado heather a\u00f1ade profundidad al color gris. Cuello, pu\u00f1os y bajo en canal\u00e9 que mantienen la forma.",
      shortDescription: "Polera b\u00e1sica en mezcla de algod\u00f3n",
      categoryId: catPoleras.id,
      editorialStatus: "published",
      baseImage: u("1578681994506-b8b463d0b5c7"),
      metadata: { gender: "man", collection: "essentials" },
      skus: makeSkus("", "PR-HEG", "Gris / Talla", 32990, MEN_SIZES, ["Gris"]),
    },
    {
      name: "Polo Premium de Piqué Blanco",
      slug: "polo-premium-pique-blanco",
      description: "Polo de piqué de alg\u00f3n org\u00e1nico con textura cl\u00e1sica de player. El corte regular y los detalles como el logo bordado lo elevan por encima del polo b\u00e1sico. Perfecto para un smart casual refinado.",
      shortDescription: "Polo premium en piqué de algod\u00f3n org\u00e1nico",
      categoryId: catPoleras.id,
      editorialStatus: "published",
      baseImage: u("1625911083067-64e84e2f6a73"),
      metadata: { gender: "man", collection: "smart-casual" },
      skus: makeSkus("", "PP-PIQ", "Blanco / Talla", 44990, ["S","M","L","XL","XXL"], ["Blanco"]),
    },
    {
      name: "Polerón Oversize de Franela Cuadros",
      slug: "poleron-oversize-franela-cuadros",
      description: "Poler\u00f3n oversize en franela a cuadros deinspiraci\u00f3n cl\u00e1sica. El apilamiento de capas es perfecto con esta prenda que aporta calidez y car\u00e1cter. Bolsos de parche con forro de franela.",
      shortDescription: "Poler\u00f3n oversize en franela a cuadros",
      categoryId: catPoleras.id,
      editorialStatus: "published",
      baseImage: u("1578587014498-ead7c9e68c1e"),
      metadata: { gender: "man", collection: "casual" },
      skus: makeSkus("", "PU-CUA", "Estampado / Talla", 69990, ["S","M","L","XL","XXL"], ["Estampado"]),
    },
    {
      name: "Sweater de Cashmere Burdeos",
      slug: "sweater-cashmere-burdeos",
      description: "Sweater de punto liso en cashmere 100% de 2 capas. El color burdeos aporta un toque de riqueza y sofisticaci\u00f3n. Un lujo silencioso que se siente desde la primera puesta.",
      shortDescription: "Sweater de cashmere puro en color burdeos",
      categoryId: catPoleras.id,
      editorialStatus: "published",
      baseImage: u("1576566588028-4147f3842f27"),
      metadata: { gender: "man", collection: "lujo" },
      skus: makeSkus("", "SC-BUR", "Burdeos / Talla", 179990, ["S","M","L","XL"], ["Bord\u00f3"]),
    },
    {
      name: "Pantalón Chino Slim Negro",
      slug: "pantalon-chino-slim-negro",
      description: "Pantal\u00f3n chino slim fit en meccla de algod\u00f3n y spandex. El negro es versatile para crear infinitas combinaciones. Cinco bolsillos con acabado chino cl\u00e1sico y cierre de mosquet\u00f3n.",
      shortDescription: "Pantal\u00f3n chino slim en meccla de algod\u00f3n",
      categoryId: catPantalonesH.id,
      editorialStatus: "published",
      baseImage: u("1624378439575-8701d4da2b16"),
      metadata: { gender: "man", collection: "essentials" },
      skus: makeSkus("", "PC-SLN", "Negro / Talla", 59990, MEN_SIZES, ["Negro"]),
    },
    {
      name: "Pantalón de Vestir Gris Planas",
      slug: "pantalon-vestir-gris-planas",
      description: "Pantal\u00f3n de vestir en lana fría con表裤 que drapea con elegancia. El gris mittel es perfecto para trajes cl\u00e1sicos o looks separados. Preters ydouble forward pleats para mayor comodidad.",
      shortDescription: "Pantal\u00f3n de vestir en lana fría gris",
      categoryId: catPantalonesH.id,
      editorialStatus: "published",
      baseImage: u("1473966963273-7f1beb9d5e7e"),
      metadata: { gender: "man", collection: "office" },
      skus: makeSkus("", "PV-GRI", "Gris / Talla", 74990, ["S","M","L","XL","XXL"], ["Gris"]),
    },
    {
      name: "Jean Straight Fit Denim Oscuro",
      slug: "jean-straight-fit-denim-oscuro",
      description: "Jean de corte straight fit en denim de 12 oz con lavado oscuro. El corte straight es universalmente favorecedor y atemporal.五金 mosquet\u00f3n y remaches metal.",
      shortDescription: "Jean straight fit en denim oscurecido",
      categoryId: catPantalonesH.id,
      editorialStatus: "published",
      baseImage: u("1542272604-787c3835535d"),
      metadata: { gender: "man", collection: "essentials" },
      skus: makeSkus("", "JD-STR", "Azul Oscuro / Talla", 69990, MEN_SIZES, ["Azul Oscuro"]),
    },
    {
      name: "Abrigo de Lana N\u00e1utica Negro",
      slug: "abrigo-lana-nautica-negro",
      description: "Abrigo de lana n\u00e1utica de peso pesado con cuello de solapa. El negro es sinonismo de elegancia urbana. Forrado en satin para mayor comodidad al vestir y desvestir.",
      shortDescription: "Abrigo de lana n\u00e1utica de peso pesado",
      categoryId: catAbrigosH.id,
      editorialStatus: "published",
      baseImage: u("1507680434567-5413ca77b0d0"),
      metadata: { gender: "man", collection: "invierno" },
      skus: makeSkus("", "AN-NAU", "Negro / Talla", 279990, ["S","M","L","XL","XXL"], ["Negro"]),
    },
    {
      name: "Gabardina Clásica Beige de Lana",
      slug: "gabardina-clasica-beige-lana",
      description: "Gabardina clasica en lana reusable con tratamiento impermeable. El color beige es sinonimo de estilo atemporal masculino. Con hombreras y cinturón de cuero.",
      shortDescription: "Gabardina cl\u00e1sica en lana reusable",
      categoryId: catAbrigosH.id,
      editorialStatus: "published",
      baseImage: u("1474903232627-1d6c8f3b9c1e"),
      metadata: { gender: "man", collection: "todo-tempo" },
      skus: makeSkus("", "GB-LAN", "Beige / Talla", 249990, ["S","M","L","XL","XXL"], ["Beige"]),
    },
    {
      name: "Chaqueta Bomber de Piel Sintética Negra",
      slug: "chaqueta-bomber-piel-sintetica-negra",
      description: "Chaqueta bomber en piel sint\u00e9tica premium con acabado brillo sutil. La silueta relaxed y los ribetes en contraste crean un look contemporaineo. Interior de punto para mayor calidez.",
      shortDescription: "Bomber en piel sint\u00e9tica premium",
      categoryId: catAbrigosH.id,
      editorialStatus: "published",
      baseImage: u("1551028719-00167b16eac5"),
      metadata: { gender: "man", collection: "glam" },
      skus: makeSkus("", "BB-SIN", "Negro / Talla", 119990, ["S","M","L","XL","XXL"], ["Negro"]),
    },
    {
      name: "Playa y Piscina Short Negro",
      slug: "playa-piscina-short-negro",
      description: "Short de ba\u00f1o de secado r\u00e1pido en poliamida con forro de malla. El negro cl\u00e1sico y el corte moderno lo convierten en un b\u00e1sico del verano. Bolsos laterales con drenaje.",
      shortDescription: "Short de ba\u00f1o de secado r\u00e1pido",
      categoryId: catPantalonesH.id,
      editorialStatus: "published",
      baseImage: u("1521577352947-9bb58764b69a"),
      metadata: { gender: "man", collection: "playa" },
      skus: makeSkus("", "SH-NEG", "Negro / Talla", 34990, ["S","M","L","XL","XXL"], ["Negro"]),
    },
    // ── ACCESSORIES 36–45 ────────────────────────────────────────────────────
    {
      name: "Bolso Tote de Cuero Negro Profesional",
      slug: "bolso-tote-cuero-negro-profesional",
      description: "Bolso tote de cuero regenerado con acabado liso profesional. El dise\u00f1o arquitect\u00f3nico con asas de apuro permite usarlo como bolso de trabajo o fins de semana. Compartimiento para laptop de 15\".",
      shortDescription: "Tote de cuero profesional con compartimento laptop",
      categoryId: catBolsos.id,
      editorialStatus: "published",
      baseImage: u("1548036161-18f9f32c5cc2"),
      metadata: { gender: "unisex", collection: "office" },
      skus: makeSkus("", "BT-NEG", "Negro / \u00danica", 89990, ["U"], ["Negro"]),
    },
    {
      name: "Cartera de Mano en Piel Beige",
      slug: "cartera-mano-piel-beige",
      description: "Cartera de mano en piel curtida vegetal con acabado nude. El dise\u00f1o estructurado con cierre de clip dorado es perfecto para occasions especiales. Interior forrado en ante.",
      shortDescription: "Cartera de mano en piel curtida vegetal",
      categoryId: catBolsos.id,
      editorialStatus: "published",
      baseImage: u("1584917865442-de89df76afd3"),
      metadata: { gender: "woman", collection: "occasion" },
      skus: makeSkus("", "CH-BEI", "Beige / \u00danica", 74990, ["U"], ["Beige"]),
    },
    {
      name: "Bolso Bandolera de Lona Artistic",
      slug: "bolso-bandolera-lona-artistic",
      description: "Bolso bandolera en lona de alg\u00f3n con detalles de cuero en los acabados. La combinaci\u00f3n de materiales crea un look despreocupado y sofisticado a la vez. Adjustable strap with carabiner.",
      shortDescription: "Bandolera en lona con detalles de cuero",
      categoryId: catBolsos.id,
      editorialStatus: "published",
      baseImage: u("1553062407-98eeb64c6a62"),
      metadata: { gender: "unisex", collection: "casual" },
      skus: makeSkus("", "BB-LON", "Estampado / \u00danica", 49990, ["U"], ["Estampado"]),
    },
    {
      name: "Clutch de Noche Dorado",
      slug: "clutch-noche-dorado",
      description: "Clutch de mano en metal dorado con textura de malla. El color dorado es el complemento perfecto para looks de noche. Cerradura de cl\u00e1sica de bisagra oculta.",
      shortDescription: "Clutch dorado de noche en metal",
      categoryId: catBolsos.id,
      editorialStatus: "published",
      baseImage: u("1566151544426-7a4f6f3a4e5c"),
      metadata: { gender: "woman", collection: "noche" },
      skus: makeSkus("", "CL-DOR", "Dorado / \u00danica", 34990, ["U"], ["Dorado"]),
    },
    {
      name: "Bolso Mochila Minimalista Negro",
      slug: "bolso-mochila-minimalista-negro",
      description: "Mochila minimalista en cuero regenerado con cierre de doble cursor. El dise\u00f1o limpio se adapta a cualquier contexto, desde la oficina hasta viajes corto. Compartimento acolchado para laptop de 15\".",
      shortDescription: "Mochila minimalista en cuero regenerado",
      categoryId: catBolsos.id,
      editorialStatus: "published",
      baseImage: u("1553062407-98eeb64c6a62"),
      metadata: { gender: "unisex", collection: "urban" },
      skus: makeSkus("", "BM-NEG", "Negro / \u00danica", 79990, ["U"], ["Negro"]),
    },
    {
      name: "Collar Dominó Dorado Fino",
      slug: "collar-domino-dorado-fino",
      description: "Collar de collar domin\u00f3 en oro 18k con cadena fine chain. El dise\u00f1o minimalista pero impactante se lleva tanto en layering como solo. Cierre de resorte seguro.",
      shortDescription: "Collar domin\u00f3 en oro 18k con cadena fina",
      categoryId: catJoyeria.id,
      editorialStatus: "published",
      baseImage: u("1601121141461-9d6647b3d1c5"),
      metadata: { gender: "woman", collection: "jewelry" },
      skus: makeSkus("", "JD-DOR", "Dorado / \u00danica", 29990, ["U"], ["Dorado"]),
    },
    {
      name: "Aros Cilíndricos Plateados",
      slug: "aros-cilindricos-plateados",
      description: "Aros de突扩 en plata 925 con baño de rodio. El formato cil\u00edndrico es moderno y arquitect\u00f3nico. Cierre de tuerca para un ajuste seguro todo el d\u00eda.",
      shortDescription: "Aros cil\u00edndricos en plata 925",
      categoryId: catJoyeria.id,
      editorialStatus: "published",
      baseImage: u("1599643477877-530eb83abc3e"),
      metadata: { gender: "woman", collection: "jewelry" },
      skus: makeSkus("", "AP-PLA", "Plateado / \u00danica", 19990, ["U"], ["Plateado"]),
    },
    {
      name: "Pulsera Eslabones Grises",
      slug: "pulsera-eslabones-grises",
      description: "Pulsera de eslabones en acero inoxidable con acabado gris ip. El grosor medio la hace adecuada tanto para hombres como mujeres. Cierre de mosquet\u00f3n con extensi\u00f3n.",
      shortDescription: "Pulsera de eslabones en acero inoxidable",
      categoryId: catJoyeria.id,
      editorialStatus: "published",
      baseImage: u("1611650712973-2f4c1f1f8d6b"),
      metadata: { gender: "unisex", collection: "jewelry" },
      skus: makeSkus("", "PE-GRI", "Gris / \u00danica", 14990, ["U"], ["Gris"]),
    },
    {
      name: "Bufanda de Lana Merino Gris",
      slug: "bufanda-lana-merino-gris",
      description: "Bufanda oversized en lana merino 100% con acabado de point de Paris. El color gris oatmeal es verstil y sofisticado. Medidas 200x70cm para m\u00faltiples formas de lleve.",
      shortDescription: "Bufanda oversized en lana merino pura",
      categoryId: catJoyeria.id,
      editorialStatus: "published",
      baseImage: u("1576566588028-4147f3842f27"),
      metadata: { gender: "unisex", collection: "invierno" },
      skus: makeSkus("", "BF-GRI", "Gris / \u00danica", 39990, ["U"], ["Gris"]),
    },
    {
      name: "Reloj Minimalista Negro de Cuarzo",
      slug: "reloj-minimalista-negro-cuarzo",
      description: "Reloj de cuarzo con caja de acero inoxidable negro ip y esfera negra sunburst. La vida de la bater\u00eda es de 3 a\u00f1os. Resistencia al agua 50m para uso cotidiano.",
      shortDescription: "Reloj minimalista de cuarzo en negro ip",
      categoryId: catJoyeria.id,
      editorialStatus: "published",
      baseImage: u("1523275335684-37898b6baf30"),
      metadata: { gender: "unisex", collection: "essentials" },
      skus: makeSkus("", "RW-NEG", "Negro / \u00danica", 89990, ["U"], ["Negro"]),
    },
    // ── SHOES 46–50 ─────────────────────────────────────────────────────────
    {
      name: "Zapatos decharme Nude de Tacón Medio",
      slug: "zapatos-charme-nude-tacon-medio",
      description: "Zapatos de charme en piel sint\u00e9tica de alta calidad con tac\u00f3n medio de 5cm. El color nude alarga visualmente la pierna y combina con todo. Plantilla de memory foam para comodidad todo el d\u00eda.",
      shortDescription: "Zapatos de charme nude con tac\u00f3n medio",
      categoryId: catZapatosM.id,
      editorialStatus: "published",
      baseImage: u("1543163521-1bf539c55dd2"),
      metadata: { gender: "woman", collection: "office" },
      skus: makeSkus("", "ZC-NUD", "Nude / Talla", 69990, SHOES_W, ["Nude"]),
    },
    {
      name: "Zapatos de Charme Negro de Tacón Alto",
      slug: "zapatos-charme-negro-tacon-alto",
      description: "Zapatos de charme en piel sint\u00e9tica con tac\u00f3n stiletto de 9cm. El negro cl\u00e1sico es indispensable en todo guardarropa. Forro interior en cuero para mayor comodidad.",
      shortDescription: "Zapatos stiletto en negro cl\u00e1sico",
      categoryId: catZapatosM.id,
      editorialStatus: "published",
      baseImage: u("1515347619252-60a7c501c0cb"),
      metadata: { gender: "woman", collection: "occasion" },
      skus: makeSkus("", "ZA-NEG", "Negro / Talla", 79990, SHOES_W, ["Negro"]),
    },
    {
      name: "Bailarinas de Charme Negro Planas",
      slug: "bailarinas-charme-negro-planas",
      description: "Bailarinas de charme en piel sint\u00e9tica con punta redonda y lazo frontal. El dise\u00f1o cl\u00e1sico nunca pasa de moda y es el m\u00e1s c\u00f3modo para el d\u00eda a d\u00eda. Suela de goma flexible.",
      shortDescription: "Bailarinas cl\u00e1sicas en negro con lazo",
      categoryId: catZapatosM.id,
      editorialStatus: "published",
      baseImage: u("1512374064670-2a54de0a8b6a"),
      metadata: { gender: "woman", collection: "essentials" },
      skus: makeSkus("", "ZB-NEG", "Negro / Talla", 49990, SHOES_W, ["Negro"]),
    },
    {
      name: "Zapatos Oxford de Piel Negro para Hombre",
      slug: "zapatos-oxford-piel-negro-hombre",
      description: "Zapatos oxford cl\u00e1sicos en piel fully grain con acabado brillante. La construcci\u00f3n Goodyear welt permite multiple resoleados. Suela de cuero con tapas de goma antideslizante.",
      shortDescription: "Oxford cl\u00e1sico en piel grain con Goodyear welt",
      categoryId: catZapatosH.id,
      editorialStatus: "published",
      baseImage: u("1614251064477-85c4de6cf0d1"),
      metadata: { gender: "man", collection: "office" },
      skus: makeSkus("", "ZO-NEG", "Negro / Talla", 129990, SHOES_M, ["Negro"]),
    },
    {
      name: "Zapatillas de Piel Blancas Ultra Minimalistas",
      slug: "zapatillas-piel-blancas-minimalistas",
      description: "Zapatillas en piel nappa blanca con dise\u00f1o ultra minimalista. La simplicidad es el m\u00e1ximo lujo. Suela de caucho vulcanizado con amortiguaci\u00f3n de EVA para comodidad excepcional.",
      shortDescription: "Zapatillas minimalistas en piel nappa blanca",
      categoryId: catZapatosH.id,
      editorialStatus: "published",
      baseImage: u("1542291026-7eec264c27ff"),
      metadata: { gender: "man", collection: "casual" },
      skus: makeSkus("", "ZP-BLA", "Blanco / Talla", 89990, SHOES_M, ["Blanco"]),
    },
  ];

  // ─── INSERT PRODUCTS ──────────────────────────────────────────────────────
  const insertedProducts: string[] = [];
  for (const p of products) {
    const skusData = p.skus as any[];
    const { skus: _skus, ...productData } = p;
    await db.insert(s.products).values({
      ...productData,
      brand: BRAND,
      shortDescription: p.shortDescription,
    }).onConflictDoNothing();
    
    const rows = await db.select().from(s.products).where(eq(s.products.slug, p.slug));
    const productId = rows[0]?.id;
    if (!productId) continue;
    insertedProducts.push(productId);

    // Insert SKUs
    const skusToInsert = skusData.map((sku: any) => ({ ...sku, productId }));
    await db.insert(s.skus).values(skusToInsert).onConflictDoNothing();

    // Get SKU IDs and insert inventory
    for (const skuData of skusToInsert) {
      const skuRows = await db.select().from(s.skus).where(eq(s.skus.sku, skuData.sku));
      const skuId = skuRows[0]?.id;
      if (skuId) {
        const stock = Math.floor(Math.random() * 15) + 3;
        await db.insert(s.inventoryItems).values({ skuId, physicalStock: stock }).onConflictDoNothing();
        await db.insert(s.inventoryLedger).values({ skuId, delta: stock, reason: "stock_receipt" }).onConflictDoNothing();
      }
    }

    // Set product attributes (color and size)
    for (const skuData of skusToInsert) {
      const skuRows = await db.select().from(s.skus).where(eq(s.skus.sku, skuData.sku));
      const skuId = skuRows[0]?.id;
      if (!skuId) continue;
      
      const colorMatch = skuData.variantLabel.match(/^([^\/]+)/);
      const sizeMatch = skuData.variantLabel.match(/\/ ([^\/]+)$/);
      if (colorMatch) {
        const colorAttrRows = await db.select().from(s.attributes).where(eq(s.attributes.slug, "color"));
        if (colorAttrRows[0]) {
          await db.insert(s.productAttributes).values({ productId, attributeId: colorAttrRows[0].id, value: colorMatch[1].trim() }).onConflictDoUpdate({
            target: [s.productAttributes.productId, s.productAttributes.attributeId],
            set: { value: colorMatch[1].trim() },
          });
        }
      }
      if (sizeMatch) {
        const sizeAttrRows = await db.select().from(s.attributes).where(eq(s.attributes.slug, "talla"));
        if (sizeAttrRows[0]) {
          await db.insert(s.productAttributes).values({ productId, attributeId: sizeAttrRows[0].id, value: sizeMatch[1].trim() }).onConflictDoUpdate({
            target: [s.productAttributes.productId, s.productAttributes.attributeId],
            set: { value: sizeMatch[1].trim() },
          });
        }
      }
    }
  }

  // Mark some products as featured
  const featuredSlugs = [
    "vestido-elegante-negro-largo",
    "blusa-seda-cruda-beige",
    "camisa-clasica-oxford-blanca",
    "trench-coat-camel-algodon",
    "chaqueta-cuero-negro-nappa",
    "bolso-tote-cuero-negro-profesional",
    "zapatos-oxford-piel-negro-hombre",
  ];
  for (const slug of featuredSlugs) {
    await db.update(s.products).set({ isFeatured: true }).where(eq(s.products.slug, slug));
  }

  console.log(`\u2714 Seeded ${insertedProducts.length} products`);
  console.log("\u2714 Categories created: Ropa de Mujer, Ropa de Hombre, Accesorios, Calzado + subcategories");
  console.log("\u2714 Attributes: Color, Talla");
  console.log("\u2714 Brand: " + BRAND);
  console.log("\nMaison \u00c9lite catalog ready!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
