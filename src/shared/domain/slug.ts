const ACCENT_MAP: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
  ñ: "n",
  Á: "a",
  É: "e",
  Í: "i",
  Ó: "o",
  Ú: "u",
  Ü: "u",
  Ñ: "n",
};

export function generateSlug(text: string, _locale?: string): string {
  let slug = text
    .split("")
    .map((ch) => ACCENT_MAP[ch] ?? ch)
    .join("");
  slug = slug.toLowerCase();
  slug = slug.replace(/[^a-z0-9]+/g, "-");
  slug = slug.replace(/^-+|-+$/g, "");
  slug = slug.replace(/-{2,}/g, "-");
  return slug.slice(0, 200);
}
