import { z } from 'zod'

import { userRoleSchema, userSchema, userStatusSchema } from './auth'

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
})

export const adminUsersResponseSchema = z.object({
  items: z.array(userSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export const adminUserResponseSchema = z.object({
  user: userSchema,
})

export const adminUpdateUserRequestSchema = z
  .object({
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: 'At least one field must be provided',
  })

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>
export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>
export type AdminUpdateUserRequest = z.infer<typeof adminUpdateUserRequestSchema>
