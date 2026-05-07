import { findCustomerById, deleteAddressesByCustomerId, deleteAllCustomerSessions, deleteConsentRecordsByCustomerId } from "../infrastructure/repository.ts";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import { eq } from "drizzle-orm";
import { writeAuditEvent } from "../../../shared/infrastructure/audit.ts";

export async function requestAccountDeletionUseCase(customerId: string): Promise<void> {
  const customer = await findCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");
  if (!customer.isActive) throw new Error("Account already deactivated");

  await anonymizeCustomer(customerId);

  await writeAuditEvent({
    aggregateType: "customer",
    aggregateId: customerId,
    eventType: "customer.deletion_requested",
    actorId: customerId,
  }).catch(() => {});
}

async function anonymizeCustomer(customerId: string): Promise<void> {
  const db = getDb();

  await db.update(s.customers).set({
    firstName: "ELIMINADO",
    lastName: "ELIMINADO",
    email: `anonymized_${customerId}@deleted.local`,
    phone: null,
    documentType: null,
    documentNumber: null,
    isActive: false,
    updatedAt: new Date(),
  }).where(eq(s.customers.id, customerId));

  await deleteAddressesByCustomerId(customerId);
  await deleteAllCustomerSessions(customerId);
  await deleteConsentRecordsByCustomerId(customerId);
}

export async function exportCustomerDataUseCase(customerId: string): Promise<Record<string, unknown>> {
  const customer = await findCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");

  const { findAddressesByCustomerId } = await import("../infrastructure/repository.ts");
  const addresses = await findAddressesByCustomerId(customerId);

  const { findConsentRecordsByCustomerId } = await import("../infrastructure/repository.ts");
  const consents = await findConsentRecordsByCustomerId(customerId);

  const db = getDb();
  const orders = await db.select({
    id: s.orders.id,
    status: s.orders.status,
    totalCents: s.orders.totalCents,
    currency: s.orders.currency,
    createdAt: s.orders.createdAt,
  }).from(s.orders).where(eq(s.orders.customerId, customerId));

  return {
    profile: {
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      documentType: customer.documentType,
      documentNumber: customer.documentNumber,
      country: customer.countryCode,
      createdAt: customer.createdAt,
      emailVerifiedAt: customer.emailVerifiedAt,
      consentGivenAt: customer.consentGivenAt,
    },
    addresses: addresses.map((a) => ({
      line1: a.line1,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
    })),
    orders: orders.map((o) => ({
      id: o.id.substring(0, 8),
      status: o.status,
      totalCents: o.totalCents,
      currency: o.currency,
      date: o.createdAt,
    })),
    consents: consents.map((c) => ({
      type: c.consentType,
      givenAt: c.givenAt,
    })),
  };
}
