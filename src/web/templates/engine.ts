import { Eta } from "eta";
import { existsSync } from "fs";
import { join, resolve } from "path";

const VIEWS_DIR = resolve(import.meta.dir);

const eta = new Eta({
  views: VIEWS_DIR,
  cache: process.env.NODE_ENV === "production",
  autoEscape: true,
});

export function renderView(template: string, data: Record<string, unknown> = {}): string {
  const templatePath = join(VIEWS_DIR, template);
  if (!existsSync(templatePath) && !existsSync(templatePath + ".eta")) {
    throw new Error(`Template not found: ${template}`);
  }
  return eta.render(template, data) ?? "";
}

export function renderPartial(template: string, data: Record<string, unknown> = {}): string {
  return renderView(join("partials", template), data);
}

export function renderPage(section: "storefront" | "admin", template: string, data: Record<string, unknown> = {}): string {
  return renderView(join("pages", section, template), data);
}
