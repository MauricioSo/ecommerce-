import * as repo from "../infrastructure/repository.ts";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";

export async function authenticateAdminUseCase(email: string, password: string) {
  const user = await repo.findAdminUserByEmail(email);
  if (!user || !user.isActive) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  if (!user.passwordHash.startsWith("$2")) {
    const upgradedHash = await hashPassword(password);
    await repo.updateAdminUserPasswordHash(user.id, upgradedHash);
  }
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function getAdminUserFromSession(sessionValue: string | undefined) {
  if (!sessionValue) return null;
  const user = await repo.findAdminUserById(sessionValue);
  if (!user || !user.isActive) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function seedSuperAdmin(email: string, password: string) {
  const existing = await repo.findAdminUserByEmail(email);
  if (existing) return existing.id;
  const hash = await hashPassword(password);
  return repo.createAdminUser({ email, passwordHash: hash, name: "Super Admin", role: "super_admin" });
}

export async function listAdminUsersUseCase() {
  return repo.listAdminUsers();
}

export async function createAdminUserUseCase(input: { email: string; password: string; name?: string; role?: string }, actorId: string) {
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
