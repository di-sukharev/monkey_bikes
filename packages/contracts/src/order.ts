import { z } from 'zod'

import { bicycleManufacturerSummarySchema, bicycleSizeSchema } from './bicycle'
import { dateOnlyStringSchema, rentalDaysInclusive } from './date'

const nullableTrimmedString = (maxLength: number) => z.preprocess((value) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}, z.string().min(1).max(maxLength).nullable())

const requiredOrderString = z.string().trim().min(2).max(200)
const contactPhoneString = z.string().trim().min(5).max(80)
const moneyKopecks = z.number().int().min(0).max(1_000_000_000)
export const maxOrderRentalDays = 366
export const maxOrderAmountKopecks = 1_000_000_000
const bicycleIdsSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .max(10)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Bicycle ids must be unique',
  })

export const orderStatusSchema = z.enum([
  'cancelled',
  'confirmed',
  'issued',
  'request',
  'returned',
])

export const fulfillmentTypeSchema = z.enum(['delivery', 'pickup'])

export const orderCreateRequestSchema = z
  .object({
    bicycleIds: bicycleIdsSchema,
    startsOn: dateOnlyStringSchema,
    endsOn: dateOnlyStringSchema,
    fulfillmentType: fulfillmentTypeSchema,
    deliveryAddress: nullableTrimmedString(500).optional().default(null),
    contactName: requiredOrderString,
    contactPhone: contactPhoneString,
    userComment: nullableTrimmedString(2_000).optional().default(null),
    safetyAgreementAccepted: z.literal(true),
  })
  .strict()
  .refine((value) => value.startsOn <= value.endsOn, {
    message: 'Start date must be before or equal to end date',
    path: ['startsOn'],
  })
  .refine((value) => {
    if (value.startsOn > value.endsOn) return true
    try {
      return rentalDaysInclusive(value.startsOn, value.endsOn) <= maxOrderRentalDays
    } catch {
      return true
    }
  }, {
    message: `Rental period must be ${maxOrderRentalDays} days or less`,
    path: ['endsOn'],
  })
  .refine(
    (value) => value.fulfillmentType !== 'delivery' || value.deliveryAddress !== null,
    {
      message: 'Delivery address is required for delivery',
      path: ['deliveryAddress'],
    },
  )
  .refine(
    (value) => value.fulfillmentType !== 'pickup' || value.deliveryAddress === null,
    {
      message: 'Delivery address is only allowed for delivery',
      path: ['deliveryAddress'],
    },
  )

export const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: orderStatusSchema.optional(),
})

export const orderBicycleSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  size: bicycleSizeSchema,
  city: z.string(),
  deliveryAvailable: z.boolean(),
  pickupAddress: z.string(),
  manufacturer: bicycleManufacturerSummarySchema,
})

export const orderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  bicycleId: z.string(),
  pricePerDaySnapshotKopecks: moneyKopecks,
  depositSnapshotKopecks: moneyKopecks,
  createdAt: z.string().datetime(),
  bicycle: orderBicycleSummarySchema,
})

export const orderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: orderStatusSchema,
  startsOn: dateOnlyStringSchema,
  endsOn: dateOnlyStringSchema,
  rentalDays: z.number().int().min(1),
  fulfillmentType: fulfillmentTypeSchema,
  deliveryAddress: z.string().nullable(),
  contactName: z.string(),
  contactPhone: z.string(),
  userComment: z.string().nullable(),
  adminComment: z.string().nullable(),
  rentalAmountKopecks: moneyKopecks,
  depositAmountKopecks: moneyKopecks,
  deliveryAmountKopecks: moneyKopecks,
  totalAmountKopecks: moneyKopecks,
  safetyAgreementAcceptedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(orderItemSchema).min(1),
})

export const orderResponseSchema = z.object({
  order: orderSchema,
})

export const ordersResponseSchema = z.object({
  items: z.array(orderSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type FulfillmentType = z.infer<typeof fulfillmentTypeSchema>
export type OrderCreateRequest = z.output<typeof orderCreateRequestSchema>
export type OrderCreateInput = z.input<typeof orderCreateRequestSchema>
export type OrdersQuery = z.infer<typeof ordersQuerySchema>
export type OrderDto = z.infer<typeof orderSchema>
export type OrderItemDto = z.infer<typeof orderItemSchema>
export type OrderResponse = z.infer<typeof orderResponseSchema>
export type OrdersResponse = z.infer<typeof ordersResponseSchema>
