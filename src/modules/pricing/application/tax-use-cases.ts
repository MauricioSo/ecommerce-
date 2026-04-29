import { eq, and } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";

export type TaxCalculation = {
  taxCents: number;
  taxRate: number;
  taxName: string;
  isTaxInclusive: boolean;
};

export async function calculateTax(input: {
  subtotalCents: number;
  countryCode: string;
  region?: string;
  taxClass?: string;
}): Promise<TaxCalculation> {
  const db = getDb();
  const taxClass = input.taxClass ?? "standard";
  const rules = await db.select().from(s.taxRules)
    .where(and(
      eq(s.taxRules.countryCode, input.countryCode),
      eq(s.taxRules.taxClass, taxClass),
      eq(s.taxRules.isActive, true),
    ));
  let rule = rules.find((r) => r.region === (input.region ?? null));
  if (!rule) rule = rules.find((r) => r.region === null);
  if (!rule) return { taxCents: 0, taxRate: 0, taxName: "Sin impuesto", isTaxInclusive: false };
  const rate = parseFloat(rule.ratePercent);
  const isTaxInclusive = rule.isInclusive;
  let taxCents: number;
  if (isTaxInclusive) {
    taxCents = Math.round(input.subtotalCents - input.subtotalCents / (1 + rate / 100));
  } else {
    taxCents = Math.round(input.subtotalCents * rate / 100);
  }
  return { taxCents, taxRate: rate, taxName: rule.name, isTaxInclusive };
}

export async function seedTaxRules(): Promise<void> {
  const db = getDb();
  const rules = [
    { countryCode: "CHL", region: null, taxClass: "standard", ratePercent: "19.00", name: "IVA", isInclusive: true },
    { countryCode: "PER", region: null, taxClass: "standard", ratePercent: "18.00", name: "IGV", isInclusive: false },
    { countryCode: "COL", region: null, taxClass: "standard", ratePercent: "19.00", name: "IVA", isInclusive: false },
    { countryCode: "MEX", region: null, taxClass: "standard", ratePercent: "16.00", name: "IVA", isInclusive: false },
    { countryCode: "ARG", region: null, taxClass: "standard", ratePercent: "21.00", name: "IVA", isInclusive: false },
    { countryCode: "URY", region: null, taxClass: "standard", ratePercent: "22.00", name: "IVA", isInclusive: false },
  ];
  for (const r of rules) {
    const existing = await db.select().from(s.taxRules)
      .where(and(eq(s.taxRules.countryCode, r.countryCode), eq(s.taxRules.taxClass, r.taxClass)));
    if (existing.length === 0) {
      await db.insert(s.taxRules).values({
        id: crypto.randomUUID(),
        ...r,
        isActive: true,
      });
    }
  }
}
