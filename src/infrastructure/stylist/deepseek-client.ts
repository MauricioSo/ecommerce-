import type { CatalogProductForStylist, StylistRecommendation } from "../../domain/stylist/types.ts";
import { getConfig } from "../../shared/infrastructure/config.ts";
import type { StylistAiGateway } from "../../application/stylist/ports/stylist-ai-gateway.ts";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

const SYSTEM_PROMPT = `Eres un estilista de moda profesional para una tienda de ropa online llamada Maison Élite.
Tu trabajo es recomendar looks completos usando SOLO los productos disponibles en el catálogo de la tienda.

Cuando el usuario describe un objetivo, presupuesto, ocasión o características físicas, responde con 2-3 looks completos.
Si el usuario menciona una foto o características físicas, personaliza las recomendaciones según eso.

REGLAS IMPORTANTES:
- Usa SOLO productos del catálogo provisto. Nunca inventes productos.
- Siempre responde en español.
- Considera el presupuesto si el usuario lo menciona.
- Da consejos de estilo útiles (qué favorece, cómo usar las prendas).
- Responde ÚNICAMENTE con un JSON válido con la estructura indicada, sin texto adicional ni explicaciones fuera del JSON.
- Si el usuario solo saluda o no da suficiente información, devuelve igualmente el JSON con looks:[] y usa generalAdvice para pedir más detalles.

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
          "role": "descripción del rol en el look"
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

export async function callDeepSeekStylistAI(opts: {
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  catalog: CatalogProductForStylist[];
}): Promise<StylistRecommendation> {
  const apiKey = getConfig().DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const catalogText = buildCatalogText(opts.catalog);
  const userText = `${opts.userMessage}\n\n---\nCATÁLOGO DE PRODUCTOS DISPONIBLES:\n${catalogText}`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...opts.history.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: userText },
  ];

  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  const text = data.choices[0]?.message?.content ?? "{}";

  let parsed: StylistRecommendation;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? text);
  } catch {
    parsed = { looks: [], generalAdvice: text };
  }

  const catalogMap = new Map(opts.catalog.map(p => [p.id, p]));
  for (const look of parsed.looks ?? []) {
    let total = 0;
    for (const prod of look.products ?? []) {
      const entry = catalogMap.get(prod.productId);
      if (entry) {
        prod.priceCents = entry.priceCents;
        prod.currency = entry.currency;
        prod.baseImage = entry.baseImage;
        prod.slug = entry.slug;
        prod.productName = entry.name;
      }
      total += prod.priceCents ?? 0;
    }
    look.totalPriceCents = total;
  }

  return parsed;
}

export class DeepSeekStylistAiGateway implements StylistAiGateway {
  readonly providerName = "deepseek";

  recommend(opts: Parameters<StylistAiGateway["recommend"]>[0]): Promise<StylistRecommendation> {
    return callDeepSeekStylistAI({
      userMessage: opts.userMessage,
      history: opts.history,
      catalog: opts.catalog,
    });
  }
}
