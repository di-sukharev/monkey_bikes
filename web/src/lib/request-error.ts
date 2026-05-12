import { ApiRequestError } from '@/lib/api'

export function formatRequestError(error: unknown) {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return 'Unexpected request error'
}
