import { z } from "zod";

export const IdempotencyKeySchema = z.string().min(1).max(256).brand<"IdempotencyKey">();
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

export function idempotencyKeyOf(value: string): IdempotencyKey {
  return IdempotencyKeySchema.parse(value);
}
