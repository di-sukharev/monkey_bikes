import { z } from 'zod'

const moneyKopecks = z.number().int().min(0).max(1_000_000_000)

export const paymentTypeSchema = z.enum(['deposit', 'rent'])
export const paymentProviderSchema = z.enum(['stub'])
export const paymentStatusSchema = z.enum(['cancelled', 'failed', 'pending', 'succeeded'])
export const paymentCurrencySchema = z.enum(['RUB'])

export const paymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  type: paymentTypeSchema,
  provider: paymentProviderSchema,
  status: paymentStatusSchema,
  amountKopecks: moneyKopecks,
  currency: paymentCurrencySchema,
  providerPaymentId: z.string().nullable(),
  failureReason: z.string().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const paymentResponseSchema = z.object({
  payment: paymentSchema,
})

export const adminPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: paymentStatusSchema.optional(),
  type: paymentTypeSchema.optional(),
  orderId: z.string().trim().min(1).optional(),
})

const adminPaymentOrderStatusSchema = z.enum([
  'cancelled',
  'confirmed',
  'issued',
  'request',
  'returned',
])

export const adminPaymentSchema = paymentSchema.extend({
  order: z.object({
    id: z.string(),
    status: adminPaymentOrderStatusSchema,
    startsOn: z.string(),
    endsOn: z.string(),
    user: z.object({
      id: z.string(),
      email: z.string().email(),
      displayName: z.string().nullable(),
    }),
  }),
})

export const adminPaymentsResponseSchema = z.object({
  items: z.array(adminPaymentSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export type PaymentType = z.infer<typeof paymentTypeSchema>
export type PaymentProvider = z.infer<typeof paymentProviderSchema>
export type PaymentStatus = z.infer<typeof paymentStatusSchema>
export type PaymentDto = z.infer<typeof paymentSchema>
export type PaymentResponse = z.infer<typeof paymentResponseSchema>
export type AdminPaymentsQuery = z.infer<typeof adminPaymentsQuerySchema>
export type AdminPaymentDto = z.infer<typeof adminPaymentSchema>
export type AdminPaymentsResponse = z.infer<typeof adminPaymentsResponseSchema>
