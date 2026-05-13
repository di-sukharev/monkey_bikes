import {
  adminOrderStatusUpdateRequestSchema,
  orderCreateRequestSchema,
} from '@web-app-demo/contracts'
import { expect, test } from 'bun:test'

import { formatFormError } from '../src/lib/form-errors'

const validOrderRequest = {
  bicycleIds: ['bike_1'],
  startsOn: '2026-01-01',
  endsOn: '2026-01-02',
  fulfillmentType: 'pickup',
  deliveryAddress: null,
  contactName: 'Customer Name',
  contactPhone: '+79990000000',
  userComment: null,
  safetyAgreementAccepted: true,
}

test('formatFormError keeps contract refinement messages for custom Zod issues', () => {
  const result = orderCreateRequestSchema.safeParse({
    ...validOrderRequest,
    fulfillmentType: 'delivery',
  })

  expect(result.success).toBe(false)
  expect(formatFormError(result.error.issues[0])).toBe('Укажите адрес доставки.')
})

test('formatFormError translates dynamic contract refinement messages', () => {
  const result = orderCreateRequestSchema.safeParse({
    ...validOrderRequest,
    endsOn: '2027-01-02',
  })

  expect(result.success).toBe(false)
  expect(formatFormError(result.error.issues[0])).toBe('Срок аренды должен быть не больше 366 дней.')
})

test('formatFormError keeps generic text for standard Zod code failures', () => {
  expect(
    formatFormError({
      code: 'too_small',
      message: 'Too small: expected string to have >=2 characters',
    }),
  ).toBe('Значение слишком короткое или маленькое')
})

test('formatFormError translates order transition refinement messages', () => {
  const result = adminOrderStatusUpdateRequestSchema.safeParse({
    status: 'cancelled',
  })

  expect(result.success).toBe(false)
  expect(formatFormError(result.error.issues[0])).toBe('Укажите комментарий для отмены заявки.')
})
