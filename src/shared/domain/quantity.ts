import { z } from "zod";

export const QuantitySchema = z.number().int().min(0).brand<"Quantity">();
export type Quantity = z.infer<typeof QuantitySchema>;

export function quantityOf(n: number): Quantity {
  return QuantitySchema.parse(n);
}
