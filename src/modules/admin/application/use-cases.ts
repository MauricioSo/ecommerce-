import * as repo from "../infrastructure/repository.ts";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import { signAdminToken, verifyAdminToken, type AdminJwtPayload } from "../../../shared/infrastructure/auth/jwt.ts";
import { validatePasswordStrength } from "../../../shared/domain/password.ts";
import { writeAuditEvent } from "../../../shared/infrastructure/audit.ts";

export async function authenticateAdminUseCase(email: string, password: string, meta?: { ip?: string; userAgent?: string }) {
  const user = await repo.findAdminUserByEmail(email);
  if (!user || !user.isActive) {
    await writeAuditEvent({
      aggregateType: "admin_auth",
      aggregateId: user?.id ?? crypto.randomUUID(),
      eventType: "auth.login.failure",
      payload: { reason: "not_found_or_inactive", ip: meta?.ip },
      actorId: "anonymous",
    }).catch(() => {});
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await writeAuditEvent({
      aggregateType: "admin_auth",
      aggregateId: user.id,
      eventType: "auth.login.failure",
      payload: { reason: "wrong_password", ip: meta?.ip },
      actorId: "anonymous",
    }).catch(() => {});
    return null;
  }
  if (!user.passwordHash.startsWith("$2")) {
    const upgradedHash = await hashPassword(password);
    await repo.updateAdminUserPasswordHash(user.id, upgradedHash);
  }
  await writeAuditEvent({
    aggregateType: "admin_auth",
    aggregateId: user.id,
    eventType: "auth.login.success",
    payload: { ip: meta?.ip, userAgent: meta?.userAgent },
    actorId: user.id,
  }).catch(() => {});
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function createAdminSession(input: {
  userId: string;
  role: string;
  ip?: string;
  userAgent?: string;
}): Promise<string> {
  const token = await signAdminToken({ userId: input.userId, role: input.role });
  const payload = await verifyAdminToken(token);
  if (!payload) throw new Error("Failed to create admin session");
  await repo.insertAdminSession({
    id: crypto.randomUUID(),
    adminUserId: input.userId,
    tokenJti: payload.jti,
    ipAddress: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    expiresAt: new Date(payload.exp * 1000),
  });
  return token;
}

export async function getAdminUserFromSession(sessionValue: string | undefined) {
  if (!sessionValue) return null;
  const payload = await verifyAdminToken(sessionValue);
  if (!payload) return null;
  const session = await repo.findAdminSessionByJti(payload.jti);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) return null;
  const user = await repo.findAdminUserById(payload.sub);
  if (!user || !user.isActive) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function revokeAdminSession(sessionValue: string | undefined): Promise<void> {
  if (!sessionValue) return;
  const payload = await verifyAdminToken(sessionValue);
  if (!payload) return;
  await repo.deleteAdminSession(payload.jti);
  await writeAuditEvent({
    aggregateType: "admin_auth",
    aggregateId: payload.sub,
    eventType: "auth.logout",
    actorId: payload.sub,
  }).catch(() => {});
}

export async function seedSuperAdmin(email: string, password: string) {
  const existing = await repo.findAdminUserByEmail(email);
  if (existing) return existing.id;
  const pwCheck = validatePasswordStrength(password);
  if (!pwCheck.valid) {
    throw new Error(`Admin password does not meet policy: ${pwCheck.errors.join(", ")}`);
  }
  const hash = await hashPassword(password);
  return repo.createAdminUser({ email, passwordHash: hash, name: "Super Admin", role: "super_admin" });
}

export async function listAdminUsersUseCase() {
  return repo.listAdminUsers();
}

export async function createAdminUserUseCase(input: { email: string; password: string; name?: string; role?: string }, actorId: string) {
  const pwCheck = validatePasswordStrength(input.password);
  if (!pwCheck.valid) {
    throw new Error(`Password does not meet policy: ${pwCheck.errors.join(", ")}`);
  }
  const hash = await hashPassword(input.password);
  const id = await repo.createAdminUser({ email: input.email, passwordHash: hash, name: input.name, role: input.role });
  await getDb().insert(s.auditEvents).values({
    id: crypto.randomUUID(),
    aggregateType: "admin_user",
    aggregateId: id,
    eventType: "admin_user_created",
    payload: { email: input.email, role: input.role ?? "support_agent" },
    actorId,
    correlationId: null,
  });
  return id;
}

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith("$2")) {
    return Bun.password.verify(password, hash);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const legacyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return legacyHash === hash;
}

export { signAdminToken, verifyAdminToken, type AdminJwtPayload };
