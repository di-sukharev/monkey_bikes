import type { PaymentDto } from '@web-app-demo/contracts'

export type PaymentRecord = {
  id: string
  orderId: string
  type: 'deposit' | 'rent'
  provider: 'stub'
  status: 'cancelled' | 'failed' | 'pending' | 'succeeded'
  amountKopecks: number
  currency: string
  providerPaymentId: string | null
  failureReason: string | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function toPaymentDto(payment: PaymentRecord): PaymentDto {
  return {
    id: payment.id,
    orderId: payment.orderId,
    type: payment.type,
    provider: payment.provider,
    status: payment.status,
    amountKopecks: payment.amountKopecks,
    currency: payment.currency as 'RUB',
    providerPaymentId: payment.providerPaymentId,
    failureReason: payment.failureReason,
    completedAt: payment.completedAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  }
}

export function paymentRequirementsMet(payments: PaymentRecord[]) {
  return (
    payments.some((payment) => payment.type === 'rent' && payment.status === 'succeeded') &&
    payments.some((payment) => payment.type === 'deposit' && payment.status === 'succeeded')
  )
}
