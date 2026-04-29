export const EditorialStatus = {
  DRAFT: "draft",
  REVIEW: "review",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type EditorialStatus = (typeof EditorialStatus)[keyof typeof EditorialStatus];

export const EDITORIAL_TRANSITIONS: Record<EditorialStatus, EditorialStatus[]> = {
  draft: ["review", "archived"],
  review: ["published", "draft", "archived"],
  published: ["archived", "review"],
  archived: ["draft"],
};

export const AttributeType = {
  TEXT: "text",
  NUMBER: "number",
  BOOLEAN: "boolean",
  SELECT: "select",
  MULTI_SELECT: "multi_select",
  COLOR: "color",
} as const;

export type AttributeType = (typeof AttributeType)[keyof typeof AttributeType];
