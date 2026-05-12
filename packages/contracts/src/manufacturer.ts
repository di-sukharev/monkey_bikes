import { z } from 'zod'

import { userSchema } from './auth'

const nullableTrimmedString = z.preprocess((value) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}, z.string().min(1).max(500).nullable())

const requiredProfileString = z.string().trim().min(2).max(200)
const requiredProfileEmail = z.email().trim().toLowerCase().max(255)

export const manufacturerProfileStatusSchema = z.enum([
  'approved',
  'blocked',
  'draft',
  'moderation',
  'rejected',
])

export const manufacturerProfileUpsertRequestSchema = z.object({
  legalName: requiredProfileString,
  publicName: requiredProfileString,
  region: nullableTrimmedString,
  city: requiredProfileString,
  phone: z.string().trim().min(5).max(80),
  email: requiredProfileEmail,
  description: z.string().trim().min(10).max(2_000),
})

export const manufacturerProfileSchema = manufacturerProfileUpsertRequestSchema.extend({
  id: z.string(),
  userId: z.string(),
  status: manufacturerProfileStatusSchema,
  moderationComment: z.string().nullable(),
  submittedAt: z.string().datetime().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const manufacturerProfileGetResponseSchema = z.object({
  profile: manufacturerProfileSchema.nullable(),
})

export const manufacturerProfileResponseSchema = z.object({
  profile: manufacturerProfileSchema,
})

export const manufacturerProfileSubmitResponseSchema = manufacturerProfileResponseSchema

export const adminManufacturerProfileSchema = manufacturerProfileSchema.extend({
  user: userSchema,
})

export const adminManufacturersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: manufacturerProfileStatusSchema.optional(),
})

export const adminManufacturersResponseSchema = z.object({
  items: z.array(adminManufacturerProfileSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export const adminManufacturerStatusUpdateRequestSchema = z
  .object({
    status: z.enum(['approved', 'blocked', 'rejected']),
    moderationComment: nullableTrimmedString,
  })
  .refine(
    (value) =>
      value.status === 'approved' ||
      (value.moderationComment !== null && value.moderationComment.length > 0),
    {
      message: 'Moderation comment is required for rejected or blocked profiles',
      path: ['moderationComment'],
    },
  )

export type ManufacturerProfileStatus = z.infer<typeof manufacturerProfileStatusSchema>
export type ManufacturerProfileUpsertRequest = z.infer<
  typeof manufacturerProfileUpsertRequestSchema
>
export type ManufacturerProfileDto = z.infer<typeof manufacturerProfileSchema>
export type ManufacturerProfileGetResponse = z.infer<typeof manufacturerProfileGetResponseSchema>
export type ManufacturerProfileResponse = z.infer<typeof manufacturerProfileResponseSchema>
export type ManufacturerProfileSubmitResponse = z.infer<
  typeof manufacturerProfileSubmitResponseSchema
>
export type AdminManufacturerProfileDto = z.infer<typeof adminManufacturerProfileSchema>
export type AdminManufacturersQuery = z.infer<typeof adminManufacturersQuerySchema>
export type AdminManufacturersResponse = z.infer<typeof adminManufacturersResponseSchema>
export type AdminManufacturerStatusUpdateRequest = z.infer<
  typeof adminManufacturerStatusUpdateRequestSchema
>
