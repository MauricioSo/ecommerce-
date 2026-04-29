import { eq } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";

export async function findAdminUserByEmail(email: string) {
  const db = getDb();
  const rows = await db.select().from(s.adminUsers).where(eq(s.adminUsers.email, email));
  return rows[0] ?? null;
}

export async function findAdminUserById(id: string) {
  const db = getDb();
  const rows = await db.select().from(s.adminUsers).where(eq(s.adminUsers.id, id));
  return rows[0] ?? null;
}

export async function createAdminUser(input: {
  email: string;
  passwordHash: string;
  name?: string;
  role?: string;
}) {
  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(s.adminUsers).values({
    id,
    email: input.email,
    passwordHash: input.passwordHash,
    name: input.name ?? null,
    role: input.role ?? "support_agent",
  });
  return id;
}

export async function updateAdminUserPasswordHash(id: string, passwordHash: string) {
  const db = getDb();
  await db.update(s.adminUsers).set({ passwordHash, updatedAt: new Date() }).where(eq(s.adminUsers.id, id));
}

export async function listAdminUsers() {
  const db = getDb();
  return db.select({
    id: s.adminUsers.id,
    email: s.adminUsers.email,
    name: s.adminUsers.name,
    role: s.adminUsers.role,
    isActive: s.adminUsers.isActive,
    createdAt: s.adminUsers.createdAt,
  }).from(s.adminUsers);
}

export function hasPermission(role: string, permission: string): boolean {
  const roleDef = s.ROLES[role as keyof typeof s.ROLES];
  if (!roleDef) return false;
  return (roleDef.permissions as readonly string[]).includes(permission);
}
