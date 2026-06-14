import { eq, and } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";

export type ShippingOption = {
  rateId: string;
  name: string;
  carrier: string | null;
  priceCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isFree: boolean;
};

export async function calculateShipping(input: {
  countryCode: string;
  region?: string;
  weightGrams?: number;
  orderSubtotalCents: number;
}): Promise<ShippingOption[]> {
  const db = getDb();
  const zones = await db.select().from(s.shippingZones)
    .where(and(eq(s.shippingZones.countryCode, input.countryCode), eq(s.shippingZones.isActive, true)));
  let zone = zones.find((z) => {
    if (!z.regions) return true;
    const regions = z.regions as string[];
    if (!input.region) return true;
    return regions.includes(input.region);
  });
  if (!zone) zone = zones.find((z) => !z.regions);
  if (!zone) return [];
  const weight = input.weightGrams ?? 0;
  const rates = await db.select().from(s.shippingRates)
    .where(and(eq(s.shippingRates.zoneId, zone.id), eq(s.shippingRates.isActive, true)));
  const options: ShippingOption[] = [];
  for (const rate of rates) {
    if (rate.minWeightGrams > weight) continue;
    if (rate.maxWeightGrams !== null && weight > rate.maxWeightGrams) continue;
    if (rate.minOrderCents > input.orderSubtotalCents) continue;
    if (rate.maxOrderCents !== null && input.orderSubtotalCents > rate.maxOrderCents) continue;
    let isFree = false;
    let priceCents = rate.priceCents;
    if (rate.isFreeShippingEligible && rate.freeShippingThresholdCents !== null && input.orderSubtotalCents >= rate.freeShippingThresholdCents) {
      isFree = true;
      priceCents = 0;
    }
    options.push({
      rateId: rate.id,
      name: rate.name,
      carrier: rate.carrier,
      priceCents,
      estimatedDaysMin: rate.estimatedDaysMin,
      estimatedDaysMax: rate.estimatedDaysMax,
      isFree,
    });
  }
  return options.sort((a, b) => a.priceCents - b.priceCents);
}

export async function seedShippingData(): Promise<void> {
  const db = getDb();
  const carriers: Array<{ country: string; name: string; carriers: Array<{ name: string; carrier: string; priceCents: number; daysMin: number; daysMax: number }> }> = [
    { country: "CHL", name: "Chile", carriers: [
      { name: "Envío estándar", carrier: "Chilexpress", priceCents: 3990, daysMin: 3, daysMax: 5 },
      { name: "Envío express", carrier: "Starken", priceCents: 6990, daysMin: 1, daysMax: 2 },
      { name: "Envío económico", carrier: "Correos de Chile", priceCents: 2990, daysMin: 5, daysMax: 7 },
    ]},
    { country: "PER", name: "Perú", carriers: [
      { name: "Envío estándar", carrier: "Olva Courier", priceCents: 800, daysMin: 2, daysMax: 4 },
      { name: "Envío express", carrier: "Shalom", priceCents: 1500, daysMin: 1, daysMax: 2 },
    ]},
    { country: "COL", name: "Colombia", carriers: [
      { name: "Envío estándar", carrier: "Coordinadora", priceCents: 9900, daysMin: 3, daysMax: 5 },
      { name: "Envío express", carrier: "Servientrega", priceCents: 15900, daysMin: 1, daysMax: 2 },
    ]},
    { country: "MEX", name: "México", carriers: [
      { name: "Envío estándar", carrier: "Estafeta", priceCents: 12900, daysMin: 3, daysMax: 5 },
      { name: "Envío express", carrier: "DHL", priceCents: 24900, daysMin: 1, daysMax: 2 },
    ]},
    { country: "ARG", name: "Argentina", carriers: [
      { name: "Envío estándar", carrier: "Andreani", priceCents: 5900, daysMin: 3, daysMax: 6 },
      { name: "Envío express", carrier: "OCA", priceCents: 9900, daysMin: 1, daysMax: 3 },
    ]},
  ];
  for (const c of carriers) {
    let zone = (await db.select().from(s.shippingZones).where(eq(s.shippingZones.countryCode, c.country)))[0];
    if (!zone) {
      const zoneId = crypto.randomUUID();
      await db.insert(s.shippingZones).values({ id: zoneId, name: c.name, countryCode: c.country, regions: null, isActive: true });
      zone = { id: zoneId, name: c.name, countryCode: c.country, regions: null, isActive: true, createdAt: new Date() };
    }
    const existingRates = await db.select().from(s.shippingRates).where(eq(s.shippingRates.zoneId, zone.id));
    if (existingRates.length === 0) {
      for (const carrier of c.carriers) {
        await db.insert(s.shippingRates).values({
          id: crypto.randomUUID(),
          zoneId: zone.id,
          name: carrier.name,
          carrier: carrier.carrier,
          priceCents: carrier.priceCents,
          estimatedDaysMin: carrier.daysMin,
          estimatedDaysMax: carrier.daysMax,
          isFreeShippingEligible: true,
          freeShippingThresholdCents: 50000,
        });
      }
    }
  }
}
