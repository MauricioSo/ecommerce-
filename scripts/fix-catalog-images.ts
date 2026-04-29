import { eq } from "drizzle-orm";
import { getDb } from "../src/shared/infrastructure/db/index.ts";
import * as s from "../src/shared/infrastructure/db/schema.ts";

const db = getDb();

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&h=1200&q=80`;

const images: Record<string, string> = {
  "vestido-midi-estampado-floral": photo("1515886657613-9f3515b0c78f"),
  "vestido-elegante-negro-largo": photo("1594938298603-c8148c4b4a0e"),
  "vestido-cocktail-bordado": photo("1572804013309-59a88b7e92f1"),
  "blusa-seda-cruda-beige": photo("1485968579580-b6d095142e6e"),
  "blusa-bordada-blanca-lino": photo("1523381294911-8d3cead5c2b0"),
  "top-punto-fino-morado": photo("1564257631407-4deb1f99d992"),
  "camisa-masculina-oversize-blanca": photo("1509631179647-0177331693ae"),
  "jeans-high-rise-skinny-negro": photo("1541099649105-f865ad2e3aef"),
  "pantalon-wide-leg-beige-franela": photo("1594633312681-425c7b97ccd1"),
  "joggers-algodon-organico-gris": photo("1554568218-0f1715e72254"),
  "mini-falda-plisada-gris-perla": photo("1583496661160-fb5218afa5a2"),
  "falda-midi-plisada-hilo-beige": photo("1583744946564-b52ac1c389c8"),
  "cardigan-cashmere-cremoso": photo("1544022613-e87ca75a178a"),
  "cardigan-largo-negro-lana": photo("1434389677669-e08b4cac3105"),
  "jersey-lana-merino-azul-marino": photo("1576566588028-4147f3842f27"),
  "abrigo-gabardina-beige-clasico": photo("1539109136881-3be0616acf4b"),
  "trench-coat-camel-algodon": photo("1523381210434-271e8be1c52b"),
  "chaqueta-cuero-negro-nappa": photo("1551028719-00167b16eac5"),
  "cazadora-bomber-piel-marron": photo("1548126039-4c325c8c2d8b"),
  "conjunto-lenceria-encaje-negro": photo("1617331140175-45b8d6e8595c"),
  "camisa-clasica-oxford-blanca": photo("1602810318383-e386cc2a3ccf"),
  "camisa-lino-azul-celeste": photo("1620012253292-c15cc3e6df9d"),
  "camisa-slim-estampado-leopardo": photo("1607587247740-0f6ad7d47b3f"),
  "polera-cuello-redondo-gris-heather": photo("1578681994506-b8b463d0b5c7"),
  "polo-premium-pique-blanco": photo("1625911083067-64e84e2f6a73"),
  "poleron-oversize-franela-cuadros": photo("1578587014498-ead7c9e68c1e"),
  "sweater-cashmere-burdeos": photo("1576566588028-4147f3842f27"),
  "pantalon-chino-slim-negro": photo("1624378439575-8701d4da2b16"),
  "pantalon-vestir-gris-planas": photo("1473966963273-7f1beb9d5e7e"),
  "jean-straight-fit-denim-oscuro": photo("1542272604-787c3835535d"),
  "abrigo-lana-nautica-negro": photo("1507680434567-5413ca77b0d0"),
  "gabardina-clasica-beige-lana": photo("1474903232627-1d6c8f3b9c1e"),
  "chaqueta-bomber-piel-sintetica-negra": photo("1551028719-00167b16eac5"),
  "playa-piscina-short-negro": photo("1521577352947-9bb58764b69a"),
  "bolso-tote-cuero-negro-profesional": photo("1548036328-c9fa89d128fa"),
  "cartera-mano-piel-beige": photo("1584917865442-de89df76afd3"),
  "bolso-bandolera-lona-artistic": photo("1553062407-98eeb64c6a62"),
  "clutch-noche-dorado": photo("1566151544426-7a4f6f3a4e5c"),
  "bolso-mochila-minimalista-negro": photo("1622560480654-d96214fdc887"),
  "collar-domino-dorado-fino": photo("1601121141461-9d6647b3d1c5"),
  "aros-cilindricos-plateados": photo("1599643477877-530eb83abc3e"),
  "pulsera-eslabones-grises": photo("1611652022419-a9419f74343d"),
  "bufanda-lana-merino-gris": photo("1520903920243-00d872a2d1c9"),
  "reloj-minimalista-negro-cuarzo": photo("1523275335684-37898b6baf30"),
  "zapatos-charme-nude-tacon-medio": photo("1543163521-1bf539c55dd2"),
  "zapatos-charme-negro-tacon-alto": photo("1515347619252-60a7c501c0cb"),
  "bailarinas-charme-negro-planas": photo("1512374382149-233c42b6a83b"),
  "zapatos-oxford-piel-negro-hombre": photo("1614252369475-531eba835eb1"),
  "zapatillas-piel-blancas-minimalistas": photo("1549298916-b41d501d3772"),
  "cinturon-heritage-cuero-negro": photo("1553062407-98eeb64c6a62"),
};

async function main() {
  for (const [slug, baseImage] of Object.entries(images)) {
    await db.update(s.products).set({ baseImage, updatedAt: new Date() }).where(eq(s.products.slug, slug));
  }

  console.log(`Updated ${Object.keys(images).length} product images to fixed Unsplash URLs.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
