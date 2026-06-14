import Anthropic from "@anthropic-ai/sdk";
import type { CatalogProductForStylist, StylistRecommendation } from "../../domain/stylist/types.ts";
import { getConfig } from "../../shared/infrastructure/config.ts";
import type { StylistAiGateway } from "../../application/stylist/ports/stylist-ai-gateway.ts";

function getClient(): Anthropic {
  const cfg = getConfig();
  return new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY });
}

const SYSTEM_PROMPT = `Eres un estilista de moda profesional para una tienda de ropa online llamada Maison Élite.
Tu trabajo es recomendar looks completos usando SOLO los productos disponibles en el catálogo de la tienda.

Cuando el usuario describe un objetivo, presupuesto, ocasión o características físicas, responde con 2-3 looks completos.
Si el usuario sube una foto, analiza su tipo de cuerpo y coloring para personalizar las recomendaciones.

REGLAS IMPORTANTES:
- Usa SOLO productos del catálogo provisto. Nunca inventes productos.
- Siempre responde en español.
- Considera el presupuesto si el usuario lo menciona.
- Da consejos de estilo útiles (qué favorece, cómo usar las prendas).
- Responde ÚNICAMENTE con un JSON válido con la estructura indicada, sin texto adicional.

ESTRUCTURA DE RESPUESTA (JSON):
{
  "looks": [
    {
      "title": "Nombre del look",
      "description": "Descripción breve del look y ocasión",
      "styleTip": "Consejo de estilo específico (por qué este look te favorece, cómo usarlo)",
      "products": [
        {
          "productId": "id del producto del catálogo",
          "productName": "nombre del producto",
          "slug": "slug del producto",
          "priceCents": 0,
          "currency": "USD",
          "baseImage": null,
          "role": "descripción del rol en el look (ej: pieza principal, complemento)"
        }
      ],
      "totalPriceCents": 0
    }
  ],
  "generalAdvice": "Consejo general sobre el objetivo del usuario"
}`;

function buildCatalogText(products: CatalogProductForStylist[]): string {
  return products.map(p => {
    const price = `${(p.priceCents / 100).toFixed(2)} ${p.currency}`;
    const attrs = p.attributes.map(a => `${a.name}: ${a.value}`).join(", ");
    return `- ID: ${p.id} | ${p.name} | Categoría: ${p.categoryName ?? "Sin categoría"} | Precio: ${price} | Slug: ${p.slug}${attrs ? ` | Atributos: ${attrs}` : ""}`;
  }).join("\n");
}

type MessageParam = {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>;
};

export async function callStylistAI(opts: {
  userMessage: string;
  imageBase64?: string;
  imageMediaType?: string;
  history: { role: "user" | "assistant"; content: string }[];
  catalog: CatalogProductForStylist[];
}): Promise<StylistRecommendation> {
  const catalogText = buildCatalogText(opts.catalog);
  const userText = `${opts.userMessage}\n\n---\nCATÁLOGO DE PRODUCTOS DISPONIBLES:\n${catalogText}`;

  const messages: MessageParam[] = [];

  for (const h of opts.history.slice(-6)) {
    messages.push({ role: h.role, content: h.content });
  }

  if (opts.imageBase64) {
    const mediaType = (opts.imageMediaType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    messages.push({
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: opts.imageBase64 },
        },
        { type: "text", text: userText },
      ],
    });
  } else {
    messages.push({ role: "user", content: userText });
  }

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: messages as Parameters<typeof client.messages.create>[0]["messages"],
  });

  const text = response.content.find(b => b.type === "text")?.text ?? "{}";

  let parsed: StylistRecommendation;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? text);
  } catch {
    parsed = { looks: [], generalAdvice: text };
  }

  // Enrich with catalog data for any missing fields
  const catalogMap = new Map(opts.catalog.map(p => [p.id, p]));
  for (const look of parsed.looks ?? []) {
    let total = 0;
    for (const prod of look.products ?? []) {
      const catalogEntry = catalogMap.get(prod.productId);
      if (catalogEntry) {
        prod.priceCents = catalogEntry.priceCents;
        prod.currency = catalogEntry.currency;
        prod.baseImage = catalogEntry.baseImage;
        prod.slug = catalogEntry.slug;
        prod.productName = catalogEntry.name;
      }
      total += prod.priceCents ?? 0;
    }
    look.totalPriceCents = total;
  }

  return parsed;
}

export class ClaudeStylistAiGateway implements StylistAiGateway {
  readonly providerName = "claude";

  recommend(opts: Parameters<StylistAiGateway["recommend"]>[0]): Promise<StylistRecommendation> {
    return callStylistAI(opts);
  }
}
