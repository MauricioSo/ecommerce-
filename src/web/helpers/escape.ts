const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

const ENTITY_RE = /[&<>"']/g;

export function escapeHtml(str: string): string {
  return str.replace(ENTITY_RE, (c) => ENTITIES[c] ?? c);
}

export function escapeAttr(str: string): string {
  return escapeHtml(str);
}

export function sanitizeJsonForScript(json: string): string {
  return json.replace(/<\//g, "<\\/");
}
