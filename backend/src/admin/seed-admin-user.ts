import type { DbClient } from '../db'

type SeedAdminUserInput = {
  email: string
  passwordHash: string
  displayName: string
}

export async function seedAdminUser(
  db: Pick<DbClient, '$transaction'>,
  input: SeedAdminUserInput,
) {
  return db.$transaction(async (tx) => {
    const admin = await tx.user.upsert({
      where: {
        email: input.email,
      },
      update: {
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: 'admin',
        status: 'active',
      },
      create: {
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: 'admin',
        status: 'active',
      },
    })

    await tx.authSession.updateMany({
      where: {
        userId: admin.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })

    return admin
  })
}
