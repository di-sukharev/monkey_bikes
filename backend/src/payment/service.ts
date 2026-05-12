import { randomUUID } from 'node:crypto'

import type {
  AdminPaymentsQuery,
  AdminPaymentsResponse,
  PaymentResponse,
  PaymentStatus,
  PaymentType,
} from '@web-app-demo/contracts'
import { maxOrderAmountKopecks } from '@web-app-demo/contracts'

import type { AuthenticatedUser } from '../auth/service'
import type { DbClient } from '../db'
import type { AppEnv } from '../env'
import { Prisma } from '../generated/prisma/client'
import { AppError } from '../http/errors'
import type { PaymentRecord } from './dto'
import { toPaymentDto } from './dto'

type StubOutcome = 'cancelled' | 'failed' | 'succeeded'
type PaymentCreateResponse = PaymentResponse & {
  created: boolean
}
type PaymentWithOrderRecord = PaymentRecord & {
  order: {
    userId: string
  }
}

const activePaymentKey = 'active'
const paymentTransactionMaxAttempts = 3

export class PaymentService {
  constructor(
    private readonly db: DbClient,
    private readonly env: AppEnv,
  ) {}

  async createCurrentUserPayment(
    user: AuthenticatedUser,
    orderId: string,
    type: PaymentType,
  ): Promise<PaymentCreateResponse> {
    this.assertStubProviderEnabled()

    const result = await this.runPaymentTransaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          userId: user.id,
        },
        include: {
          payments: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          },
        },
      })

      if (!order) {
        throw new AppError(404, 'NOT_FOUND', 'Order not found')
      }

      if (order.status !== 'confirmed') {
        throw new AppError(
          409,
          'PAYMENT_NOT_ALLOWED',
          'Payments can only be created for confirmed orders',
        )
      }

      const activePayment = order.payments.find(
        (payment) =>
          payment.type === type &&
          (payment.status === 'pending' || payment.status === 'succeeded'),
      )
      if (activePayment) {
        return {
          payment: activePayment,
          created: false,
        }
      }

      const amountKopecks = paymentAmountKopecks(order, type)
      assertPaymentAmountFits(amountKopecks)
      const succeededImmediately = type === 'deposit' && amountKopecks === 0
      const now = new Date()

      return {
        payment: await tx.payment.create({
          data: {
            orderId: order.id,
            type,
            provider: 'stub',
            status: succeededImmediately ? 'succeeded' : 'pending',
            amountKopecks,
            currency: this.env.PAYMENT_CURRENCY,
            providerPaymentId: `stub_${randomUUID()}`,
            completedAt: succeededImmediately ? now : null,
            activeKey: activePaymentKey,
          },
        }),
        created: true,
      }
    })

    return {
      payment: toPaymentDto(result.payment),
      created: result.created,
    }
  }

  async completeStubPayment(
    actor: AuthenticatedUser,
    id: string,
    outcome: StubOutcome,
  ): Promise<PaymentResponse> {
    this.assertStubProviderEnabled()
    this.assertStubDevEndpointsEnabled()

    const payment = await this.runPaymentTransaction(async (tx) => {
      const current = await this.paymentWithOrder(tx, id)

      if (!current) {
        throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found')
      }

      this.assertCanAccessPayment(actor, current)

      if (current.status === outcome) {
        return current
      }

      if (current.status === 'succeeded') {
        throw new AppError(
          409,
          'PAYMENT_NOT_COMPLETABLE',
          'Succeeded payments cannot be changed by stub endpoints',
        )
      }

      if (current.status === 'failed' || current.status === 'cancelled') {
        throw new AppError(
          409,
          'PAYMENT_NOT_COMPLETABLE',
          'Failed or cancelled payments require a new attempt',
        )
      }

      return tx.payment.update({
        where: { id: current.id },
        data: {
          status: outcome,
          completedAt: new Date(),
          failureReason:
            outcome === 'succeeded'
              ? null
              : outcome === 'failed'
                ? 'Stub payment failed'
                : 'Stub payment cancelled',
          activeKey: outcome === 'succeeded' ? activePaymentKey : null,
        },
      })
    })

    return {
      payment: toPaymentDto(payment),
    }
  }

  async listAdminPayments(query: AdminPaymentsQuery): Promise<AdminPaymentsResponse> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
    }
    const skip = (query.page - 1) * query.pageSize

    const [items, total] = await this.db.$transaction([
      this.db.payment.findMany({
        where,
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
      this.db.payment.count({ where }),
    ])

    return {
      items: items.map((payment) => ({
        ...toPaymentDto(payment),
        order: {
          id: payment.order.id,
          status: payment.order.status,
          startsOn: payment.order.startsOn,
          endsOn: payment.order.endsOn,
          user: payment.order.user,
        },
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  private paymentWithOrder(tx: Prisma.TransactionClient, id: string) {
    return tx.payment.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            userId: true,
          },
        },
      },
    })
  }

  private assertStubProviderEnabled() {
    if (this.env.PAYMENT_PROVIDER !== 'stub') {
      throw new AppError(503, 'PAYMENT_PROVIDER_DISABLED', 'Stub payment provider is disabled')
    }
  }

  private assertStubDevEndpointsEnabled() {
    if (!this.env.PAYMENT_STUB_DEV_ENDPOINTS_ENABLED) {
      throw new AppError(
        403,
        'PAYMENT_DEV_ENDPOINTS_DISABLED',
        'Stub payment completion endpoints are disabled',
      )
    }
  }

  private assertCanAccessPayment(actor: AuthenticatedUser, payment: PaymentWithOrderRecord) {
    if (actor.role === 'admin') return

    if (actor.role !== 'user') {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
    }

    if (payment.order.userId !== actor.id) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found')
    }
  }

  private async runPaymentTransaction<T>(
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    for (let attempt = 1; attempt <= paymentTransactionMaxAttempts; attempt += 1) {
      try {
        return await this.db.$transaction(action, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        })
      } catch (error) {
        if (isPaymentTransactionConflict(error) && attempt < paymentTransactionMaxAttempts) {
          continue
        }

        if (isPaymentTransactionConflict(error)) {
          throw new AppError(409, 'CONFLICT', 'Concurrent payment update conflict')
        }

        throw error
      }
    }

    throw new AppError(409, 'CONFLICT', 'Concurrent payment update conflict')
  }
}

function paymentAmountKopecks(
  order: {
    rentalAmountKopecks: number
    depositAmountKopecks: number
    deliveryAmountKopecks: number
  },
  type: PaymentType,
) {
  if (type === 'deposit') return order.depositAmountKopecks
  return order.rentalAmountKopecks + order.deliveryAmountKopecks
}

function assertPaymentAmountFits(amountKopecks: number) {
  if (
    !Number.isSafeInteger(amountKopecks) ||
    amountKopecks < 0 ||
    amountKopecks > maxOrderAmountKopecks
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Payment amount exceeds the maximum supported amount')
  }
}

function isPaymentTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034' || error.code === 'P2002'
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
