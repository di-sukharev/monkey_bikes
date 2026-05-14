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
const knownWeakJwtSecrets = new Set(['replace-with-at-least-32-random-characters'])

const rawEnvSchema = z
  .object({
    APP_ENV: appEnvSchema.optional(),
    NODE_ENV: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(43180),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    CORS_ORIGINS: z
      .string()
      .default(
        'http://localhost:43180,http://127.0.0.1:43180,http://10.0.2.2:43180,http://localhost:43181,http://127.0.0.1:43181,http://localhost:43182,http://127.0.0.1:43182,http://localhost:43183,http://127.0.0.1:43183',
      )
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
  .superRefine((value, context) => {
    const nodeAppEnv = appEnvSchema.safeParse(value.NODE_ENV)
    const appEnv = value.APP_ENV ?? (nodeAppEnv.success ? nodeAppEnv.data : 'development')

    if (appEnv === 'production' && isWeakJwtSecret(value.JWT_SECRET)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_SECRET must be a non-placeholder random secret in production',
        path: ['JWT_SECRET'],
      })
    }
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

function isWeakJwtSecret(secret: string) {
  const normalized = secret.trim().toLowerCase()
  return knownWeakJwtSecrets.has(normalized) || new Set(secret).size === 1
}
