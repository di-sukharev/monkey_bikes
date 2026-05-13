import { describe, expect, test } from 'bun:test'
import type { ManufacturerOrderDto } from '@web-app-demo/contracts'

import { ApiRequestError } from '../src/lib/api'
import {
  manufacturerOrderNextStep,
  orderNextStep,
  orderStatusesForListScope,
  requestErrorNextStep,
} from '../src/features/orders/model'

describe('customer order UI rules', () => {
  test('groups order statuses into current and history scopes', () => {
    expect(orderStatusesForListScope('current')).toEqual(['request', 'confirmed', 'issued'])
    expect(orderStatusesForListScope('history')).toEqual(['cancelled', 'returned'])
    expect(orderStatusesForListScope('all')).toEqual([
      'request',
      'confirmed',
      'issued',
      'returned',
      'cancelled',
    ])
  })

  test('returns customer next steps from order status and payment readiness', () => {
    expect(orderNextStep(orderFixture('request'))).toContain('Waiting for administrator')
    expect(orderNextStep(orderFixture('confirmed'))).toContain('Complete rent and deposit')
    expect(orderNextStep(orderFixture('confirmed', true))).toContain('Payments are complete')
    expect(orderNextStep(orderFixture('issued'))).toContain('Coordinate return')
    expect(orderNextStep(orderFixture('returned'))).toContain('No further action')
    expect(orderNextStep(orderFixture('cancelled'))).toContain('Create a new request')
  })

  test('returns manufacturer next steps without requiring customer-only fields', () => {
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('request'))).toContain('waiting')
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('confirmed'))).toContain('Prepare')
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('issued'))).toContain('Coordinate return')
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('returned'))).toContain('checklist history')
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('cancelled'))).toContain('No producer action')
  })

  test('maps domain errors to customer next steps', () => {
    expect(requestErrorNextStep(apiError(409, 'ORDER_NOT_CANCELLABLE'))).toContain('Contact the administrator')
    expect(requestErrorNextStep(apiError(409, 'PAYMENT_NOT_ALLOWED'))).toContain('after administrator confirmation')
    expect(requestErrorNextStep(apiError(409, 'PAYMENT_NOT_COMPLETABLE'))).toContain('Create a new attempt')
    expect(requestErrorNextStep(apiError(503, 'PAYMENT_PROVIDER_DISABLED'))).toContain('disabled')
    expect(requestErrorNextStep(new Error('Network failed'))).toContain('Refresh')
  })
})

function apiError(status: number, code: string) {
  return new ApiRequestError(status, code, code)
}

function orderFixture(
  status: 'cancelled' | 'confirmed' | 'issued' | 'request' | 'returned',
  paymentRequirementsMet = false,
) {
  return {
    id: 'order_1',
    userId: 'user_1',
    status,
    startsOn: '2026-05-12',
    endsOn: '2026-05-13',
    rentalDays: 2,
    fulfillmentType: 'pickup',
    deliveryAddress: null,
    contactName: 'Trainer',
    contactPhone: '+7 999 111-22-33',
    userComment: null,
    rentalAmountKopecks: 500000,
    depositAmountKopecks: 500000,
    deliveryAmountKopecks: 0,
    totalAmountKopecks: 1000000,
    safetyAgreementAcceptedAt: '2026-05-12T10:00:00.000Z',
    createdAt: '2026-05-12T10:00:00.000Z',
    updatedAt: '2026-05-12T10:00:00.000Z',
    payments: [],
    paymentRequirementsMet,
    items: [
      {
        id: 'item_1',
        orderId: 'order_1',
        bicycleId: 'bike_1',
        pricePerDaySnapshotKopecks: 250000,
        depositSnapshotKopecks: 500000,
        createdAt: '2026-05-12T10:00:00.000Z',
        bicycle: {
          id: 'bike_1',
          title: 'Tiny Performer S',
          size: 'S',
          city: 'Moscow',
          deliveryAvailable: true,
          pickupAddress: 'Main storage, door 2',
          manufacturer: {
            id: 'manufacturer_1',
            publicName: 'Tiny Bikes',
            city: 'Moscow',
            region: null,
          },
        },
      },
    ],
  }
}

function manufacturerOrderFixture(
  status: 'cancelled' | 'confirmed' | 'issued' | 'request' | 'returned',
): ManufacturerOrderDto {
  return {
    id: 'order_1',
    status,
    startsOn: '2026-05-12',
    endsOn: '2026-05-13',
    rentalDays: 2,
    fulfillmentType: 'pickup',
    fulfillmentContact: status === 'confirmed' || status === 'issued'
      ? {
          contactName: 'Trainer',
          contactPhone: '+7 999 111-22-33',
          deliveryAddress: null,
          userComment: null,
        }
      : null,
    manufacturerRentalAmountKopecks: 500000,
    manufacturerDepositAmountKopecks: 500000,
    manufacturerTotalAmountKopecks: 1000000,
    createdAt: '2026-05-12T10:00:00.000Z',
    updatedAt: '2026-05-12T10:00:00.000Z',
    items: orderFixture(status).items,
    checklists: [],
  }
}
