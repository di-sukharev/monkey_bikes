import { Link } from '@tanstack/react-router'
import type {
  AdminChecklistDto,
  OrderChecklistBicycleAction,
  OrderChecklistCondition,
} from '@web-app-demo/contracts'
import {
  BikeIcon,
  BarChart3Icon,
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
          <h2 className="text-xl font-semibold tracking-tight">Быстрые фильтры</h2>
          <p className="text-sm text-muted-foreground">Операционные очереди по серверным фильтрам.</p>
        </div>
        <Badge variant="secondary">{today}</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <QuickFilterCard
          icon={<ClipboardListIcon />}
          title="Неподтвержденные заявки"
          description="Заявки на аренду, ожидающие решения администратора."
          to="/admin/orders"
          search={{ quickFilter: 'unconfirmed_requests' }}
        />
        <QuickFilterCard
          icon={<CalendarDaysIcon />}
          title="Заказы на сегодня"
          description="Текущие заявки и активные заказы, пересекающиеся с выбранной датой."
          to="/admin/orders"
          search={{ quickFilter: 'orders_today', date: today }}
        />
        <QuickFilterCard
          icon={<CreditCardIcon />}
          title="Неоплаченный залог"
          description="Подтвержденные заказы без успешной оплаты залога."
          to="/admin/orders"
          search={{ quickFilter: 'unpaid_deposit' }}
        />
        <QuickFilterCard
          icon={<BikeIcon />}
          title="Велосипеды на модерации"
          description="Отправленные карточки велосипедов, ожидающие проверки."
          to="/admin/bicycles"
          search={{ status: 'moderation' }}
        />
        <QuickFilterCard
          icon={<FileWarningIcon />}
          title="Обслуживание"
          description="Велосипеды скрыты из обычной аренды до завершения сервиса."
          to="/admin/bicycles"
          search={{ status: 'maintenance' }}
        />
        <QuickFilterCard
          icon={<ClipboardCheckIcon />}
          title="Отмененные заказы"
          description="Отмененные заказы аренды для разбора споров и поддержки."
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
      <h2 className="text-xl font-semibold tracking-tight">Разделы</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AdminSectionCard icon={<UsersRoundIcon />} title="Пользователи" to="/admin/users" />
        <AdminSectionCard icon={<StoreIcon />} title="Производители" to="/admin/manufacturers" />
        <AdminSectionCard icon={<BikeIcon />} title="Велосипеды" to="/admin/bicycles" />
        <AdminSectionCard icon={<ClipboardListIcon />} title="Заказы" to="/admin/orders" />
        <AdminSectionCard icon={<CreditCardIcon />} title="Платежи" to="/admin/payments" />
        <AdminSectionCard icon={<ClipboardCheckIcon />} title="Чеклисты" to="/admin/checklists" />
        <AdminSectionCard icon={<BarChart3Icon />} title="Отчеты" to="/admin/reports" />
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
        aria-label="Фильтр типа чеклиста"
        disabled={disabled}
        value={type}
        onChange={(event) => onTypeChange(event.target.value as AdminChecklistTypeFilter)}
      >
        <NativeSelectOption value="all">Все чеклисты</NativeSelectOption>
        {adminChecklistTypes.map((nextType) => (
          <NativeSelectOption key={nextType} value={nextType}>
            {adminChecklistTypeLabel(nextType)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Input
        aria-label="Фильтр чеклистов по ID заказа"
        disabled={disabled}
        placeholder="ID заказа"
        value={orderId}
        onChange={(event) => onOrderIdChange(event.target.value)}
      />
      <Input
        aria-label="Фильтр чеклистов по ID велосипеда"
        disabled={disabled}
        placeholder="ID велосипеда"
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
            <TableHead>Чеклист</TableHead>
            <TableHead>Заказ</TableHead>
            <TableHead>Велосипед</TableHead>
            <TableHead>Состояние</TableHead>
            <TableHead>Проверил</TableHead>
            <TableHead className="w-[140px]">Детали</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checklists.map((checklist) => (
            <TableRow key={checklist.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{adminChecklistTypeLabel(checklist.type)}</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(checklist.checkedAt).toLocaleString('ru-RU')}
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
                  <span>
                    Рама {formatChecklistCondition(checklist.frameCondition)}, колеса{' '}
                    {formatChecklistCondition(checklist.wheelsCondition)}
                  </span>
                  <span className="text-muted-foreground">
                    Тормоза {formatChecklistCondition(checklist.brakesCondition)}, внешний вид{' '}
                    {formatChecklistCondition(checklist.exteriorCondition)}
                  </span>
                  <span className="text-muted-foreground">
                    Действие безопасности: {formatSafetyAction(checklist.safetyAction)}
                  </span>
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
                    Открыть
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

function formatChecklistCondition(condition: OrderChecklistCondition) {
  switch (condition) {
    case 'damaged':
      return 'повреждено'
    case 'not_applicable':
      return 'не применимо'
    case 'ok':
      return 'в порядке'
    case 'unsafe':
      return 'небезопасно'
    case 'worn':
      return 'изношено'
  }
}

function formatSafetyAction(action: OrderChecklistBicycleAction) {
  switch (action) {
    case 'hidden':
      return 'скрыть'
    case 'maintenance':
      return 'на обслуживание'
    case 'none':
      return 'без изменений'
  }
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
          Открыть
        </Link>
      )
    : (
        <Link to="/admin/bicycles" search={search}>
          Открыть
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
  to: '/admin/bicycles' | '/admin/checklists' | '/admin/manufacturers' | '/admin/orders' | '/admin/payments' | '/admin/reports' | '/admin/users'
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
            <Link to={to}>Открыть</Link>
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  )
}
