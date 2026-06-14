export type StylistRole = "user" | "assistant";

export type ProductRecommendation = {
  productId: string;
  productName: string;
  slug: string;
  priceCents: number;
  currency: string;
  baseImage: string | null;
  role: string; // e.g. "camisa principal", "pantalón complementario"
};

export type Look = {
  title: string;
  description: string;
  styleTip: string;
  products: ProductRecommendation[];
  totalPriceCents: number;
};

export type StylistRecommendation = {
  looks: Look[];
  generalAdvice: string;
};

export type StylistMessage = {
  readonly id: string;
  readonly conversationId: string;
  readonly role: StylistRole;
  readonly content: string;
  readonly imageBase64: string | null;
  readonly recommendations: StylistRecommendation | null;
  readonly createdAt: Date;
};

export type StylistConversation = {
  readonly id: string;
  readonly customerId: string | null;
  readonly sessionId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CatalogProductForStylist = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryName: string | null;
  priceCents: number;
  currency: string;
  baseImage: string | null;
  attributes: { name: string; value: string }[];
};
