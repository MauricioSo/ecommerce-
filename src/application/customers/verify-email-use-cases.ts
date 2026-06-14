import { findCustomerById, updateCustomer, insertEmailVerificationToken, findEmailVerificationToken, markEmailVerificationTokenUsed } from "../../infrastructure/customers/repository.ts";
import { insertOutboxEvent } from "../../shared/infrastructure/outbox/repository.ts";
import { storePendingToken } from "../../shared/infrastructure/pending-tokens.ts";
import { writeAuditEvent } from "../../shared/infrastructure/audit.ts";

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sendVerificationEmail(customerId: string): Promise<void> {
  const customer = await findCustomerById(customerId);
  if (!customer) return;
  if (customer.emailVerifiedAt) return;

  const rawToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const tokenHash = await hashToken(rawToken);
  const tokenId = crypto.randomUUID();
  await insertEmailVerificationToken({
    id: tokenId,
    customerId: customer.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  storePendingToken(tokenId, rawToken);
  await insertOutboxEvent({
    id: crypto.randomUUID(),
    aggregateType: "customer",
    aggregateId: customer.id,
    eventType: "email_verification_requested",
    payload: { email: customer.email, verificationTokenId: tokenId },
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: new Date(),
  });
}

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  const tokenHash = await hashToken(token);
  const verificationToken = await findEmailVerificationToken(tokenHash);
  if (!verificationToken) return { success: false, error: "Token invalido o expirado" };
  if (verificationToken.usedAt) return { success: false, error: "Token ya utilizado" };
  if (new Date(verificationToken.expiresAt) < new Date()) return { success: false, error: "Token expirado" };

  const customer = await findCustomerById(verificationToken.customerId);
  if (!customer) return { success: false, error: "Usuario no encontrado" };

  await updateCustomer(customer.id, { emailVerifiedAt: new Date() });
  await markEmailVerificationTokenUsed(verificationToken.id);
  await writeAuditEvent({
    aggregateType: "customer_auth",
    aggregateId: customer.id,
    eventType: "auth.email_verified",
    actorId: customer.id,
  }).catch(() => {});

  return { success: true };
}
