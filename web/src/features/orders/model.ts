import type {
  ApiErrorCode,
  FulfillmentType,
  OrderDto,
  OrderListScope,
  OrderStatus,
  PublicBicycleDto,
} from '@web-app-demo/contracts'
import { orderListScopeSchema, orderStatusesForScope } from '@web-app-demo/contracts'

import { ApiRequestError } from '@/lib/api'

export const orderStatuses: OrderStatus[] = orderStatusesForScope('all')

export const fulfillmentTypes: FulfillmentType[] = ['pickup', 'delivery']
export const orderListScopes: OrderListScope[] = orderListScopeSchema.options

export type OrderFormValues = {
  bicycleIds: string[]
  startsOn: string
  endsOn: string
  fulfillmentType: FulfillmentType
  deliveryAddress: string | null
  contactName: string
  contactPhone: string
  userComment: string | null
  safetyAgreementAccepted: boolean
}

export function emptyOrderForm(bicycleIds: string[]): OrderFormValues {
  return {
    bicycleIds,
    startsOn: '',
    endsOn: '',
    fulfillmentType: 'pickup',
    deliveryAddress: null,
    contactName: '',
    contactPhone: '',
    userComment: null,
    safetyAgreementAccepted: false,
  }
}

export function formatMoney(kopecks: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(kopecks / 100)
}

export function formatOrderDates(order: OrderDto) {
  return order.startsOn === order.endsOn
    ? order.startsOn
    : `${order.startsOn} - ${order.endsOn}`
}

export function selectedBicyclesTotal(bicycles: PublicBicycleDto[]) {
  return {
    daily: bicycles.reduce((total, bicycle) => total + bicycle.pricePerDayKopecks, 0),
    deposit: bicycles.reduce((total, bicycle) => total + bicycle.depositKopecks, 0),
  }
}

export function ordersQueryKey(
  userId: string | null | undefined,
  page: number,
  scope: OrderListScope,
  status: OrderStatus | 'all',
) {
  return ['orders', userId ?? null, page, scope, status] as const
}

export function orderDetailQueryKey(userId: string | null | undefined, id: string) {
  return ['orders', userId ?? null, id] as const
}

export function orderAdminListQueryKey(page: number, status: OrderStatus | 'all') {
  return ['admin', 'orders', page, status] as const
}

export function orderAdminDetailQueryKey(id: string) {
  return ['admin', 'orders', id] as const
}

export function parseBicycleIds(value: unknown) {
  if (Array.isArray(value)) {
    return uniqueIds(value.flatMap((item) => String(item).split(',')))
  }

  if (typeof value === 'string') {
    return uniqueIds(value.split(','))
  }

  return []
}

export function orderStatusesForListScope(scope: OrderListScope) {
  return orderStatusesForScope(scope)
}

export function orderListScopeLabel(scope: OrderListScope) {
  switch (scope) {
    case 'all':
      return 'All'
    case 'current':
      return 'Current'
    case 'history':
      return 'History'
  }
}

export function orderNextStep(order: OrderDto) {
  switch (order.status) {
    case 'request':
      return 'Waiting for administrator confirmation. You can cancel the request until it is confirmed.'
    case 'confirmed':
      return order.paymentRequirementsMet
        ? 'Payments are complete. Wait for the administrator to issue the order.'
        : 'Complete rent and deposit payments to make the order ready for issue.'
    case 'issued':
      return 'The bicycle has been issued. Coordinate return with the administrator at the agreed location.'
    case 'returned':
      return 'The order is returned. No further action is required.'
    case 'cancelled':
      return 'The order is cancelled. Create a new request from the catalog if you need another rental.'
  }
}

export function requestErrorNextStep(error: unknown) {
  const code = error instanceof ApiRequestError ? error.code as ApiErrorCode : null

  switch (code) {
    case 'UNAUTHORIZED':
      return 'Sign in again and retry the action.'
    case 'FORBIDDEN':
      return 'Use a customer account for this action.'
    case 'NOT_FOUND':
    case 'PAYMENT_NOT_FOUND':
      return 'Open your orders list and refresh the order details.'
    case 'ORDER_NOT_CANCELLABLE':
      return 'The order is already confirmed or later. Contact the administrator if plans changed.'
    case 'PAYMENT_NOT_ALLOWED':
      return 'Payments become available after administrator confirmation.'
    case 'PAYMENT_NOT_COMPLETABLE':
      return 'This payment attempt is closed. Create a new attempt when retry is available.'
    case 'PAYMENT_PROVIDER_DISABLED':
      return 'Payment processing is disabled in this environment. Contact the administrator.'
    case 'PAYMENT_DEV_ENDPOINTS_DISABLED':
      return 'Payment completion is disabled in this environment. Wait for administrator assistance.'
    case 'PAYMENT_ACTIVE_ATTEMPT_EXISTS':
      return 'Continue or finish the active payment attempt before creating another one.'
    case 'VALIDATION_ERROR':
      return 'Review the entered data and retry.'
    default:
      return 'Refresh the page and retry. If the problem remains, contact the administrator.'
  }
}

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
