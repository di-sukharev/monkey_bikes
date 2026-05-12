import { z } from 'zod'

const optionalBooleanStringSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'))
const booleanStringDefaultFalseSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true')

const appEnvSchema = z.enum(['development', 'production', 'test'])

const rawEnvSchema = z.object({
  APP_ENV: appEnvSchema.optional(),
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:8081,http://localhost:19006')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: booleanStringDefaultFalseSchema,
  PAYMENT_PROVIDER: z.enum(['disabled', 'stub']).optional(),
  PAYMENT_STUB_DEV_ENDPOINTS_ENABLED: optionalBooleanStringSchema,
  PAYMENT_CURRENCY: z.enum(['RUB']).default('RUB'),
})

const envSchema = rawEnvSchema.transform((value) => {
  const nodeAppEnv = appEnvSchema.safeParse(value.NODE_ENV)
  const appEnv = value.APP_ENV ?? (nodeAppEnv.success ? nodeAppEnv.data : 'development')
  const production = appEnv === 'production'

  return {
    PORT: value.PORT,
    DATABASE_URL: value.DATABASE_URL,
    JWT_SECRET: value.JWT_SECRET,
    CORS_ORIGINS: value.CORS_ORIGINS,
    ACCESS_TOKEN_TTL_SECONDS: value.ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_DAYS: value.REFRESH_TOKEN_TTL_DAYS,
    COOKIE_SECURE: value.COOKIE_SECURE,
    APP_ENV: appEnv,
    PAYMENT_PROVIDER: value.PAYMENT_PROVIDER ?? (production ? 'disabled' : 'stub'),
    PAYMENT_STUB_DEV_ENDPOINTS_ENABLED:
      value.PAYMENT_STUB_DEV_ENDPOINTS_ENABLED ?? !production,
    PAYMENT_CURRENCY: value.PAYMENT_CURRENCY,
  }
})

export type AppEnv = z.infer<typeof envSchema>

export function loadEnv(source: Record<string, string | undefined>) {
  return envSchema.parse(source)
}
