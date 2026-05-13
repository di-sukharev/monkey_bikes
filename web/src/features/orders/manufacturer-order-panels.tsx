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
import {
  formatMoney,
  formatOrderDates,
  manufacturerOrderNextStep,
  orderListScopeLabel,
  orderListScopes,
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
    ? 'All statuses'
    : `All ${orderListScopeLabel(scope).toLowerCase()} statuses`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={scope} onValueChange={(value) => onScopeChange(value as OrderListScope)}>
        <TabsList aria-label="Manufacturer order list scope">
          {orderListScopes.map((nextScope) => (
            <TabsTrigger key={nextScope} value={nextScope} disabled={disabled}>
              {orderListScopeLabel(nextScope)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <NativeSelect
        aria-label="Manufacturer order status filter"
        className="w-full max-w-56"
        disabled={disabled}
        value={status}
        onChange={(event) => onStatusChange(event.target.value as OrderStatus | 'all')}
      >
        <NativeSelectOption value="all">{statusFilterLabel}</NativeSelectOption>
        {orderStatusesForListScope(scope).map((nextStatus) => (
          <NativeSelectOption key={nextStatus} value={nextStatus}>
            {nextStatus}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

export function ManufacturerOrdersTable({ orders }: { orders: ManufacturerOrderDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Your bicycles</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Your subtotal</TableHead>
            <TableHead className="w-[140px]">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{order.id}</span>
                  <span className="text-sm text-muted-foreground">{order.fulfillmentType}</span>
                </div>
              </TableCell>
              <TableCell><OrderStatusBadge status={order.status} /></TableCell>
              <TableCell>{order.items.map((item) => item.bicycle.title).join(', ')}</TableCell>
              <TableCell>{formatOrderDates(order)}</TableCell>
              <TableCell>{formatMoney(order.manufacturerTotalAmountKopecks)}</TableCell>
              <TableCell>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/manufacturer/orders/$id" params={{ id: order.id }}>Open</Link>
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
      <AlertTitle>Next step</AlertTitle>
      <AlertDescription>{manufacturerOrderNextStep(order)}</AlertDescription>
    </Alert>
  )
}

export function ManufacturerOrderFulfillmentPanel({ order }: { order: ManufacturerOrderDto }) {
  if (!order.fulfillmentContact) {
    return (
      <Alert>
        <PhoneIcon />
        <AlertTitle>Customer contact hidden</AlertTitle>
        <AlertDescription>
          Contact details are shared only while the order is confirmed or issued.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <Alert>
        <PhoneIcon />
        <AlertTitle>Customer contact</AlertTitle>
        <AlertDescription>
          {order.fulfillmentContact.contactName}, {order.fulfillmentContact.contactPhone}
          {order.fulfillmentContact.userComment && (
            <span className="mt-1 block">{order.fulfillmentContact.userComment}</span>
          )}
        </AlertDescription>
      </Alert>
      <Alert>
        <MapPinIcon />
        <AlertTitle>{order.fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'}</AlertTitle>
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
      <Fact label="Your rental" value={formatMoney(order.manufacturerRentalAmountKopecks)} />
      <Fact label="Your deposits" value={formatMoney(order.manufacturerDepositAmountKopecks)} />
      <Fact label="Your subtotal" value={formatMoney(order.manufacturerTotalAmountKopecks)} />
    </div>
  )
}

export function ManufacturerOrderItemsTable({ order }: { order: ManufacturerOrderDto }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Bicycle</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Rental/day</TableHead>
            <TableHead>Deposit</TableHead>
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
        <AlertTitle>No issue or return checklists yet</AlertTitle>
        <AlertDescription>Administrator checklist history will appear after handoff operations.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead>Operation</TableHead>
            <TableHead>Bicycle</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Safety action</TableHead>
            <TableHead>Checked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checklists.map((checklist) => (
            <TableRow key={checklist.id}>
              <TableCell><Badge variant="outline">{checklist.type}</Badge></TableCell>
              <TableCell>{checklist.bicycleId}</TableCell>
              <TableCell>
                <div className="grid gap-1 text-sm">
                  <span>Frame: {checklist.frameCondition}</span>
                  <span>Wheels: {checklist.wheelsCondition}</span>
                  <span>Brakes: {checklist.brakesCondition}</span>
                  <span>Exterior: {checklist.exteriorCondition}</span>
                  {checklist.comment && <span className="text-muted-foreground">{checklist.comment}</span>}
                </div>
              </TableCell>
              <TableCell>{checklist.safetyAction}</TableCell>
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
