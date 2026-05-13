import { Link } from '@tanstack/react-router'
import type { AdminChecklistDto } from '@web-app-demo/contracts'
import {
  BikeIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileWarningIcon,
  StoreIcon,
  UsersRoundIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BicycleStatusBadge } from '../bicycles/status-badge'
import { formatOrderDates } from '../orders/model'
import { OrderStatusBadge } from '../orders/status-badge'
import {
  adminChecklistTypeLabel,
  adminChecklistTypes,
  type AdminChecklistTypeFilter,
} from './model'

type AdminQuickFiltersProps = {
  today: string
}

type AdminChecklistsFiltersProps = {
  bicycleId: string
  disabled: boolean
  orderId: string
  type: AdminChecklistTypeFilter
  onBicycleIdChange: (value: string) => void
  onOrderIdChange: (value: string) => void
  onTypeChange: (value: AdminChecklistTypeFilter) => void
}

export function AdminQuickFilters({ today }: AdminQuickFiltersProps) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Quick filters</h2>
          <p className="text-sm text-muted-foreground">Operational queues calculated by backend filters.</p>
        </div>
        <Badge variant="secondary">{today}</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <QuickFilterCard
          icon={<ClipboardListIcon />}
          title="Unconfirmed requests"
          description="Rental requests waiting for an administrator decision."
          to="/admin/orders"
          search={{ quickFilter: 'unconfirmed_requests' }}
        />
        <QuickFilterCard
          icon={<CalendarDaysIcon />}
          title="Orders today"
          description="Current requests and active orders overlapping the selected date."
          to="/admin/orders"
          search={{ quickFilter: 'orders_today', date: today }}
        />
        <QuickFilterCard
          icon={<CreditCardIcon />}
          title="Unpaid deposit"
          description="Confirmed orders that still have no successful deposit payment."
          to="/admin/orders"
          search={{ quickFilter: 'unpaid_deposit' }}
        />
        <QuickFilterCard
          icon={<BikeIcon />}
          title="Bicycles on moderation"
          description="Submitted bicycle cards waiting for review."
          to="/admin/bicycles"
          search={{ status: 'moderation' }}
        />
        <QuickFilterCard
          icon={<FileWarningIcon />}
          title="Maintenance"
          description="Bicycles hidden from normal rental flow until service is complete."
          to="/admin/bicycles"
          search={{ status: 'maintenance' }}
        />
        <QuickFilterCard
          icon={<ClipboardCheckIcon />}
          title="Cancelled orders"
          description="Cancelled rental orders for dispute and support review."
          to="/admin/orders"
          search={{ quickFilter: 'cancelled_orders' }}
        />
      </div>
    </section>
  )
}

export function AdminSectionLinks() {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-semibold tracking-tight">Sections</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AdminSectionCard icon={<UsersRoundIcon />} title="Users" to="/admin/users" />
        <AdminSectionCard icon={<StoreIcon />} title="Manufacturers" to="/admin/manufacturers" />
        <AdminSectionCard icon={<BikeIcon />} title="Bicycles" to="/admin/bicycles" />
        <AdminSectionCard icon={<ClipboardListIcon />} title="Orders" to="/admin/orders" />
        <AdminSectionCard icon={<CreditCardIcon />} title="Payments" to="/admin/payments" />
        <AdminSectionCard icon={<ClipboardCheckIcon />} title="Checklists" to="/admin/checklists" />
      </div>
    </section>
  )
}

export function AdminChecklistsFilters({
  bicycleId,
  disabled,
  orderId,
  type,
  onBicycleIdChange,
  onOrderIdChange,
  onTypeChange,
}: AdminChecklistsFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <NativeSelect
        aria-label="Checklist type filter"
        disabled={disabled}
        value={type}
        onChange={(event) => onTypeChange(event.target.value as AdminChecklistTypeFilter)}
      >
        <NativeSelectOption value="all">All checklists</NativeSelectOption>
        {adminChecklistTypes.map((nextType) => (
          <NativeSelectOption key={nextType} value={nextType}>
            {adminChecklistTypeLabel(nextType)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Input
        aria-label="Checklist order id filter"
        disabled={disabled}
        placeholder="Order ID"
        value={orderId}
        onChange={(event) => onOrderIdChange(event.target.value)}
      />
      <Input
        aria-label="Checklist bicycle id filter"
        disabled={disabled}
        placeholder="Bicycle ID"
        value={bicycleId}
        onChange={(event) => onBicycleIdChange(event.target.value)}
      />
    </div>
  )
}

export function AdminChecklistsTable({ checklists }: { checklists: AdminChecklistDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[1120px]">
        <TableHeader>
          <TableRow>
            <TableHead>Checklist</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Bicycle</TableHead>
            <TableHead>Conditions</TableHead>
            <TableHead>Checked by</TableHead>
            <TableHead className="w-[140px]">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checklists.map((checklist) => (
            <TableRow key={checklist.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{adminChecklistTypeLabel(checklist.type)}</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(checklist.checkedAt).toLocaleString()}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="grid gap-1">
                  <OrderStatusBadge status={checklist.order.status} />
                  <span className="text-sm text-muted-foreground">{formatOrderDates(checklist.order)}</span>
                  <span className="text-sm text-muted-foreground">
                    {checklist.order.user.displayName ?? checklist.order.user.email}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{checklist.bicycle.title}</span>
                  <div>
                    <BicycleStatusBadge status={checklist.bicycle.status} />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="grid gap-1 text-sm">
                  <span>Frame {checklist.frameCondition}, wheels {checklist.wheelsCondition}</span>
                  <span className="text-muted-foreground">
                    Brakes {checklist.brakesCondition}, exterior {checklist.exteriorCondition}
                  </span>
                  <span className="text-muted-foreground">Safety action {checklist.safetyAction}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="grid gap-1">
                  <span>{checklist.checkedByUser.displayName ?? checklist.checkedByUser.email}</span>
                  {checklist.comment && (
                    <span className="text-sm text-muted-foreground">{checklist.comment}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/admin/orders/$id" params={{ id: checklist.order.id }}>
                    Open
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function QuickFilterCard({
  description,
  icon,
  search,
  title,
  to,
}: {
  description: string
  icon: ReactNode
  title: string
} & (
  | {
      search: { date?: string; quickFilter?: string; status?: string }
      to: '/admin/orders'
    }
  | {
      search: { status?: string }
      to: '/admin/bicycles'
    }
)) {
  const action = to === '/admin/orders'
    ? (
        <Link to="/admin/orders" search={search}>
          Open
        </Link>
      )
    : (
        <Link to="/admin/bicycles" search={search}>
          Open
        </Link>
      )

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="sm" asChild>
            {action}
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  )
}

function AdminSectionCard({
  icon,
  title,
  to,
}: {
  icon: ReactNode
  title: string
  to: '/admin/bicycles' | '/admin/checklists' | '/admin/manufacturers' | '/admin/orders' | '/admin/payments' | '/admin/users'
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <CardAction>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={to}>Open</Link>
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  )
}
