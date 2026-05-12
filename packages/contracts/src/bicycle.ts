import { z } from 'zod'

import { manufacturerProfileStatusSchema } from './manufacturer'

const nullableTrimmedString = z.preprocess((value) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}, z.string().min(1).max(500).nullable())

const requiredBicycleString = z.string().trim().min(2).max(200)
const longBicycleString = z.string().trim().min(10).max(2_000)
const moneyKopecks = z.coerce.number().int().min(0).max(100_000_000)
const positiveCentimeters = z.coerce.number().int().min(1).max(1_000)
const positiveKilograms = z.coerce.number().int().min(1).max(1_000)
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/
const dateOnlyString = z.string()
  .regex(dateOnlyPattern, 'Expected YYYY-MM-DD')
  .refine(isValidDateOnly, 'Expected a valid calendar date')

export const bicycleSizeSchema = z.enum(['S', 'M', 'L'])

export const bicycleStatusSchema = z.enum([
  'archived',
  'available',
  'draft',
  'hidden',
  'maintenance',
  'moderation',
  'rejected',
  'rented',
  'reserved',
])

const bicyclePhotoUrlsSchema = z
  .array(z.string().trim().url().max(500))
  .max(6)
  .default([])

const sizeListSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined
  if (Array.isArray(value)) return value.flatMap((item) => String(item).split(','))
  if (typeof value === 'string') return value.split(',')
  return value
}, z.array(bicycleSizeSchema).min(1).max(3).optional())

export const bicycleUpsertRequestSchema = z.object({
  title: requiredBicycleString,
  description: longBicycleString,
  size: bicycleSizeSchema,
  photoUrls: bicyclePhotoUrlsSchema,
  pricePerDayKopecks: moneyKopecks.min(100),
  depositKopecks: moneyKopecks,
  region: nullableTrimmedString,
  city: requiredBicycleString,
  pickupAddress: z.string().trim().min(5).max(500),
  deliveryAvailable: z.boolean(),
  maxLoadKg: positiveKilograms,
  seatHeightCm: positiveCentimeters,
  frameLengthCm: positiveCentimeters,
  wheelDiameterCm: positiveCentimeters,
  recommendedAnimalDimensions: z.string().trim().min(2).max(500),
  safetyNotes: longBicycleString,
}).strict()

export const bicycleManufacturerSummarySchema = z.object({
  id: z.string(),
  publicName: z.string(),
  city: z.string(),
  region: z.string().nullable(),
})

export const adminBicycleManufacturerSummarySchema = bicycleManufacturerSummarySchema.extend({
  status: manufacturerProfileStatusSchema,
})

export const bicycleSchema = bicycleUpsertRequestSchema.extend({
  id: z.string(),
  manufacturerProfileId: z.string(),
  status: bicycleStatusSchema,
  moderationComment: z.string().nullable(),
  submittedAt: z.string().datetime().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const publicBicycleSchema = bicycleSchema
  .omit({
    manufacturerProfileId: true,
    moderationComment: true,
    submittedAt: true,
    reviewedAt: true,
  })
  .extend({
    status: z.literal('available'),
    manufacturer: bicycleManufacturerSummarySchema,
  })

export const adminBicycleSchema = bicycleSchema.extend({
  manufacturer: adminBicycleManufacturerSummarySchema,
})

export const manufacturerBicyclesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: bicycleStatusSchema.optional(),
})

export const adminBicyclesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: bicycleStatusSchema.optional(),
  size: bicycleSizeSchema.optional(),
})

export const publicBicyclesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sizes: sizeListSchema,
    minPriceKopecks: moneyKopecks.optional(),
    maxPriceKopecks: moneyKopecks.optional(),
    city: nullableTrimmedString.optional(),
    startsOn: dateOnlyString.optional(),
    endsOn: dateOnlyString.optional(),
  })
  .refine(
    (value) =>
      value.minPriceKopecks === undefined ||
      value.maxPriceKopecks === undefined ||
      value.minPriceKopecks <= value.maxPriceKopecks,
    {
      message: 'Minimum price must be less than or equal to maximum price',
      path: ['minPriceKopecks'],
    },
  )
  .refine(
    (value) =>
      (value.startsOn === undefined && value.endsOn === undefined) ||
      (value.startsOn !== undefined && value.endsOn !== undefined && value.startsOn <= value.endsOn),
    {
      message: 'Both start and end dates are required and start must be before or equal to end',
      path: ['startsOn'],
    },
  )

export const bicycleResponseSchema = z.object({
  bicycle: bicycleSchema,
})

export const publicBicycleResponseSchema = z.object({
  bicycle: publicBicycleSchema,
})

export const manufacturerBicyclesResponseSchema = z.object({
  items: z.array(bicycleSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export const publicBicyclesResponseSchema = z.object({
  items: z.array(publicBicycleSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export const adminBicyclesResponseSchema = z.object({
  items: z.array(adminBicycleSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export const adminBicycleResponseSchema = z.object({
  bicycle: adminBicycleSchema,
})

export const adminBicycleModerationRequestSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    moderationComment: nullableTrimmedString.optional().default(null),
  })
  .refine(
    (value) =>
      value.decision === 'approved' ||
      (value.moderationComment !== null && value.moderationComment.length > 0),
    {
      message: 'Moderation comment is required for rejected bicycles',
      path: ['moderationComment'],
    },
  )

export const adminBicycleStatusUpdateRequestSchema = z.object({
  status: z.enum(['available', 'hidden', 'maintenance', 'archived']),
})

export type BicycleSize = z.infer<typeof bicycleSizeSchema>
export type BicycleStatus = z.infer<typeof bicycleStatusSchema>
export type BicycleUpsertRequest = z.output<typeof bicycleUpsertRequestSchema>
export type BicycleUpsertInput = z.input<typeof bicycleUpsertRequestSchema>
export type BicycleDto = z.infer<typeof bicycleSchema>
export type PublicBicycleDto = z.infer<typeof publicBicycleSchema>
export type AdminBicycleDto = z.infer<typeof adminBicycleSchema>
export type ManufacturerBicyclesQuery = z.infer<typeof manufacturerBicyclesQuerySchema>
export type AdminBicyclesQuery = z.infer<typeof adminBicyclesQuerySchema>
export type PublicBicyclesQuery = z.infer<typeof publicBicyclesQuerySchema>
export type BicycleResponse = z.infer<typeof bicycleResponseSchema>
export type PublicBicycleResponse = z.infer<typeof publicBicycleResponseSchema>
export type ManufacturerBicyclesResponse = z.infer<typeof manufacturerBicyclesResponseSchema>
export type PublicBicyclesResponse = z.infer<typeof publicBicyclesResponseSchema>
export type AdminBicyclesResponse = z.infer<typeof adminBicyclesResponseSchema>
export type AdminBicycleResponse = z.infer<typeof adminBicycleResponseSchema>
export type AdminBicycleModerationRequest = z.input<
  typeof adminBicycleModerationRequestSchema
>
export type AdminBicycleModerationPayload = z.output<
  typeof adminBicycleModerationRequestSchema
>
export type AdminBicycleStatusUpdateRequest = z.infer<
  typeof adminBicycleStatusUpdateRequestSchema
>

function isValidDateOnly(value: string) {
  const match = dateOnlyPattern.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}
