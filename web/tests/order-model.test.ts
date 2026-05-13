import { describe, expect, test } from 'bun:test'
import type { ManufacturerOrderDto } from '@web-app-demo/contracts'

import { ApiRequestError } from '../src/lib/api'
import {
  formatAdminOrderWarning,
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
    expect(orderNextStep(orderFixture('request'))).toContain('Ожидается подтверждение администратора')
    expect(orderNextStep(orderFixture('confirmed'))).toContain('Оплатите аренду и залог')
    expect(orderNextStep(orderFixture('confirmed', true))).toContain('Платежи завершены')
    expect(orderNextStep(orderFixture('issued'))).toContain('Согласуйте возврат')
    expect(orderNextStep(orderFixture('returned'))).toContain('Дополнительные действия не нужны')
    expect(orderNextStep(orderFixture('cancelled'))).toContain('создайте заявку из каталога')
  })

  test('returns manufacturer next steps without requiring customer-only fields', () => {
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('request'))).toContain('ожидает подтверждения')
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('confirmed'))).toContain('Подготовьте')
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('issued'))).toContain('Подготовьте возврат')
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('returned'))).toContain('историю чеклистов')
    expect(manufacturerOrderNextStep(manufacturerOrderFixture('cancelled'))).toContain('действий не требуется')
  })

  test('maps domain errors to customer next steps', () => {
    expect(requestErrorNextStep(apiError(409, 'ORDER_NOT_CANCELLABLE'))).toContain('свяжитесь с администратором')
    expect(requestErrorNextStep(apiError(409, 'PAYMENT_NOT_ALLOWED'))).toContain('после подтверждения администратором')
    expect(requestErrorNextStep(apiError(409, 'PAYMENT_NOT_COMPLETABLE'))).toContain('Создайте новую попытку')
    expect(requestErrorNextStep(apiError(503, 'PAYMENT_PROVIDER_DISABLED'))).toContain('отключена')
    expect(requestErrorNextStep(new Error('Network failed'))).toContain('Обновите страницу')
  })

  test('preserves admin warning details while translating operational copy', () => {
    expect(
      formatAdminOrderWarning({
        type: 'availability_conflict',
        severity: 'error',
        bicycleId: 'bike_1',
        bicycleTitle: 'Tiny Performer S',
        conflictingOrderId: 'order_2',
        message: 'Tiny Performer S conflicts with order order_2 (2026-05-12 - 2026-05-13).',
      }),
    ).toBe('Tiny Performer S конфликтует с заказом order_2 (2026-05-12 - 2026-05-13).')

    expect(
      formatAdminOrderWarning({
        type: 'bicycle_status',
        severity: 'error',
        bicycleId: 'bike_1',
        bicycleTitle: 'Tiny Performer S',
        conflictingOrderId: null,
        message: 'Tiny Performer S is currently maintenance; expected available.',
      }),
    ).toBe('Tiny Performer S сейчас в статусе «на обслуживании», ожидается «доступен».')
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
