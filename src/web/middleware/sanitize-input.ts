import Elysia from "elysia";
import { sanitizeObject } from "./sanitize.ts";

function trimStrings(input: unknown): unknown {
  if (typeof input === "string") return input.trim();
  if (Array.isArray(input)) return input.map(trimStrings);
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = trimStrings(v);
    }
    return out;
  }
  return input;
}

export const sanitizeInputPlugin = new Elysia({ name: "sanitize-input" })
  .onBeforeHandle(({ body }) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const sanitized = sanitizeObject(trimStrings(body) as Record<string, unknown>);
      Object.assign(body, sanitized);
    }
  })
  .as("global");
