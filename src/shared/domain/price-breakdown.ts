export type AppliedPromotion = {
  name: string;
  type: string;
  discountCents: number;
  description: string;
};

export type PriceBreakdown = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  appliedPromotions: AppliedPromotion[];
  isTaxInclusive: boolean;
  taxRate: number;
  taxName: string;
};

export function explainBreakdown(breakdown: PriceBreakdown): string {
  const lines: string[] = [];
  lines.push(`Subtotal: ${formatCents(breakdown.subtotalCents, breakdown.currency)}`);
  if (breakdown.discountCents > 0) {
    lines.push(`Descuento: -${formatCents(breakdown.discountCents, breakdown.currency)}`);
    for (const promo of breakdown.appliedPromotions) {
      lines.push(`  - ${promo.name}: -${formatCents(promo.discountCents, breakdown.currency)}`);
    }
  }
  if (breakdown.shippingCents > 0) {
    lines.push(`Envío: ${formatCents(breakdown.shippingCents, breakdown.currency)}`);
  }
  if (breakdown.taxCents > 0) {
    const label = breakdown.isTaxInclusive ? "(incluido)" : "";
    lines.push(`${breakdown.taxName}: ${formatCents(breakdown.taxCents, breakdown.currency)} ${label}`);
  }
  lines.push(`Total: ${formatCents(breakdown.totalCents, breakdown.currency)}`);
  return lines.join("\n");
}

function formatCents(cents: number, _currency: string): string {
  return `$${(cents / 100).toLocaleString("es-CL")}`;
}
