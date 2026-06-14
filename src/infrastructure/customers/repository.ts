import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";

type Db = ReturnType<typeof getDb>;

export type CustomerRow = typeof s.customers.$inferSelect;
export type AddressRow = typeof s.addresses.$inferSelect;

export async function findCustomerByEmail(email: string, db: Db = getDb()): Promise<CustomerRow | null> {
  const rows = await db.select().from(s.customers).where(eq(s.customers.email, email));
  return rows[0] ?? null;
}

export async function findCustomerById(id: string, db: Db = getDb()): Promise<CustomerRow | null> {
  const rows = await db.select().from(s.customers).where(eq(s.customers.id, id));
  return rows[0] ?? null;
}

export async function insertCustomer(input: {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  passwordHash?: string | null;
  phone?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  locale?: string | null;
  countryCode?: string | null;
  consentGivenAt?: Date | null;
}, db: Db = getDb()) {
  await db.insert(s.customers).values(input);
}

export async function updateCustomer(id: string, data: {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  locale?: string | null;
  emailVerifiedAt?: Date | null;
  consentGivenAt?: Date | null;
  lastLoginAt?: Date | null;
  isActive?: boolean;
  passwordHash?: string | null;
}, db: Db = getDb()) {
  await db.update(s.customers).set({ ...data, updatedAt: new Date() }).where(eq(s.customers.id, id));
}

export async function findAddressesByCustomerId(customerId: string, db: Db = getDb()) {
  return db.select().from(s.addresses).where(eq(s.addresses.customerId, customerId));
}

export async function findAddressById(id: string, db: Db = getDb()): Promise<AddressRow | null> {
  const rows = await db.select().from(s.addresses).where(eq(s.addresses.id, id));
  return rows[0] ?? null;
}

export async function insertAddress(input: {
  id: string;
  customerId: string;
  line1: string;
  line2?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  phone?: string | null;
  reference?: string | null;
  isDefault?: boolean;
  isBillingDefault?: boolean;
}, db: Db = getDb()) {
  await db.insert(s.addresses).values({
    id: input.id,
    customerId: input.customerId,
    line1: input.line1,
    line2: input.line2 ?? null,
    neighborhood: input.neighborhood ?? null,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country ?? "CHL",
    phone: input.phone ?? null,
    reference: input.reference ?? null,
    isDefault: input.isDefault ?? false,
    isBillingDefault: input.isBillingDefault ?? false,
  });
}

export async function updateAddress(id: string, data: {
  line1?: string;
  line2?: string | null;
  neighborhood?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string | null;
  reference?: string | null;
}, db: Db = getDb()) {
  await db.update(s.addresses).set(data).where(eq(s.addresses.id, id));
}

export async function deleteAddress(id: string, db: Db = getDb()) {
  await db.delete(s.addresses).where(eq(s.addresses.id, id));
}

export async function setDefaultAddress(customerId: string, addressId: string, db: Db = getDb()) {
  await db.update(s.addresses).set({ isDefault: false }).where(eq(s.addresses.customerId, customerId));
  await db.update(s.addresses).set({ isDefault: true }).where(eq(s.addresses.id, addressId));
}

export async function countAddressesByCustomerId(customerId: string, db: Db = getDb()) {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(s.addresses).where(eq(s.addresses.customerId, customerId));
  return rows[0]?.count ?? 0;
}

export async function insertCustomerSession(input: {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}, db: Db = getDb()) {
  await db.insert(s.customerSessions).values(input);
}

export async function findCustomerSessionByTokenHash(tokenHash: string, db: Db = getDb()) {
  const rows = await db.select().from(s.customerSessions).where(eq(s.customerSessions.tokenHash, tokenHash));
  return rows[0] ?? null;
}

export async function deleteCustomerSession(tokenHash: string, db: Db = getDb()) {
  await db.delete(s.customerSessions).where(eq(s.customerSessions.tokenHash, tokenHash));
}

export async function deleteAllCustomerSessions(customerId: string, db: Db = getDb()) {
  await db.delete(s.customerSessions).where(eq(s.customerSessions.customerId, customerId));
}

export async function insertPasswordResetToken(input: {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: Date;
}, db: Db = getDb()) {
  await db.insert(s.passwordResetTokens).values(input);
}

export async function findPasswordResetToken(tokenHash: string, db: Db = getDb()) {
  const rows = await db.select().from(s.passwordResetTokens).where(eq(s.passwordResetTokens.tokenHash, tokenHash));
  return rows[0] ?? null;
}

export async function markPasswordResetTokenUsed(id: string, db: Db = getDb()) {
  await db.update(s.passwordResetTokens).set({ usedAt: new Date() }).where(eq(s.passwordResetTokens.id, id));
}

export async function insertEmailVerificationToken(input: {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: Date;
}, db: Db = getDb()) {
  await db.insert(s.emailVerificationTokens).values(input);
}

export async function findEmailVerificationToken(tokenHash: string, db: Db = getDb()) {
  const rows = await db.select().from(s.emailVerificationTokens).where(eq(s.emailVerificationTokens.tokenHash, tokenHash));
  return rows[0] ?? null;
}

export async function markEmailVerificationTokenUsed(id: string, db: Db = getDb()) {
  await db.update(s.emailVerificationTokens).set({ usedAt: new Date() }).where(eq(s.emailVerificationTokens.id, id));
}

export async function insertConsentRecord(input: {
  id: string;
  customerId: string;
  consentType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}, db: Db = getDb()) {
  await db.insert(s.consentRecords).values(input);
}

export async function findConsentRecordsByCustomerId(customerId: string, db: Db = getDb()) {
  return db.select().from(s.consentRecords).where(eq(s.consentRecords.customerId, customerId));
}

export async function deleteAddressesByCustomerId(customerId: string, db: Db = getDb()) {
  await db.delete(s.addresses).where(eq(s.addresses.customerId, customerId));
}

export async function deleteConsentRecordsByCustomerId(customerId: string, db: Db = getDb()) {
  await db.delete(s.consentRecords).where(eq(s.consentRecords.customerId, customerId));
}

export async function insertNotificationPreferences(input: {
  id: string;
  customerId: string;
}, db: Db = getDb()) {
  await db.insert(s.notificationPreferences).values(input);
}

export async function findWishlistByCustomerId(customerId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.wishlists).where(eq(s.wishlists.customerId, customerId));
  return rows[0] ?? null;
}

export async function insertWishlist(input: {
  id: string;
  customerId: string;
  name?: string;
}, db: Db = getDb()) {
  await db.insert(s.wishlists).values({
    id: input.id,
    customerId: input.customerId,
    name: input.name ?? "Mi lista",
  });
}

export async function insertWishlistItem(input: {
  id: string;
  wishlistId: string;
  skuId: string;
}, db: Db = getDb()) {
  await db.insert(s.wishlistItems).values(input);
}

export async function deleteWishlistItem(wishlistId: string, skuId: string, db: Db = getDb()) {
  await db.delete(s.wishlistItems).where(
    and(eq(s.wishlistItems.wishlistId, wishlistId), eq(s.wishlistItems.skuId, skuId))
  );
}

export async function findWishlistItems(wishlistId: string, db: Db = getDb()) {
  return db.select().from(s.wishlistItems).where(eq(s.wishlistItems.wishlistId, wishlistId));
}
