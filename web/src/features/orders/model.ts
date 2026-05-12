import type { FulfillmentType, OrderDto, OrderStatus, PublicBicycleDto } from '@web-app-demo/contracts'

export const orderStatuses: OrderStatus[] = [
  'request',
  'confirmed',
  'issued',
  'returned',
  'cancelled',
]

export const fulfillmentTypes: FulfillmentType[] = ['pickup', 'delivery']

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

export function ordersQueryKey(userId: string | null | undefined, page: number, status: OrderStatus | 'all') {
  return ['orders', userId ?? null, page, status] as const
}

export function orderDetailQueryKey(userId: string | null | undefined, id: string) {
  return ['orders', userId ?? null, id] as const
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

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
