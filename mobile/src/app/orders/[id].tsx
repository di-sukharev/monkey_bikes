import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderDto, PaymentType } from '@web-app-demo/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthRequired, CustomerOnlyGate } from '@/components/auth-gates';
import {
  AlertBox,
  BackButton,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
  ScreenHeader,
  TextField,
} from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { TEST_IDS } from '@/constants/testIds';
import { Neo, Spacing } from '@/constants/theme';
import { formatMoney } from '@/features/bicycles/model';
import {
  formatOrderDates,
  fulfillmentTypeLabel,
  orderDetailQueryKey,
  orderNextStep,
  orderStatusLabel,
} from '@/features/orders/model';
import {
  activePaymentFor,
  canCreatePayment,
  formatPaymentType,
  latestPaymentFor,
  paymentAmountFor,
  paymentStatusLabel,
  paymentTypes,
} from '@/features/payments/model';
import { formatRequestError } from '@/lib/request-error';
import { useAuth } from '@/lib/auth';

export default function OrderDetailScreen() {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [cancelComment, setCancelComment] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: orderDetailQueryKey(auth.user?.id, id),
    enabled: auth.user?.role === 'user' && id.length > 0,
    queryFn: () => auth.api.order(id),
  });

  const cancelOrder = useMutation({
    mutationFn: () => auth.api.cancelOrder(id, { comment: cancelComment }),
    onSuccess: async (response) => {
      setCancelComment('');
      setNotice('Заявка отменена');
      queryClient.setQueryData(orderDetailQueryKey(auth.user?.id, id), response);
      await queryClient.invalidateQueries({ queryKey: ['orders', auth.user?.id ?? null] });
    },
  });

  const payOrder = useMutation({
    mutationFn: async (type: PaymentType) => {
      const order = orderQuery.data?.order;
      if (!order) {
        throw new Error('Order is not loaded');
      }

      const activePayment = activePaymentFor(order, type);
      if (activePayment?.status === 'succeeded') {
        return { payment: activePayment };
      }

      const payment =
        activePayment?.status === 'pending'
          ? activePayment
          : (await auth.api.createOrderPayment(order.id, type)).payment;

      if (payment.status === 'succeeded') {
        return { payment };
      }

      return auth.api.completeStubPayment(payment.id, 'stub-success');
    },
    onSuccess: async (response) => {
      setNotice(`${formatPaymentType(response.payment.type)}: ${paymentStatusLabel(response.payment.status)}`);
      await queryClient.invalidateQueries({ queryKey: ['orders', auth.user?.id ?? null] });
      await queryClient.invalidateQueries({ queryKey: orderDetailQueryKey(auth.user?.id, id) });
    },
  });

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />;
  }

  if (!auth.user) {
    return <AuthRequired fallbackHref="/orders" redirectTo={`/orders/${id}`} title="Нужен вход" />;
  }

  if (auth.user.role !== 'user') {
    return <CustomerOnlyGate fallbackHref="/orders" />;
  }

  if (!id) {
    return (
      <Screen>
        <ScreenHeader
          leading={
            <BackButton
              label="Заказы"
              testID={TEST_IDS.navigation.backButton}
              onPress={() => router.replace('/orders')}
            />
          }
          title="Заказ"
          description="Откройте заказ из списка."
        />
        <EmptyState title="Заказ не выбран" description="Откройте заказ из списка." />
      </Screen>
    );
  }

  if (orderQuery.isLoading) {
    return <LoadingState message="Загружаем заказ..." />;
  }

  if (orderQuery.isError) {
    return (
      <Screen>
        <ScreenHeader
          leading={
            <BackButton
              label="Заказы"
              testID={TEST_IDS.navigation.backButton}
              onPress={() => router.replace('/orders')}
            />
          }
          title="Заказ недоступен"
          description={formatRequestError(orderQuery.error)}
        />
        <Button onPress={() => router.push('/orders')}>Назад к заказам</Button>
      </Screen>
    );
  }

  const order = orderQuery.data?.order;

  if (!order) {
    return <LoadingState message="Загружаем заказ..." />;
  }

  return (
    <Screen testID={TEST_IDS.orderDetail.screen}>
      <ScreenHeader
        leading={
          <BackButton
            label="Заказы"
            testID={TEST_IDS.navigation.backButton}
            onPress={() => router.replace('/orders')}
          />
        }
        title="Заявка на аренду"
        description={`${order.rentalDays} дн., ${fulfillmentTypeLabel(order.fulfillmentType)}`}
        action={<Badge>{orderStatusLabel(order.status)}</Badge>}
      />

      <Card>
        <View style={styles.badgeRow}>
          <Badge variant="outline">{formatOrderDates(order)}</Badge>
          <Badge variant="secondary">{formatMoney(order.totalAmountKopecks)}</Badge>
          <Badge variant={order.paymentRequirementsMet ? 'success' : 'outline'}>
            {order.paymentRequirementsMet ? 'оплачено' : 'оплачено не полностью'}
          </Badge>
        </View>
        <AlertBox title="Следующий шаг" description={orderNextStep(order)} />
      </Card>

      <OrderItemsCard order={order} />
      <TotalsCard order={order} />
      <FulfillmentCard order={order} />
      <PaymentsCard
        disabled={payOrder.isPending}
        error={payOrder.error}
        order={order}
        onPay={(type) => payOrder.mutate(type)}
      />

      {notice ? <AlertBox title={notice} description="Статус обновлен." /> : null}

      {order.status === 'request' ? (
        <Card>
          <ThemedText type="smallBold">Отменить заявку</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Отмена доступна до подтверждения администратором.
          </ThemedText>
          {cancelOrder.error ? (
            <AlertBox
              title="Не удалось отменить заявку"
              description={formatRequestError(cancelOrder.error)}
              variant="destructive"
            />
          ) : null}
          <TextField
            multiline
            label="Комментарий к отмене"
            testID={TEST_IDS.orderDetail.cancelCommentInput}
            value={cancelComment}
            onChangeText={setCancelComment}
          />
          <Button
            disabled={cancelOrder.isPending}
            fullWidth
            testID={TEST_IDS.orderDetail.cancelButton}
            variant="outline"
            onPress={() => cancelOrder.mutate()}>
            Отменить заявку
          </Button>
        </Card>
      ) : null}
    </Screen>
  );
}

function OrderItemsCard({ order }: { order: OrderDto }) {
  return (
    <Card>
      <ThemedText type="smallBold">Велосипеды</ThemedText>
      {order.items.map((item) => (
        <View key={item.id} style={styles.rowBox}>
          <View style={styles.rowText}>
            <ThemedText type="smallBold">{item.bicycle.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.bicycle.city}, {item.bicycle.manufacturer.publicName}
            </ThemedText>
          </View>
          <Badge>{item.bicycle.size}</Badge>
        </View>
      ))}
    </Card>
  );
}

function TotalsCard({ order }: { order: OrderDto }) {
  return (
    <Card>
      <ThemedText type="smallBold">Суммы</ThemedText>
      <Fact label="Аренда" value={formatMoney(order.rentalAmountKopecks)} />
      <Fact label="Залог" value={formatMoney(order.depositAmountKopecks)} />
      <Fact label="Доставка" value={formatMoney(order.deliveryAmountKopecks)} />
      <Fact label="Итого" value={formatMoney(order.totalAmountKopecks)} />
    </Card>
  );
}

function FulfillmentCard({ order }: { order: OrderDto }) {
  const pickupAddresses = order.items.map((item) => item.bicycle.pickupAddress).join('; ');

  return (
    <Card>
      <ThemedText type="smallBold">{fulfillmentTypeLabel(order.fulfillmentType)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {order.fulfillmentType === 'delivery' ? order.deliveryAddress : pickupAddresses}
      </ThemedText>
      <Fact label="Контакт" value={`${order.contactName}, ${order.contactPhone}`} />
      {order.userComment ? <Fact label="Комментарий" value={order.userComment} /> : null}
      <AlertBox
        title="Условия возврата"
        description="Возврат согласуется с администратором после выдачи. Держите велосипеды доступными для проверки состояния."
      />
    </Card>
  );
}

function PaymentsCard({
  disabled,
  error,
  order,
  onPay,
}: {
  disabled: boolean;
  error: unknown;
  order: OrderDto;
  onPay: (type: PaymentType) => void;
}) {
  return (
    <Card>
      <ThemedText type="smallBold">Платежи</ThemedText>
      {order.status === 'request' ? (
        <AlertBox
          title="Ожидается подтверждение"
          description="Платежи становятся доступны после подтверждения администратором."
        />
      ) : null}
      {error ? (
        <AlertBox
          title="Действие с платежом не удалось"
          description={formatRequestError(error)}
          variant="destructive"
        />
      ) : null}
      {paymentTypes.map((type) => {
        const latestPayment = latestPaymentFor(order, type);
        const activePayment = activePaymentFor(order, type);
        const succeeded = latestPayment?.status === 'succeeded';
        const actionable =
          order.status === 'confirmed' && !succeeded && (activePayment || canCreatePayment(order, type));

        return (
          <View key={type} style={styles.paymentBox}>
            <View style={styles.rowText}>
              <ThemedText type="smallBold">{formatPaymentType(type)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatMoney(paymentAmountFor(order, type))}
              </ThemedText>
            </View>
            <Badge variant={succeeded ? 'success' : 'outline'}>
              {latestPayment ? paymentStatusLabel(latestPayment.status) : 'не создан'}
            </Badge>
            {actionable ? (
              <Button
                disabled={disabled}
                testID={type === 'rent' ? TEST_IDS.orderDetail.payRentButton : TEST_IDS.orderDetail.payDepositButton}
                onPress={() => onPay(type)}>
                {latestPayment?.status === 'failed' || latestPayment?.status === 'cancelled'
                  ? 'Повторить оплату'
                  : 'Оплатить'}
              </Button>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  rowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
    padding: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: Spacing.one,
  },
  fact: {
    gap: Spacing.one,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
    padding: Spacing.two,
  },
  paymentBox: {
    gap: Spacing.two,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
    padding: Spacing.two,
  },
});
