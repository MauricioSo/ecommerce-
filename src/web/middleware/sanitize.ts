const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

const HTML_ENTITY_RE = /[&<>"'/]/g;

export function sanitizeHtml(input: string): string {
  return input.replace(HTML_ENTITY_RE, (c) => HTML_ENTITIES[c] ?? c);
}

export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(HTML_ENTITY_RE, (c) => HTML_ENTITIES[c] ?? c);
}

const SQL_DANGEROUS = /(--|;|\/\*|\*\/|xp_|sp_|exec|execute|select|insert|update|delete|drop|alter|create|truncate)/i;

export function hasSqlInjection(input: string): boolean {
  return SQL_DANGEROUS.test(input);
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeHtml(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) => {
        if (typeof v === "string") return sanitizeHtml(v);
        if (v && typeof v === "object") return sanitizeObject(v as Record<string, unknown>);
        return v;
      });
    } else if (value && typeof value === "object") {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
