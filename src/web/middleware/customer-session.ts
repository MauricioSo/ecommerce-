import Elysia from "elysia";
import { verifyCustomerSession } from "../../modules/customers/application/auth-use-cases.ts";

export type CustomerInfo = {
  customerId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export class CustomerSession {
  static async resolve(cookie: Record<string, { value: unknown }>): Promise<CustomerInfo | null> {
    const sessionToken = cookie._session?.value;
    if (!sessionToken || typeof sessionToken !== "string") {
      return null;
    }
    return verifyCustomerSession(sessionToken);
  }
}

export const customerSessionPlugin = new Elysia({ name: "customer-session" })
  .decorate("customer", null as unknown as CustomerInfo | null)
  .derive(async ({ cookie }) => {
    const customer = await CustomerSession.resolve(cookie as Record<string, { value: unknown }>);
    return { customer };
  });
