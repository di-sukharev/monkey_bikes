import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from './generated/prisma/client'

export function createPrisma(connectionString: string) {
  const adapter = new PrismaPg({ connectionString: normalizePgConnectionString(connectionString) })
  return new PrismaClient({ adapter })
}

export function normalizePgConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString)

    if (
      url.searchParams.get('sslmode') === 'require' &&
      !url.searchParams.has('uselibpqcompat')
    ) {
      url.searchParams.set('uselibpqcompat', 'true')
    }

    return url.toString()
  } catch {
    return connectionString
  }
}

export type DbClient = ReturnType<typeof createPrisma>
