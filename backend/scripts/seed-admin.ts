import 'dotenv/config'

import { createPrisma } from '../src/db'
import { hashPassword } from '../src/auth/passwords'
import { parseSeedAdminConfig } from '../src/admin/seed-admin-config'
import { seedAdminUser } from '../src/admin/seed-admin-user'

const env = parseSeedAdminConfig(process.env)
const prisma = createPrisma(env.DATABASE_URL)

try {
  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD)
  const admin = await seedAdminUser(prisma, {
    email: env.SEED_ADMIN_EMAIL,
    passwordHash,
    displayName: env.SEED_ADMIN_DISPLAY_NAME,
  })

  console.log(`Seeded active admin user: ${admin.email}`)
} finally {
  await prisma.$disconnect()
}
