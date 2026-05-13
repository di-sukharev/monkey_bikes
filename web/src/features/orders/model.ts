import type {
  AdminOrderQuickFilter,
  AdminOrderWarningDto,
  ApiErrorCode,
  FulfillmentType,
  ManufacturerOrderDto,
  OrderDto,
  OrderListScope,
  OrderStatus,
  PublicBicycleDto,
} from '@web-app-demo/contracts'
import { orderListScopeSchema, orderStatusesForScope } from '@web-app-demo/contracts'

import { ApiRequestError } from '@/lib/api'
import { bicycleStatusLabel } from '../bicycles/model'
import { manufacturerStatusLabel } from '../manufacturers/model'

export const orderStatuses: OrderStatus[] = orderStatusesForScope('all')
export const adminOrderQuickFilters: AdminOrderQuickFilter[] = [
  'unconfirmed_requests',
  'orders_today',
  'unpaid_deposit',
  'cancelled_orders',
]

export const fulfillmentTypes: FulfillmentType[] = ['pickup', 'delivery']
export const orderListScopes: OrderListScope[] = orderListScopeSchema.options
export type AdminOrderQuickFilterOption = AdminOrderQuickFilter | 'none'

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

export function formatOrderDates(order: Pick<OrderDto, 'endsOn' | 'startsOn'>) {
  return order.startsOn === order.endsOn
    ? order.startsOn
    : `${order.startsOn} - ${order.endsOn}`
}

export function fulfillmentTypeLabel(type: FulfillmentType) {
  switch (type) {
    case 'delivery':
      return 'Доставка'
    case 'pickup':
      return 'Самовывоз'
  }
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

export function orderAdminListQueryKey(
  page: number,
  status: OrderStatus | 'all',
  quickFilter: AdminOrderQuickFilterOption,
  date: string,
) {
  return ['admin', 'orders', page, status, quickFilter, date] as const
}

export function orderAdminDetailQueryKey(id: string) {
  return ['admin', 'orders', id] as const
}

export function manufacturerOrdersQueryKey(
  userId: string | null | undefined,
  page: number,
  scope: OrderListScope,
  status: OrderStatus | 'all',
) {
  return ['manufacturer', 'orders', userId ?? null, page, scope, status] as const
}

export function manufacturerOrderDetailQueryKey(userId: string | null | undefined, id: string) {
  return ['manufacturer', 'orders', userId ?? null, id] as const
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
      return 'Все'
    case 'current':
      return 'Текущие'
    case 'history':
      return 'История'
  }
}

export function adminOrderQuickFilterLabel(filter: AdminOrderQuickFilterOption) {
  switch (filter) {
    case 'none':
      return 'Ручной статус'
    case 'unconfirmed_requests':
      return 'Неподтвержденные заявки'
    case 'orders_today':
      return 'Заявки на сегодня'
    case 'unpaid_deposit':
      return 'Неоплаченный залог'
    case 'cancelled_orders':
      return 'Отмененные заявки'
  }
}

export function orderStatusLabel(status: OrderStatus | 'all') {
  switch (status) {
    case 'all':
      return 'Все статусы'
    case 'cancelled':
      return 'Отменена'
    case 'confirmed':
      return 'Подтверждена'
    case 'issued':
      return 'Выдана'
    case 'request':
      return 'Заявка'
    case 'returned':
      return 'Возвращена'
  }
}

export function parseAdminOrderStatusFilter(value: unknown): OrderStatus | 'all' {
  if (value === 'all') return 'all'
  return orderStatuses.includes(value as OrderStatus) ? value as OrderStatus : 'request'
}

export function parseAdminOrderQuickFilter(value: unknown): AdminOrderQuickFilterOption {
  return adminOrderQuickFilters.includes(value as AdminOrderQuickFilter)
    ? value as AdminOrderQuickFilter
    : 'none'
}

export function parseDateOnlySearch(value: unknown, fallback = todayDateOnly()) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : fallback
}

export function todayDateOnly(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function orderNextStep(order: OrderDto) {
  switch (order.status) {
    case 'request':
      return 'Ожидается подтверждение администратора. Заявку можно отменить до подтверждения.'
    case 'confirmed':
      return order.paymentRequirementsMet
        ? 'Платежи завершены. Дождитесь выдачи заказа администратором.'
        : 'Оплатите аренду и залог, чтобы заказ был готов к выдаче.'
    case 'issued':
      return 'Велосипед выдан. Согласуйте возврат с администратором в выбранном месте.'
    case 'returned':
      return 'Заказ возвращен. Дополнительные действия не нужны.'
    case 'cancelled':
      return 'Заказ отменен. Если нужна новая аренда, создайте заявку из каталога.'
  }
}

export function manufacturerOrderNextStep(order: ManufacturerOrderDto) {
  switch (order.status) {
    case 'request':
      return 'Заявка ожидает подтверждения администратора. Контакты клиента скрыты до подтверждения.'
    case 'confirmed':
      return order.fulfillmentContact
        ? 'Подготовьте выбранные велосипеды и согласуйте передачу с указанным клиентом.'
        : 'Подготовьте выбранные велосипеды. Контакты появятся, когда станет доступна координация передачи.'
    case 'issued':
      return 'Выбранные велосипеды выданы. Подготовьте возврат и следите за чеклистами администратора.'
    case 'returned':
      return 'Заказ возвращен. Проверьте историю чеклистов выдачи и возврата по вашим велосипедам.'
    case 'cancelled':
      return 'Заказ отменен. От производителя действий не требуется.'
  }
}

export function requestErrorNextStep(error: unknown) {
  const code = error instanceof ApiRequestError ? error.code as ApiErrorCode : null

  switch (code) {
    case 'UNAUTHORIZED':
      return 'Войдите в аккаунт снова и повторите действие.'
    case 'FORBIDDEN':
      return 'Для этого действия нужен аккаунт клиента.'
    case 'NOT_FOUND':
    case 'PAYMENT_NOT_FOUND':
      return 'Откройте список заказов и обновите детали заказа.'
    case 'ORDER_NOT_CANCELLABLE':
      return 'Заказ уже подтвержден или перешел дальше. Если планы изменились, свяжитесь с администратором.'
    case 'PAYMENT_NOT_ALLOWED':
      return 'Платежи становятся доступны после подтверждения администратором.'
    case 'PAYMENT_NOT_COMPLETABLE':
      return 'Эта платежная попытка закрыта. Создайте новую попытку, когда повтор будет доступен.'
    case 'PAYMENT_PROVIDER_DISABLED':
      return 'Обработка платежей отключена в этом окружении. Свяжитесь с администратором.'
    case 'PAYMENT_DEV_ENDPOINTS_DISABLED':
      return 'Тестовое завершение платежей отключено. Дождитесь помощи администратора.'
    case 'PAYMENT_ACTIVE_ATTEMPT_EXISTS':
      return 'Продолжите или завершите активную платежную попытку перед созданием новой.'
    case 'VALIDATION_ERROR':
      return 'Проверьте введенные данные и повторите попытку.'
    default:
      return 'Обновите страницу и повторите попытку. Если проблема останется, свяжитесь с администратором.'
  }
}

export function formatAdminOrderWarning(warning: AdminOrderWarningDto) {
  return translateWarningMessage(warning.message)
}

export function formatConflict(value: unknown) {
  if (!value || typeof value !== 'object') return 'Конфликт доступности'
  const conflict = value as {
    bicycleTitle?: unknown
    conflictingOrderId?: unknown
    startsOn?: unknown
    endsOn?: unknown
  }
  const title = typeof conflict.bicycleTitle === 'string' ? conflict.bicycleTitle : 'Велосипед'
  const orderId =
    typeof conflict.conflictingOrderId === 'string' ? conflict.conflictingOrderId : 'другой заказ'
  const startsOn = typeof conflict.startsOn === 'string' ? conflict.startsOn : '?'
  const endsOn = typeof conflict.endsOn === 'string' ? conflict.endsOn : '?'
  return `${title} конфликтует с ${orderId} (${startsOn} - ${endsOn}).`
}

export function formatWarning(value: unknown) {
  if (!value || typeof value !== 'object') return 'Предупреждение по доступности'
  const warning = value as { message?: unknown; type?: unknown }
  if (typeof warning.type === 'string' && typeof warning.message === 'string') {
    return translateWarningMessage(warning.message)
  }
  return 'Предупреждение по доступности'
}

function translateWarningMessage(message: string) {
  const availabilityConflict = message.match(/^(.+) conflicts with order (.+)\.$/)
  if (availabilityConflict) {
    return `${availabilityConflict[1]} конфликтует с заказом ${availabilityConflict[2]}.`
  }

  const bicycleStatus = message.match(/^(.+) is currently ([a-z_]+); expected ([a-z_]+)\.$/)
  if (bicycleStatus) {
    return `${bicycleStatus[1]} сейчас в статусе «${translateDomainWord(
      bicycleStatus[2],
    )}», ожидается «${translateDomainWord(bicycleStatus[3])}».`
  }

  const manufacturerStatus = message.match(/^(.+) belongs to a ([a-z_]+) manufacturer\.$/)
  if (manufacturerStatus) {
    return `${manufacturerStatus[1]} принадлежит производителю со статусом «${translateDomainWord(
      manufacturerStatus[2],
    )}».`
  }

  const deliveryUnavailable = message.match(/^(.+) no longer supports delivery\.$/)
  if (deliveryUnavailable) {
    return `${deliveryUnavailable[1]} больше не поддерживает доставку.`
  }

  return replaceDomainWords(
    message
      .replaceAll('Selected bicycle', 'Выбранный велосипед')
      .replaceAll('conflicts with order', 'конфликтует с заказом')
      .replaceAll('is currently', 'сейчас в статусе')
      .replaceAll('expected', 'ожидаемый статус')
      .replaceAll('belongs to a', 'принадлежит производителю со статусом')
      .replaceAll('manufacturer', 'производитель')
      .replaceAll('no longer supports delivery', 'больше не поддерживает доставку')
      .replaceAll('max load', 'максимальная нагрузка')
      .replaceAll('seat', 'седло')
      .replaceAll('frame', 'рама')
      .replaceAll('wheel', 'колесо')
      .replaceAll(' kg', ' кг')
      .replaceAll(' cm', ' см'),
    domainWordTranslations,
  )
}

function translateDomainWord(source: string) {
  return domainWordTranslations[source] ?? source
}

const domainWordTranslations: Record<string, string> = {
  archived: bicycleStatusLabel('archived').toLowerCase(),
  approved: manufacturerStatusLabel('approved').toLowerCase(),
  available: bicycleStatusLabel('available').toLowerCase(),
  blocked: manufacturerStatusLabel('blocked').toLowerCase(),
  draft: bicycleStatusLabel('draft').toLowerCase(),
  hidden: bicycleStatusLabel('hidden').toLowerCase(),
  maintenance: bicycleStatusLabel('maintenance').toLowerCase(),
  moderation: bicycleStatusLabel('moderation').toLowerCase(),
  rejected: bicycleStatusLabel('rejected').toLowerCase(),
  rented: bicycleStatusLabel('rented').toLowerCase(),
  reserved: bicycleStatusLabel('reserved').toLowerCase(),
}

function replaceDomainWords(message: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (nextMessage, [source, replacement]) =>
      nextMessage.replace(new RegExp(`\\b${source}\\b`, 'g'), replacement),
    message,
  )
}

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
