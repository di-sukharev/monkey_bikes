import { useQuery } from '@tanstack/react-query';
import type { OrderDto, OrderListScope, OrderStatus } from '@web-app-demo/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthRequired, CustomerOnlyGate } from '@/components/auth-gates';
import {
  AlertBox,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
  ScreenHeader,
  SegmentedControl,
} from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { TEST_IDS } from '@/constants/testIds';
import { Spacing } from '@/constants/theme';
import {
  formatOrderDates,
  fulfillmentTypeLabel,
  orderListScopeLabel,
  orderListScopes,
  ordersQueryKey,
  orderStatusLabel,
  orderStatusesForListScope,
  orderTotalLabel,
} from '@/features/orders/model';
import { paymentTypes, latestPaymentFor, formatPaymentType, paymentStatusLabel } from '@/features/payments/model';
import { formatRequestError } from '@/lib/request-error';
import { useAuth } from '@/lib/auth';

const pageSize = 20;

export default function OrdersScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<OrderListScope>('current');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');

  const ordersQuery = useQuery({
    queryKey: ordersQueryKey(auth.user?.id, page, scope, status),
    enabled: auth.user?.role === 'user',
    queryFn: () =>
      auth.api.orders({
        page,
        pageSize,
        scope,
        ...(status === 'all' ? {} : { status }),
      }),
  });

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." withinTabs />;
  }

  if (!auth.user) {
    return <AuthRequired redirectTo="/orders" title="Нужен вход" withinTabs />;
  }

  if (auth.user.role !== 'user') {
    return <CustomerOnlyGate withinTabs />;
  }

  const data = ordersQuery.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const statuses = orderStatusesForListScope(scope);

  return (
    <Screen testID={TEST_IDS.orders.screen} withinTabs>
      <ScreenHeader
        eyebrow="Заказы"
        title="Мои заказы"
        description="Текущие и архивные заявки, платежи и условия передачи."
        action={data ? <Badge variant="secondary">{data.total} шт.</Badge> : null}
      />

      <Card>
        <SegmentedControl
          accessibilityLabel="Раздел списка заказов"
          value={scope}
          options={orderListScopes.map((nextScope) => ({
            label: orderListScopeLabel(nextScope),
            value: nextScope,
          }))}
          onChange={(nextScope) => {
            setPage(1);
            setScope(nextScope);
            setStatus('all');
          }}
        />
        <View style={styles.statusRow}>
          <Button
            variant={status === 'all' ? 'default' : 'outline'}
            onPress={() => {
              setPage(1);
              setStatus('all');
            }}>
            Все
          </Button>
          {statuses.map((nextStatus) => (
            <Button
              key={nextStatus}
              variant={status === nextStatus ? 'default' : 'outline'}
              onPress={() => {
                setPage(1);
                setStatus(nextStatus);
              }}>
              {orderStatusLabel(nextStatus)}
            </Button>
          ))}
        </View>
      </Card>

      {ordersQuery.isLoading ? <AlertBox title="Загружаем заказы..." /> : null}

      {ordersQuery.isError ? (
        <AlertBox
          title="Не удалось загрузить заказы"
          description={formatRequestError(ordersQuery.error)}
          variant="destructive"
        />
      ) : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          title="Заказы не найдены"
          description={scope === 'history' ? 'Здесь появятся завершенные заявки.' : 'Создайте заявку из каталога.'}
          action={<Button onPress={() => router.push('/catalog')}>Открыть каталог</Button>}
        />
      ) : null}

      {data?.items.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onOpen={() => router.push(`/orders/${order.id}`)}
        />
      ))}

      <View style={styles.pagination}>
        <Button
          disabled={page <= 1 || ordersQuery.isFetching}
          variant="outline"
          onPress={() => setPage((current) => Math.max(1, current - 1))}>
          Назад
        </Button>
        <Badge variant="outline">
          {page}/{totalPages}
        </Badge>
        <Button
          disabled={page >= totalPages || ordersQuery.isFetching}
          variant="outline"
          onPress={() => setPage((current) => current + 1)}>
          Далее
        </Button>
      </View>
    </Screen>
  );
}

function OrderCard({ order, onOpen }: { order: OrderDto; onOpen: () => void }) {
  return (
    <Card>
      <View style={styles.badgeRow}>
        <Badge>{orderStatusLabel(order.status)}</Badge>
        <Badge variant="outline">{formatOrderDates(order)}</Badge>
        <Badge variant="secondary">{orderTotalLabel(order)}</Badge>
      </View>
      <View style={styles.cardText}>
        <ThemedText type="smallBold">
          {order.items.map((item) => item.bicycle.title).join(', ')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {order.rentalDays} дн., {fulfillmentTypeLabel(order.fulfillmentType)}
        </ThemedText>
      </View>
      <View style={styles.paymentRow}>
        {paymentTypes.map((type) => {
          const payment = latestPaymentFor(order, type);
          return (
            <Badge key={type} variant={payment?.status === 'succeeded' ? 'success' : 'outline'}>
              {formatPaymentType(type)}: {payment ? paymentStatusLabel(payment.status) : 'нет'}
            </Badge>
          );
        })}
      </View>
      <Button variant="outline" onPress={onOpen}>
        Открыть
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cardText: {
    gap: Spacing.one,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
