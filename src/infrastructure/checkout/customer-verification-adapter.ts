import { findCustomerByEmail, findCustomerById } from "../customers/repository.ts";
import type { CustomerVerificationPort } from "../../application/checkout/ports/customer-verification-port.ts";

export class CustomerVerificationAdapter implements CustomerVerificationPort {
  async findCustomerByEmail(email: string) {
    const row = await findCustomerByEmail(email);
    if (!row) return null;
    return { id: row.id, emailVerifiedAt: row.emailVerifiedAt };
  }

  async findCustomerById(id: string) {
    const row = await findCustomerById(id);
    if (!row) return null;
    return { id: row.id, emailVerifiedAt: row.emailVerifiedAt };
  }
}
