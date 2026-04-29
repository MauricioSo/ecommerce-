import { getConfig } from "../../shared/infrastructure/config.ts";

export function ensureCsrfToken(cookie: Record<string, any>): string {
  const existing = cookie._csrf?.value as string | undefined;
  if (existing) return existing;

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  cookie._csrf?.set?.({
    value: token,
    httpOnly: true,
    secure: getConfig().NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return token;
}
