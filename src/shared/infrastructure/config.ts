import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/ecommerce"),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_SSL: z.enum(["true", "false"]).default("false"),
  JWT_SECRET: z.string().default("dev-secret-change-in-production"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PAYMENT_PROVIDER: z.enum(["mock", "mercadopago", "webpay"]).default("mock"),
  MP_ACCESS_TOKEN: z.string().default(""),
  MP_PUBLIC_KEY: z.string().default(""),
  MP_WEBHOOK_SECRET: z.string().default(""),
  TBK_COMMERCE_CODE: z.string().default(""),
  TBK_API_KEY: z.string().default(""),
  TBK_ENV: z.enum(["integration", "production"]).default("integration"),
  PAYMENT_WEBHOOK_IP_ALLOWLIST: z.string().default(""),
  BASE_URL: z.string().default("http://localhost:3000"),
  APP_VERSION: z.string().default("1.0.0"),
  STYLIST_AI_ENABLED: z.preprocess((value) => value === true || value === "true" || value === "1", z.boolean()).default(false),
  STYLIST_AI_PROVIDER: z.enum(["claude", "deepseek"]).default("claude"),
  DEEPSEEK_API_KEY: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  ADMIN_EMAIL: z.string().default(""),
  ADMIN_PASSWORD: z.string().default(""),
  RATE_LIMIT_SCALE: z.coerce.number().default(1),
}).refine(
  (data) => {
    if (data.NODE_ENV === "production" || data.NODE_ENV === "staging") {
      if (data.JWT_SECRET.length < 32) return false;
      if (data.JWT_SECRET === "dev-secret-change-in-production") return false;
      if (data.DATABASE_URL === "postgres://postgres:postgres@localhost:5432/ecommerce") return false;
      if (data.BASE_URL === "http://localhost:3000") return false;
    }
    return true;
  },
  { message: "Production/staging requires secure JWT_SECRET (32+ chars), DATABASE_URL, and BASE_URL (not localhost defaults)" },
).refine(
  (data) => {
    if ((data.NODE_ENV === "production" || data.NODE_ENV === "staging") && data.PAYMENT_PROVIDER === "webpay") {
      if (!data.TBK_COMMERCE_CODE || !data.TBK_API_KEY) return false;
    }
    return true;
  },
  { message: "WebPay payment provider requires TBK_COMMERCE_CODE and TBK_API_KEY in production" },
).refine(
  (data) => {
    if ((data.NODE_ENV === "production" || data.NODE_ENV === "staging") && data.PAYMENT_PROVIDER === "mercadopago") {
      if (!data.MP_ACCESS_TOKEN || !data.MP_WEBHOOK_SECRET) return false;
    }
    return true;
  },
  { message: "MercadoPago payment provider requires MP_ACCESS_TOKEN and MP_WEBHOOK_SECRET in production" },
);

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function resetConfig(): void {
  cached = null;
}

export function getConfig(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((iss: { path: readonly PropertyKey[]; message: string }) => `${iss.path.join(".")}: ${iss.message}`);
    throw new Error(`Invalid environment config:\n${errors.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}
