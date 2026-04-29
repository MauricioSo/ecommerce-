import { z } from "zod";

export const PaymentAttemptIdSchema = z.string().uuid().brand<"PaymentAttemptId">();
export type PaymentAttemptId = z.infer<typeof PaymentAttemptIdSchema>;

export function createPaymentAttemptId(): PaymentAttemptId {
  return PaymentAttemptIdSchema.parse(crypto.randomUUID());
}
