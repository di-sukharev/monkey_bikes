import { emailSchema, passwordSchema } from '@web-app-demo/contracts'
import { z } from 'zod'

const booleanStringSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const seedAdminEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SEED_ADMIN_EMAIL: emailSchema,
  SEED_ADMIN_PASSWORD: passwordSchema,
  SEED_ADMIN_DISPLAY_NAME: z
    .union([z.string().trim().min(2).max(80), z.literal('')])
    .optional()
    .transform((value) => {
      if (value === '' || value === undefined) return 'Local Admin'
      return value
    }),
  SEED_ADMIN_ALLOW_NON_LOCAL: booleanStringSchema,
})

export type SeedAdminConfig = z.infer<typeof seedAdminEnvSchema>

export function parseSeedAdminConfig(source: Record<string, string | undefined>): SeedAdminConfig {
  const config = seedAdminEnvSchema.parse(source)

  if (isKnownInsecurePassword(config.SEED_ADMIN_PASSWORD)) {
    throw new Error('SEED_ADMIN_PASSWORD must not use a known insecure example password')
  }

  if (!config.SEED_ADMIN_ALLOW_NON_LOCAL && !isLocalDatabaseUrl(config.DATABASE_URL)) {
    throw new Error('seed:admin can only target a local database unless explicitly overridden')
  }

  return config
}

function isKnownInsecurePassword(password: string) {
  return ['password123', 'admin12345', 'change-me', 'replace-me'].includes(password.toLowerCase())
}

function isLocalDatabaseUrl(databaseUrl: string) {
  try {
    const { hostname } = new URL(databaseUrl)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}
