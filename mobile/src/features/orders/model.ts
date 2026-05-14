import type {
  FulfillmentType,
  OrderDto,
  OrderListScope,
  OrderStatus,
  PublicBicycleDto,
} from '@web-app-demo/contracts';
import { orderListScopeSchema, orderStatusesForScope } from '@web-app-demo/contracts';

import { formatMoney } from '@/features/bicycles/model';

export const orderListScopes: OrderListScope[] = orderListScopeSchema.options;
export const fulfillmentTypes: FulfillmentType[] = ['pickup', 'delivery'];

export function ordersQueryKey(
  userId: string | null | undefined,
  page: number,
  scope: OrderListScope,
  status: OrderStatus | 'all',
) {
  return ['orders', userId ?? null, page, scope, status] as const;
}

export function orderDetailQueryKey(userId: string | null | undefined, id: string) {
  return ['orders', userId ?? null, id] as const;
}

export function selectedBicyclesTotal(bicycles: PublicBicycleDto[]) {
  return {
    daily: bicycles.reduce((total, bicycle) => total + bicycle.pricePerDayKopecks, 0),
    deposit: bicycles.reduce((total, bicycle) => total + bicycle.depositKopecks, 0),
  };
}

export function formatOrderDates(order: Pick<OrderDto, 'endsOn' | 'startsOn'>) {
  return order.startsOn === order.endsOn
    ? order.startsOn
    : `${order.startsOn} - ${order.endsOn}`;
}

export function fulfillmentTypeLabel(type: FulfillmentType) {
  return type === 'delivery' ? 'Доставка' : 'Самовывоз';
}

export function orderListScopeLabel(scope: OrderListScope) {
  switch (scope) {
    case 'all':
      return 'Все';
    case 'current':
      return 'Текущие';
    case 'history':
      return 'История';
  }
}

export function orderStatusLabel(status: OrderStatus | 'all') {
  switch (status) {
    case 'all':
      return 'Все статусы';
    case 'cancelled':
      return 'Отменена';
    case 'confirmed':
      return 'Подтверждена';
    case 'issued':
      return 'Выдана';
    case 'request':
      return 'Заявка';
    case 'returned':
      return 'Возвращена';
  }
}

export function orderStatusesForListScope(scope: OrderListScope) {
  return orderStatusesForScope(scope);
}

export function orderNextStep(order: OrderDto) {
  switch (order.status) {
    case 'request':
      return 'Ожидается подтверждение администратора. Заявку можно отменить до подтверждения.';
    case 'confirmed':
      return order.paymentRequirementsMet
        ? 'Платежи завершены. Дождитесь выдачи заказа администратором.'
        : 'Оплатите аренду и залог, чтобы заказ был готов к выдаче.';
    case 'issued':
      return 'Велосипед выдан. Согласуйте возврат с администратором.';
    case 'returned':
      return 'Заказ возвращен. Дополнительные действия не нужны.';
    case 'cancelled':
      return 'Заказ отменен. Если нужна новая аренда, создайте заявку из каталога.';
  }
}

export function orderTotalLabel(order: OrderDto) {
  return formatMoney(order.totalAmountKopecks);
}
