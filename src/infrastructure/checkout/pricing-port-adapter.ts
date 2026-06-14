import { calculateCartPrice } from "../../application/pricing/use-cases.ts";
import type { PricingPort, CartItemInput } from "../../application/checkout/ports/pricing-port.ts";

export class PricingPortAdapter implements PricingPort {
  async calculateCartPrice(input: { items: CartItemInput[]; shippingCents: number }) {
    return calculateCartPrice({
      items: input.items,
      shippingCents: input.shippingCents,
    });
  }
}
