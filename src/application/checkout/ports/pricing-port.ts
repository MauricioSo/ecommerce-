import type { PriceBreakdown } from "../../../domain/pricing/entities.ts";

export type CartItemInput = {
  skuId: string;
  productName: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPriceCents: number;
  currency: string;
};

export type PricingPort = {
  calculateCartPrice(input: {
    items: CartItemInput[];
    shippingCents: number;
  }): Promise<PriceBreakdown>;
};
