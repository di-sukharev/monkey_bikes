import type { OrderDto, PaymentStatus, PaymentType } from '@web-app-demo/contracts';

export const paymentTypes: PaymentType[] = ['rent', 'deposit'];

export function formatPaymentType(type: PaymentType) {
  return type === 'rent' ? 'Аренда' : 'Залог';
}

export function paymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case 'cancelled':
      return 'Отменен';
    case 'failed':
      return 'Ошибка';
    case 'pending':
      return 'Ожидает';
    case 'succeeded':
      return 'Успешен';
  }
}

export function paymentAmountFor(order: OrderDto, type: PaymentType) {
  if (type === 'deposit') return order.depositAmountKopecks;
  return order.rentalAmountKopecks + order.deliveryAmountKopecks;
}

export function latestPaymentFor(order: OrderDto, type: PaymentType) {
  return [...order.payments].reverse().find((payment) => payment.type === type) ?? null;
}

export function activePaymentFor(order: OrderDto, type: PaymentType) {
  return [...order.payments]
    .reverse()
    .find(
      (payment) =>
        payment.type === type && (payment.status === 'pending' || payment.status === 'succeeded'),
    ) ?? null;
}

export function canCreatePayment(order: OrderDto, type: PaymentType) {
  if (order.status !== 'confirmed') return false;
  return !activePaymentFor(order, type);
}
