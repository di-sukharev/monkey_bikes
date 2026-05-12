import { expect, test } from 'bun:test'

import type { DbClient } from '../db'
import { seedAdminUser } from './seed-admin-user'

test('seedAdminUser revokes active sessions for the seeded admin', async () => {
  const calls: string[] = []
  const tx = {
    user: {
      upsert: async (args: {
        where: { email: string }
        update: { role: string; status: string }
        create: { role: string; status: string }
      }) => {
        calls.push('upsert')
        expect(args.where.email).toBe('admin@example.com')
        expect(args.update.role).toBe('admin')
        expect(args.update.status).toBe('active')
        expect(args.create.role).toBe('admin')
        expect(args.create.status).toBe('active')
        return {
          id: 'admin_1',
          email: args.where.email,
        }
      },
    },
    authSession: {
      updateMany: async (args: {
        where: { userId: string; revokedAt: null }
        data: { revokedAt: Date }
      }) => {
        calls.push('revokeSessions')
        expect(args.where).toEqual({
          userId: 'admin_1',
          revokedAt: null,
        })
        expect(args.data.revokedAt).toBeInstanceOf(Date)
        return { count: 2 }
      },
    },
  }
  const db = {
    $transaction: async <T>(callback: (transactionClient: typeof tx) => Promise<T>) => callback(tx),
  } as unknown as Pick<DbClient, '$transaction'>

  const admin = await seedAdminUser(db, {
    email: 'admin@example.com',
    passwordHash: 'hashed-password',
    displayName: 'Local Admin',
  })

  expect(admin.id).toBe('admin_1')
  expect(calls).toEqual(['upsert', 'revokeSessions'])
})
