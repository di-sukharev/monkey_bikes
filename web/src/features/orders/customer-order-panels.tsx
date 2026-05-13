import { Link } from '@tanstack/react-router'
import type { OrderDto, OrderListScope, OrderStatus } from '@web-app-demo/contracts'
import {
  CircleAlertIcon,
  CircleCheckIcon,
  MapPinIcon,
  RotateCcwIcon,
  TruckIcon,
  XCircleIcon,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatRequestError } from '@/lib/request-error'
import { PaymentStatusSummary } from '../payments/order-payments-panel'
import {
  formatMoney,
  formatOrderDates,
  fulfillmentTypeLabel,
  orderListScopeLabel,
  orderListScopes,
  orderStatusLabel,
  orderNextStep,
  orderStatusesForListScope,
  requestErrorNextStep,
} from './model'
import { OrderStatusBadge } from './status-badge'

export function CustomerOrderFilters({
  disabled,
  scope,
  status,
  onScopeChange,
  onStatusChange,
}: {
  disabled: boolean
  scope: OrderListScope
  status: OrderStatus | 'all'
  onScopeChange: (scope: OrderListScope) => void
  onStatusChange: (status: OrderStatus | 'all') => void
}) {
  const statuses = orderStatusesForListScope(scope)
  const statusFilterLabel = scope === 'all'
    ? 'Все статусы'
    : `Все статусы: ${orderListScopeLabel(scope).toLowerCase()}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={scope} onValueChange={(value) => onScopeChange(value as OrderListScope)}>
        <TabsList aria-label="Раздел списка заказов">
          {orderListScopes.map((nextScope) => (
            <TabsTrigger key={nextScope} value={nextScope} disabled={disabled}>
              {orderListScopeLabel(nextScope)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <NativeSelect
        aria-label="Фильтр статуса заказа"
        className="w-full max-w-56"
        disabled={disabled}
        value={status}
        onChange={(event) => onStatusChange(event.target.value as OrderStatus | 'all')}
      >
        <NativeSelectOption value="all">{statusFilterLabel}</NativeSelectOption>
        {statuses.map((nextStatus) => (
          <NativeSelectOption key={nextStatus} value={nextStatus}>
            {orderStatusLabel(nextStatus)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

export function CustomerOrdersTable({ orders }: { orders: OrderDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Заявка</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Платежи</TableHead>
            <TableHead>Даты</TableHead>
            <TableHead>Итого</TableHead>
            <TableHead className="w-[140px]">Детали</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{order.items.map((item) => item.bicycle.title).join(', ')}</span>
                  <span className="text-sm text-muted-foreground">{fulfillmentTypeLabel(order.fulfillmentType)}</span>
                </div>
              </TableCell>
              <TableCell><OrderStatusBadge status={order.status} /></TableCell>
              <TableCell><PaymentStatusSummary order={order} /></TableCell>
              <TableCell>{formatOrderDates(order)}</TableCell>
              <TableCell>{formatMoney(order.totalAmountKopecks)}</TableCell>
              <TableCell>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/orders/$id" params={{ id: order.id }}>Открыть</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function CustomerOrderNextStep({ order }: { order: OrderDto }) {
  return (
    <Alert>
      <CircleCheckIcon />
      <AlertTitle>Следующий шаг</AlertTitle>
      <AlertDescription>{orderNextStep(order)}</AlertDescription>
    </Alert>
  )
}

export function CustomerFulfillmentPanel({ order }: { order: OrderDto }) {
  const pickupAddresses = order.items.map((item) => item.bicycle.pickupAddress).join('; ')

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <Alert>
        {order.fulfillmentType === 'delivery' ? <TruckIcon /> : <MapPinIcon />}
        <AlertTitle>{order.fulfillmentType === 'delivery' ? 'Доставка' : 'Самовывоз'}</AlertTitle>
        <AlertDescription>
          {order.fulfillmentType === 'delivery' ? order.deliveryAddress : pickupAddresses}
        </AlertDescription>
      </Alert>
      <Alert>
        <RotateCcwIcon />
        <AlertTitle>Условия возврата</AlertTitle>
        <AlertDescription>
          Возврат согласуется с администратором после выдачи. Держите все выбранные велосипеды
          доступными для проверки состояния в согласованном месте самовывоза или доставки.
        </AlertDescription>
      </Alert>
    </section>
  )
}

export function CustomerCancelPanel({
  comment,
  disabled,
  error,
  onCancel,
  onCommentChange,
}: {
  comment: string
  disabled: boolean
  error: unknown
  onCancel: () => void
  onCommentChange: (comment: string) => void
}) {
  return (
    <section className="grid gap-3 border-t pt-4">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">Отменить заявку</h2>
        <p className="text-sm text-muted-foreground">
          Отмена доступна до подтверждения администратором.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Не удалось отменить заявку</AlertTitle>
          <AlertDescription>
            {formatRequestError(error)}
            <span className="mt-1 block">{requestErrorNextStep(error)}</span>
          </AlertDescription>
        </Alert>
      ) : null}
      <Textarea
        className="min-h-20"
        disabled={disabled}
        placeholder="Необязательный комментарий"
        value={comment}
        aria-label="Комментарий к отмене"
        onChange={(event) => onCommentChange(event.target.value)}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={onCancel}
        >
          <XCircleIcon data-icon="inline-start" />
          Отменить заявку
        </Button>
      </div>
    </section>
  )
}

export function CustomerOrderTotals({ order }: { order: OrderDto }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Fact label="Аренда" value={formatMoney(order.rentalAmountKopecks)} />
      <Fact label="Залог" value={formatMoney(order.depositAmountKopecks)} />
      <Fact label="Доставка" value={formatMoney(order.deliveryAmountKopecks)} />
      <Fact label="Итого" value={formatMoney(order.totalAmountKopecks)} />
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
