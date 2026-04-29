import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/ecommerce"),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(10),
  JWT_SECRET: z.string().default("dev-secret-change-in-production"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PAYMENT_PROVIDER: z.enum(["mock", "mercadopago", "webpay"]).default("mock"),
  MP_ACCESS_TOKEN: z.string().default(""),
  MP_PUBLIC_KEY: z.string().default(""),
  MP_WEBHOOK_SECRET: z.string().default(""),
  TBK_COMMERCE_CODE: z.string().default(""),
  TBK_API_KEY: z.string().default(""),
  TBK_ENV: z.enum(["integration", "production"]).default("integration"),
  BASE_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

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
