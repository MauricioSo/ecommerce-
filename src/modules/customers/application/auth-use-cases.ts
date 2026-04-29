import { Email } from "../../../shared/domain/email.ts";
import {
  findCustomerByEmail,
  insertCustomer,
  updateCustomer,
  insertCustomerSession,
  findCustomerSessionByTokenHash,
  deleteCustomerSession,
  deleteAllCustomerSessions,
  insertPasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  insertNotificationPreferences,
  insertWishlist,
} from "../infrastructure/repository.ts";
import { insertOutboxEvent } from "../../../shared/infrastructure/outbox/repository.ts";

export async function registerCustomer(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;
}): Promise<{ customerId: string }> {
  const emailVo = Email.of(input.email);
  const existing = await findCustomerByEmail(emailVo.value);
  if (existing) throw new Error("Ya existe una cuenta con ese email");
  const hash = await Bun.password.hash(input.password, { algorithm: "bcrypt", cost: 12 });
  const id = crypto.randomUUID();
  await insertCustomer({
    id,
    email: emailVo.value,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    passwordHash: hash,
    countryCode: input.countryCode ?? "CHL",
    locale: "es",
  });
  await insertNotificationPreferences({ id: crypto.randomUUID(), customerId: id });
  await insertWishlist({ id: crypto.randomUUID(), customerId: id, name: "Mis favoritos" });
  await insertOutboxEvent({
    id: crypto.randomUUID(),
    aggregateType: "customer",
    aggregateId: id,
    eventType: "customer_registered",
    payload: { email: emailVo.value, firstName: input.firstName, lastName: input.lastName },
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: new Date(),
  });
  return { customerId: id };
}

export async function loginCustomer(input: {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}): Promise<{ token: string; customerId: string }> {
  const emailVo = Email.of(input.email);
  const customer = await findCustomerByEmail(emailVo.value);
  if (!customer || !customer.passwordHash || !customer.isActive) {
    throw new Error("Email o contraseña incorrectos");
  }
  const valid = await Bun.password.verify(input.password, customer.passwordHash);
  if (!valid) throw new Error("Email o contraseña incorrectos");
  const rawToken = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString("base64url");
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await insertCustomerSession({
    id: crypto.randomUUID(),
    customerId: customer.id,
    tokenHash,
    expiresAt,
    ipAddress: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
  await updateCustomer(customer.id, { lastLoginAt: new Date() });
  return { token: rawToken, customerId: customer.id };
}

export async function logoutCustomer(token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await deleteCustomerSession(tokenHash);
}

export async function verifyCustomerSession(token: string): Promise<{ customerId: string; email: string; firstName: string | null; lastName: string | null } | null> {
  const tokenHash = await hashToken(token);
  const session = await findCustomerSessionByTokenHash(tokenHash);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) return null;
  const { findCustomerById } = await import("../infrastructure/repository.ts");
  const customer = await findCustomerById(session.customerId);
  if (!customer || !customer.isActive) return null;
  return { customerId: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const emailVo = Email.of(email);
  const customer = await findCustomerByEmail(emailVo.value);
  if (!customer) return;
  const rawToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const tokenHash = await hashToken(rawToken);
  await insertPasswordResetToken({
    id: crypto.randomUUID(),
    customerId: customer.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await insertOutboxEvent({
    id: crypto.randomUUID(),
    aggregateType: "customer",
    aggregateId: customer.id,
    eventType: "password_reset_requested",
    payload: { email: emailVo.value, resetToken: rawToken },
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: new Date(),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = await hashToken(token);
  const resetToken = await findPasswordResetToken(tokenHash);
  if (!resetToken) throw new Error("Token inválido o expirado");
  if (resetToken.usedAt) throw new Error("Token ya utilizado");
  if (new Date(resetToken.expiresAt) < new Date()) throw new Error("Token expirado");
  const hash = await Bun.password.hash(newPassword, { algorithm: "bcrypt", cost: 12 });
  await updateCustomer(resetToken.customerId, { passwordHash: hash });
  await markPasswordResetTokenUsed(resetToken.id);
  await deleteAllCustomerSessions(resetToken.customerId);
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
