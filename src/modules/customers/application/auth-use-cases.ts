import { Email } from "../../../shared/domain/email.ts";
import { validatePasswordStrength } from "../../../shared/domain/password.ts";
import { storePendingToken } from "../../../shared/infrastructure/pending-tokens.ts";
import { writeAuditEvent } from "../../../shared/infrastructure/audit.ts";
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
  insertConsentRecord,
} from "../infrastructure/repository.ts";
import { insertOutboxEvent } from "../../../shared/infrastructure/outbox/repository.ts";

export async function registerCustomer(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  consentGiven?: boolean;
  ip?: string;
  userAgent?: string;
}): Promise<{ customerId: string }> {
  const emailVo = Email.of(input.email);
  if (!input.consentGiven) {
    throw new Error("Debes aceptar la politica de privacidad para registrarte");
  }
  const pwCheck = validatePasswordStrength(input.password);
  if (!pwCheck.valid) {
    throw new Error(pwCheck.errors.join(", "));
  }
  const existing = await findCustomerByEmail(emailVo.value);
  if (existing) throw new Error("Ya existe una cuenta con ese email");
  const hash = await Bun.password.hash(input.password, { algorithm: "bcrypt", cost: 12 });
  const id = crypto.randomUUID();
  const now = new Date();
  await insertCustomer({
    id,
    email: emailVo.value,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    passwordHash: hash,
    countryCode: input.countryCode ?? "CHL",
    locale: "es",
    consentGivenAt: now,
  });
  await insertConsentRecord({
    id: crypto.randomUUID(),
    customerId: id,
    consentType: "privacy_policy",
    ipAddress: input.ip ?? null,
    userAgent: input.userAgent ?? null,
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
    await writeAuditEvent({
      aggregateType: "customer_auth",
      aggregateId: customer?.id ?? crypto.randomUUID(),
      eventType: "auth.login.failure",
      payload: { reason: "not_found_or_inactive", ip: input.ip },
      actorId: "anonymous",
    }).catch(() => {});
    throw new Error("Email o contraseña incorrectos");
  }
  const valid = await Bun.password.verify(input.password, customer.passwordHash);
  if (!valid) {
    await writeAuditEvent({
      aggregateType: "customer_auth",
      aggregateId: customer.id,
      eventType: "auth.login.failure",
      payload: { reason: "wrong_password", ip: input.ip },
      actorId: "anonymous",
    }).catch(() => {});
    throw new Error("Email o contraseña incorrectos");
  }
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
  await writeAuditEvent({
    aggregateType: "customer_auth",
    aggregateId: customer.id,
    eventType: "auth.login.success",
    payload: { ip: input.ip },
    actorId: customer.id,
  }).catch(() => {});
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
  const tokenId = crypto.randomUUID();
  await insertPasswordResetToken({
    id: tokenId,
    customerId: customer.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  storePendingToken(tokenId, rawToken);
  await insertOutboxEvent({
    id: crypto.randomUUID(),
    aggregateType: "customer",
    aggregateId: customer.id,
    eventType: "password_reset_requested",
    payload: { email: emailVo.value, resetTokenId: tokenId },
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: new Date(),
  });
  await writeAuditEvent({
    aggregateType: "customer_auth",
    aggregateId: customer.id,
    eventType: "auth.password_reset_requested",
    actorId: "anonymous",
  }).catch(() => {});
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = await hashToken(token);
  const resetToken = await findPasswordResetToken(tokenHash);
  if (!resetToken) throw new Error("Token inválido o expirado");
  if (resetToken.usedAt) throw new Error("Token ya utilizado");
  if (new Date(resetToken.expiresAt) < new Date()) throw new Error("Token expirado");
  const pwCheck = validatePasswordStrength(newPassword);
  if (!pwCheck.valid) {
    throw new Error(pwCheck.errors.join(", "));
  }
  const hash = await Bun.password.hash(newPassword, { algorithm: "bcrypt", cost: 12 });
  await updateCustomer(resetToken.customerId, { passwordHash: hash });
  await markPasswordResetTokenUsed(resetToken.id);
  await deleteAllCustomerSessions(resetToken.customerId);
  await writeAuditEvent({
    aggregateType: "customer_auth",
    aggregateId: resetToken.customerId,
    eventType: "auth.password_reset_completed",
    actorId: resetToken.customerId,
  }).catch(() => {});
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
