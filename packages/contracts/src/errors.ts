import { z } from 'zod'

export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'ORDER_AVAILABILITY_CONFLICT',
  'ORDER_NOT_CANCELLABLE',
  'ORDER_STATUS_TRANSITION_NOT_ALLOWED',
  'BICYCLE_NOT_AVAILABLE',
  'PAYMENT_ACTIVE_ATTEMPT_EXISTS',
  'PAYMENT_DEV_ENDPOINTS_DISABLED',
  'PAYMENT_NOT_ALLOWED',
  'PAYMENT_NOT_COMPLETABLE',
  'PAYMENT_NOT_FOUND',
  'PAYMENT_PROVIDER_DISABLED',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
])

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
