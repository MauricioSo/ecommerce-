import type { CatalogProductForStylist, StylistRecommendation } from "../../../domain/stylist/types.ts";

export interface StylistAiGateway {
  readonly providerName: string;
  recommend(opts: {
    userMessage: string;
    imageBase64?: string;
    imageMediaType?: string;
    history: { role: "user" | "assistant"; content: string }[];
    catalog: CatalogProductForStylist[];
  }): Promise<StylistRecommendation>;
}
