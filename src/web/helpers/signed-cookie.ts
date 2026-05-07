import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "../../shared/infrastructure/config.ts";

const SIGNATURE_PREFIX = "v1";

function signatureFor(value: string): string {
  return createHmac("sha256", getConfig().JWT_SECRET).update(value).digest("base64url");
}

export function signCookieValue(value: string): string {
  return `${SIGNATURE_PREFIX}.${value}.${signatureFor(value)}`;
}

export function verifySignedCookieValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const [prefix, value, signature, ...extra] = raw.split(".");
  if (prefix !== SIGNATURE_PREFIX || !value || !signature || extra.length > 0) return null;
  const expected = signatureFor(value);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(actualBuffer, expectedBuffer) ? value : null;
}
