import { getConfig } from "../config.ts";

const HEADER = { alg: "HS256", typ: "JWT" };
const ENCODER = new TextEncoder();

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function textToBase64url(text: string): string {
  return base64url(ENCODER.encode(text));
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = getConfig().JWT_SECRET;
  return crypto.subtle.importKey("raw", ENCODER.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export interface AdminJwtPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
  jti: string;
}

export async function signAdminToken(payload: { userId: string; role: string }): Promise<string> {
  const key = await getHmacKey();
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const body: AdminJwtPayload = { sub: payload.userId, role: payload.role, iat: now, exp: now + 8 * 3600, jti };
  const headerB64 = textToBase64url(JSON.stringify(HEADER));
  const bodyB64 = textToBase64url(JSON.stringify(body));
  const message = `${headerB64}.${bodyB64}`;
  const sig = await crypto.subtle.sign("HMAC", key, ENCODER.encode(message));
  return `${message}.${base64url(sig)}`;
}

export async function verifyAdminToken(token: string): Promise<AdminJwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const headerB64 = parts[0] ?? "";
  const bodyB64 = parts[1] ?? "";
  const sigB64 = parts[2] ?? "";
  const key = await getHmacKey();
  const message = `${headerB64}.${bodyB64}`;
  const sigBuf = base64urlDecode(sigB64).buffer as ArrayBuffer;
  const valid = await crypto.subtle.verify("HMAC", key, sigBuf, ENCODER.encode(message));
  if (!valid) return null;
  try {
    const payload: AdminJwtPayload = JSON.parse(new TextDecoder().decode(base64urlDecode(bodyB64)));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.sub || !payload.jti) return null;
    return payload;
  } catch {
    return null;
  }
}
