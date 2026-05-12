import type {
  AdminUpdateUserRequest,
  AdminUsersQuery,
  UserDto,
} from '@web-app-demo/contracts'

import type { DbClient } from '../db'
import { Prisma } from '../generated/prisma/client'
import { AppError } from '../http/errors'
import { toUserDto, type AuthenticatedUser } from '../auth/service'

const updateUserMaxAttempts = 3

export class AdminUserService {
  constructor(private readonly db: DbClient) {}

  async listUsers(query: AdminUsersQuery) {
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
    }
    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.db.user.count({ where }),
    ])

    return {
      items: items.map(toUserDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async getUser(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
    })

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found')
    }

    return {
      user: toUserDto(user),
    }
  }

  async updateUser(id: string, input: AdminUpdateUserRequest, actor: AuthenticatedUser) {
    for (let attempt = 1; attempt <= updateUserMaxAttempts; attempt += 1) {
      try {
        return await this.db.$transaction(
          async (tx): Promise<{ user: UserDto }> => {
            const target = await tx.user.findUnique({
              where: { id },
            })

            if (!target) {
              throw new AppError(404, 'NOT_FOUND', 'User not found')
            }

            const nextRole = input.role ?? target.role
            const nextStatus = input.status ?? target.status

            if (actor.id === target.id && (nextRole !== 'admin' || nextStatus === 'blocked')) {
              throw new AppError(409, 'CONFLICT', 'Admin cannot remove their own admin access')
            }

            if (
              target.role === 'admin' &&
              target.status === 'active' &&
              (nextRole !== 'admin' || nextStatus !== 'active')
            ) {
              const otherActiveAdmins = await tx.user.count({
                where: {
                  id: { not: target.id },
                  role: 'admin',
                  status: 'active',
                },
              })

              if (otherActiveAdmins === 0) {
                throw new AppError(409, 'CONFLICT', 'At least one active admin is required')
              }
            }

            const user = await tx.user.update({
              where: { id: target.id },
              data: {
                ...(input.role === undefined ? {} : { role: input.role }),
                ...(input.status === undefined ? {} : { status: input.status }),
              },
            })

            if (target.status !== 'blocked' && nextStatus === 'blocked') {
              await tx.authSession.updateMany({
                where: {
                  userId: target.id,
                  revokedAt: null,
                },
                data: {
                  revokedAt: new Date(),
                },
              })
            }

            return {
              user: toUserDto(user),
            }
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        )
      } catch (error) {
        if (isTransactionConflict(error) && attempt < updateUserMaxAttempts) {
          continue
        }

        if (isTransactionConflict(error)) {
          throw new AppError(409, 'CONFLICT', 'Concurrent user update conflict')
        }

        throw error
      }
    }

    throw new AppError(409, 'CONFLICT', 'Concurrent user update conflict')
  }
}

function isTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
    return true
  }

  if (!error || typeof error !== 'object' || !('cause' in error)) {
    return false
  }

  const cause = error.cause
  if (!cause || typeof cause !== 'object') {
    return false
  }

  return (
    ('kind' in cause && cause.kind === 'TransactionWriteConflict') ||
    ('originalCode' in cause && cause.originalCode === '40001')
  )
}
