import { z } from "zod";

export const OrderIdSchema = z.string().uuid().brand<"OrderId">();
export type OrderId = z.infer<typeof OrderIdSchema>;

export function createOrderId(): OrderId {
  return OrderIdSchema.parse(crypto.randomUUID());
}
