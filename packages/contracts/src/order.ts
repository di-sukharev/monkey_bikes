import { z } from 'zod'

import {
  bicycleManufacturerSummarySchema,
  bicycleSizeSchema,
  bicycleStatusSchema,
} from './bicycle'
import { userSchema, userStatusSchema } from './auth'
import { dateOnlyStringSchema, rentalDaysInclusive } from './date'
import { manufacturerProfileStatusSchema } from './manufacturer'
import { paymentSchema } from './payment'

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

export const orderListScopeSchema = z.enum(['all', 'current', 'history'])

const currentOrderStatuses = ['request', 'confirmed', 'issued'] as const
const historyOrderStatuses = ['cancelled', 'returned'] as const
const allOrderStatuses = ['request', 'confirmed', 'issued', 'returned', 'cancelled'] as const

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
  scope: orderListScopeSchema.default('all'),
}).refine(
  (value) =>
    value.scope === 'all' ||
    value.status === undefined ||
    orderStatusesForScope(value.scope).includes(value.status),
  {
    message: 'Status must belong to the selected order scope',
    path: ['status'],
  },
)

export const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: orderStatusSchema.optional(),
}).strict()

export const orderCancelRequestSchema = z
  .object({
    comment: nullableTrimmedString(1_000).optional().default(null),
  })
  .strict()

export const orderChecklistTypeSchema = z.enum(['issue', 'return'])
export const orderChecklistConditionSchema = z.enum([
  'damaged',
  'not_applicable',
  'ok',
  'unsafe',
  'worn',
])
export const orderChecklistBicycleActionSchema = z.enum(['hidden', 'maintenance', 'none'])

export const adminOrderChecklistInputSchema = z
  .object({
    bicycleId: z.string().trim().min(1),
    frameCondition: orderChecklistConditionSchema,
    wheelsCondition: orderChecklistConditionSchema,
    handlebarCondition: orderChecklistConditionSchema,
    saddleCondition: orderChecklistConditionSchema,
    brakesCondition: orderChecklistConditionSchema,
    exteriorCondition: orderChecklistConditionSchema,
    safetyAction: orderChecklistBicycleActionSchema.optional().default('none'),
    comment: nullableTrimmedString(2_000).optional().default(null),
  })
  .strict()

export const adminOrderStatusUpdateRequestSchema = z
  .object({
    status: z.enum(['cancelled', 'confirmed', 'issued', 'returned']),
    comment: nullableTrimmedString(1_000).optional().default(null),
    checklists: z.array(adminOrderChecklistInputSchema).optional().default([]),
  })
  .strict()
  .refine(
    (value) =>
      value.status !== 'cancelled' ||
      (value.comment !== null && value.comment.length > 0),
    {
      message: 'Comment is required when cancelling an order',
      path: ['comment'],
    },
  )
  .refine(
    (value) =>
      (value.status !== 'issued' && value.status !== 'returned') ||
      value.checklists.length > 0,
    {
      message: 'Checklists are required for this order transition',
      path: ['checklists'],
    },
  )
  .superRefine((value, context) => {
    if (value.status !== 'issued' && value.status !== 'returned' && value.checklists.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Checklists are only accepted for issue and return transitions',
        path: ['checklists'],
      })
    }

    if (value.status === 'issued') {
      value.checklists.forEach((checklist, index) => {
        if (checklist.safetyAction !== 'none') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Issue checklists cannot change bicycle catalog status',
            path: ['checklists', index, 'safetyAction'],
          })
        }
      })
    }
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
  rentalAmountKopecks: moneyKopecks,
  depositAmountKopecks: moneyKopecks,
  deliveryAmountKopecks: moneyKopecks,
  totalAmountKopecks: moneyKopecks,
  safetyAgreementAcceptedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(orderItemSchema).min(1),
  payments: z.array(paymentSchema),
  paymentRequirementsMet: z.boolean(),
})

export const orderUserSummarySchema = userSchema.pick({
  id: true,
  email: true,
  displayName: true,
}).extend({
  status: userStatusSchema,
})

export const orderStatusHistorySchema = z.object({
  id: z.string(),
  orderId: z.string(),
  fromStatus: orderStatusSchema,
  toStatus: orderStatusSchema,
  changedByUserId: z.string(),
  changedByUser: orderUserSummarySchema,
  comment: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export const orderChecklistSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  bicycleId: z.string(),
  type: orderChecklistTypeSchema,
  frameCondition: orderChecklistConditionSchema,
  wheelsCondition: orderChecklistConditionSchema,
  handlebarCondition: orderChecklistConditionSchema,
  saddleCondition: orderChecklistConditionSchema,
  brakesCondition: orderChecklistConditionSchema,
  exteriorCondition: orderChecklistConditionSchema,
  safetyAction: orderChecklistBicycleActionSchema,
  comment: z.string().nullable(),
  checkedByUserId: z.string(),
  checkedByUser: orderUserSummarySchema,
  checkedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const adminOrderLiveBicycleSchema = z.object({
  id: z.string(),
  status: bicycleStatusSchema,
  deliveryAvailable: z.boolean(),
  manufacturerStatus: manufacturerProfileStatusSchema,
  maxLoadKg: z.number().int().min(1),
  seatHeightCm: z.number().int().min(1),
  frameLengthCm: z.number().int().min(1),
  wheelDiameterCm: z.number().int().min(1),
  recommendedAnimalDimensions: z.string(),
  safetyNotes: z.string(),
})

export const adminOrderItemSchema = orderItemSchema.extend({
  liveBicycle: adminOrderLiveBicycleSchema,
})

export const adminOrderWarningSchema = z.object({
  type: z.enum([
    'availability_conflict',
    'bicycle_status',
    'delivery_unavailable',
    'manufacturer_status',
    'technical_limits',
  ]),
  severity: z.enum(['error', 'info', 'warning']),
  bicycleId: z.string().nullable(),
  bicycleTitle: z.string().nullable(),
  message: z.string(),
  conflictingOrderId: z.string().nullable().optional(),
})

export const adminOrderSchema = orderSchema.extend({
  adminComment: z.string().nullable(),
  user: orderUserSummarySchema,
  items: z.array(adminOrderItemSchema).min(1),
  statusHistory: z.array(orderStatusHistorySchema),
  checklists: z.array(orderChecklistSchema),
  availabilityWarnings: z.array(adminOrderWarningSchema),
})

export const manufacturerOrderChecklistSchema = orderChecklistSchema.omit({
  checkedByUserId: true,
  checkedByUser: true,
})

export const manufacturerOrderFulfillmentContactSchema = z.object({
  contactName: z.string(),
  contactPhone: z.string(),
  deliveryAddress: z.string().nullable(),
  userComment: z.string().nullable(),
})

export const manufacturerOrderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  startsOn: dateOnlyStringSchema,
  endsOn: dateOnlyStringSchema,
  rentalDays: z.number().int().min(1),
  fulfillmentType: fulfillmentTypeSchema,
  fulfillmentContact: manufacturerOrderFulfillmentContactSchema.nullable(),
  manufacturerRentalAmountKopecks: moneyKopecks,
  manufacturerDepositAmountKopecks: moneyKopecks,
  manufacturerTotalAmountKopecks: moneyKopecks,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(orderItemSchema).min(1),
  checklists: z.array(manufacturerOrderChecklistSchema),
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

export const adminOrderResponseSchema = z.object({
  order: adminOrderSchema,
})

export const adminOrdersResponseSchema = z.object({
  items: z.array(adminOrderSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export const manufacturerOrdersQuerySchema = ordersQuerySchema

export const manufacturerOrderResponseSchema = z.object({
  order: manufacturerOrderSchema,
})

export const manufacturerOrdersResponseSchema = z.object({
  items: z.array(manufacturerOrderSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type OrderListScope = z.infer<typeof orderListScopeSchema>
export type FulfillmentType = z.infer<typeof fulfillmentTypeSchema>
export type OrderCreateRequest = z.output<typeof orderCreateRequestSchema>
export type OrderCreateInput = z.input<typeof orderCreateRequestSchema>
export type OrdersQuery = z.infer<typeof ordersQuerySchema>
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>
export type ManufacturerOrdersQuery = z.infer<typeof manufacturerOrdersQuerySchema>
export type OrderCancelRequest = z.output<typeof orderCancelRequestSchema>
export type OrderCancelInput = z.input<typeof orderCancelRequestSchema>
export type AdminOrderStatusUpdateRequest = z.output<
  typeof adminOrderStatusUpdateRequestSchema
>
export type AdminOrderStatusUpdateInput = z.input<
  typeof adminOrderStatusUpdateRequestSchema
>
export type OrderDto = z.infer<typeof orderSchema>
export type OrderItemDto = z.infer<typeof orderItemSchema>
export type OrderStatusHistoryDto = z.infer<typeof orderStatusHistorySchema>
export type OrderChecklistType = z.infer<typeof orderChecklistTypeSchema>
export type OrderChecklistCondition = z.infer<typeof orderChecklistConditionSchema>
export type OrderChecklistBicycleAction = z.infer<typeof orderChecklistBicycleActionSchema>
export type AdminOrderChecklistInput = z.output<typeof adminOrderChecklistInputSchema>
export type OrderChecklistDto = z.infer<typeof orderChecklistSchema>
export type ManufacturerOrderChecklistDto = z.infer<typeof manufacturerOrderChecklistSchema>
export type AdminOrderWarningDto = z.infer<typeof adminOrderWarningSchema>
export type AdminOrderDto = z.infer<typeof adminOrderSchema>
export type ManufacturerOrderDto = z.infer<typeof manufacturerOrderSchema>
export type OrderResponse = z.infer<typeof orderResponseSchema>
export type OrdersResponse = z.infer<typeof ordersResponseSchema>
export type AdminOrderResponse = z.infer<typeof adminOrderResponseSchema>
export type AdminOrdersResponse = z.infer<typeof adminOrdersResponseSchema>
export type ManufacturerOrderResponse = z.infer<typeof manufacturerOrderResponseSchema>
export type ManufacturerOrdersResponse = z.infer<typeof manufacturerOrdersResponseSchema>

export function orderStatusesForScope(scope: OrderListScope): OrderStatus[] {
  if (scope === 'current') return [...currentOrderStatuses]
  if (scope === 'history') return [...historyOrderStatuses]
  return [...allOrderStatuses]
}
