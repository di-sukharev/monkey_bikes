import { Link } from '@tanstack/react-router'
import type {
  ManufacturerOrderChecklistDto,
  ManufacturerOrderDto,
  OrderListScope,
  OrderStatus,
} from '@web-app-demo/contracts'
import {
  CircleCheckIcon,
  ClipboardCheckIcon,
  MapPinIcon,
  PhoneIcon,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableFilterInline, TableFilters, TableFilterSelect } from '@/components/table-filters'
import { NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  formatMoney,
  formatOrderDates,
  fulfillmentTypeLabel,
  manufacturerOrderNextStep,
  orderListScopeLabel,
  orderListScopes,
  orderStatusLabel,
  orderStatusesForListScope,
} from './model'
import { OrderStatusBadge } from './status-badge'

export function ManufacturerOrderFilters({
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
  const statusFilterLabel = scope === 'all'
    ? 'Все статусы'
    : `Все статусы: ${orderListScopeLabel(scope).toLowerCase()}`

  return (
    <TableFilters>
      <TableFilterInline>
        <Tabs value={scope} onValueChange={(value) => onScopeChange(value as OrderListScope)}>
          <TabsList aria-label="Раздел списка заказов производителя">
            {orderListScopes.map((nextScope) => (
              <TabsTrigger key={nextScope} value={nextScope} disabled={disabled}>
                {orderListScopeLabel(nextScope)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </TableFilterInline>
      <TableFilterSelect
        aria-label="Фильтр статуса заказов производителя"
        disabled={disabled}
        value={status}
        onChange={(event) => onStatusChange(event.target.value as OrderStatus | 'all')}
      >
        <NativeSelectOption value="all">{statusFilterLabel}</NativeSelectOption>
        {orderStatusesForListScope(scope).map((nextStatus) => (
          <NativeSelectOption key={nextStatus} value={nextStatus}>
            {orderStatusLabel(nextStatus)}
          </NativeSelectOption>
        ))}
      </TableFilterSelect>
    </TableFilters>
  )
}

export function ManufacturerOrdersTable({ orders }: { orders: ManufacturerOrderDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Заказ</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Ваши велосипеды</TableHead>
            <TableHead>Даты</TableHead>
            <TableHead>Ваша сумма</TableHead>
            <TableHead className="w-[140px]">Детали</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{order.id}</span>
                  <span className="text-sm text-muted-foreground">{fulfillmentTypeLabel(order.fulfillmentType)}</span>
                </div>
              </TableCell>
              <TableCell><OrderStatusBadge status={order.status} /></TableCell>
              <TableCell>{order.items.map((item) => item.bicycle.title).join(', ')}</TableCell>
              <TableCell>{formatOrderDates(order)}</TableCell>
              <TableCell>{formatMoney(order.manufacturerTotalAmountKopecks)}</TableCell>
              <TableCell>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/manufacturer/orders/$id" params={{ id: order.id }}>Открыть</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function ManufacturerOrderNextStep({ order }: { order: ManufacturerOrderDto }) {
  return (
    <Alert>
      <CircleCheckIcon />
      <AlertTitle>Следующий шаг</AlertTitle>
      <AlertDescription>{manufacturerOrderNextStep(order)}</AlertDescription>
    </Alert>
  )
}

export function ManufacturerOrderFulfillmentPanel({ order }: { order: ManufacturerOrderDto }) {
  if (!order.fulfillmentContact) {
    return (
      <Alert>
        <PhoneIcon />
        <AlertTitle>Контакты клиента скрыты</AlertTitle>
        <AlertDescription>
          Контакты передаются только когда заказ подтвержден или выдан.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <Alert>
        <PhoneIcon />
        <AlertTitle>Контакт клиента</AlertTitle>
        <AlertDescription>
          {order.fulfillmentContact.contactName}, {order.fulfillmentContact.contactPhone}
          {order.fulfillmentContact.userComment && (
            <span className="mt-1 block">{order.fulfillmentContact.userComment}</span>
          )}
        </AlertDescription>
      </Alert>
      <Alert>
        <MapPinIcon />
        <AlertTitle>{order.fulfillmentType === 'delivery' ? 'Доставка' : 'Самовывоз'}</AlertTitle>
        <AlertDescription>
          {order.fulfillmentContact.deliveryAddress ??
            order.items.map((item) => item.bicycle.pickupAddress).join('; ')}
        </AlertDescription>
      </Alert>
    </section>
  )
}

export function ManufacturerOrderTotals({ order }: { order: ManufacturerOrderDto }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Fact label="Ваша аренда" value={formatMoney(order.manufacturerRentalAmountKopecks)} />
      <Fact label="Ваши залоги" value={formatMoney(order.manufacturerDepositAmountKopecks)} />
      <Fact label="Ваша сумма" value={formatMoney(order.manufacturerTotalAmountKopecks)} />
    </div>
  )
}

export function ManufacturerOrderItemsTable({ order }: { order: ManufacturerOrderDto }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Велосипед</TableHead>
            <TableHead>Размер</TableHead>
            <TableHead>Город</TableHead>
            <TableHead>Аренда/день</TableHead>
            <TableHead>Залог</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{item.bicycle.title}</span>
                  <span className="text-sm text-muted-foreground">{item.bicycle.pickupAddress}</span>
                </div>
              </TableCell>
              <TableCell>{item.bicycle.size}</TableCell>
              <TableCell>{item.bicycle.city}</TableCell>
              <TableCell>{formatMoney(item.pricePerDaySnapshotKopecks)}</TableCell>
              <TableCell>{formatMoney(item.depositSnapshotKopecks)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function ManufacturerOrderChecklists({ checklists }: { checklists: ManufacturerOrderChecklistDto[] }) {
  if (checklists.length === 0) {
    return (
      <Alert>
        <ClipboardCheckIcon />
        <AlertTitle>Чеклистов выдачи или возврата пока нет</AlertTitle>
        <AlertDescription>История чеклистов администратора появится после операций передачи.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead>Операция</TableHead>
            <TableHead>Велосипед</TableHead>
            <TableHead>Состояние</TableHead>
            <TableHead>Действие безопасности</TableHead>
            <TableHead>Проверено</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checklists.map((checklist) => (
            <TableRow key={checklist.id}>
              <TableCell><Badge variant="outline">{checklist.type === 'issue' ? 'Выдача' : 'Возврат'}</Badge></TableCell>
              <TableCell>{checklist.bicycleId}</TableCell>
              <TableCell>
                <div className="grid gap-1 text-sm">
                  <span>Рама: {formatChecklistCondition(checklist.frameCondition)}</span>
                  <span>Колеса: {formatChecklistCondition(checklist.wheelsCondition)}</span>
                  <span>Тормоза: {formatChecklistCondition(checklist.brakesCondition)}</span>
                  <span>Внешний вид: {formatChecklistCondition(checklist.exteriorCondition)}</span>
                  {checklist.comment && <span className="text-muted-foreground">{checklist.comment}</span>}
                </div>
              </TableCell>
              <TableCell>{formatSafetyAction(checklist.safetyAction)}</TableCell>
              <TableCell>{new Date(checklist.checkedAt).toLocaleString('ru-RU')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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

function formatChecklistCondition(condition: ManufacturerOrderChecklistDto['frameCondition']) {
  switch (condition) {
    case 'damaged':
      return 'Повреждено'
    case 'not_applicable':
      return 'Не применимо'
    case 'ok':
      return 'В порядке'
    case 'unsafe':
      return 'Небезопасно'
    case 'worn':
      return 'Изношено'
  }
}

function formatSafetyAction(action: ManufacturerOrderChecklistDto['safetyAction']) {
  switch (action) {
    case 'hidden':
      return 'Скрыть'
    case 'maintenance':
      return 'На обслуживание'
    case 'none':
      return 'Без изменений'
  }
}
