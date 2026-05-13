import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminOrderDto,
  AdminOrderStatusUpdateInput,
  AdminOrderWarningDto,
  BicycleStatus,
  OrderDto,
  OrderListScope,
  OrderStatus,
  PaymentType,
  PublicBicycleDto,
} from '@web-app-demo/contracts'
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClipboardListIcon,
  MapPinIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  XCircleIcon,
} from 'lucide-react'
import { useState } from 'react'

import { GateCard, LoadingState } from '@/components/page-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { TableFilterInput, TableFilters, TableFilterSelect } from '@/components/table-filters'
import { NativeSelectOption } from '@/components/ui/native-select'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { pageShellClass } from '@/lib/page-layout'
import { ApiRequestError } from '@/lib/api'
import { formatRequestError } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'
import { OrderForm } from './order-form'
import {
  AdminOrderChecklistTransitionPanel,
  AdminOrderChecklistsTable,
} from './admin-order-checklists'
import {
  OrderPaymentsPanel,
  PaymentStatusSummary,
  type PendingPaymentAction,
} from '../payments/order-payments-panel'
import { formatPaymentType, paymentStatusLabel, type StubPaymentAction } from '../payments/model'
import { bicycleStatusLabel } from '../bicycles/model'
import { manufacturerStatusLabel } from '../manufacturers/model'
import {
  adminOrderQuickFilterLabel,
  adminOrderQuickFilters,
  emptyOrderForm,
  formatAdminOrderWarning,
  formatConflict,
  formatWarning,
  fulfillmentTypeLabel,
  formatMoney,
  formatOrderDates,
  orderAdminDetailQueryKey,
  orderAdminListQueryKey,
  orderDetailQueryKey,
  orderStatusLabel,
  orderStatuses,
  ordersQueryKey,
  parseAdminOrderQuickFilter,
  parseAdminOrderStatusFilter,
  parseDateOnlySearch,
  parseBicycleIds,
  requestErrorNextStep,
  selectedBicyclesTotal,
  type AdminOrderQuickFilterOption,
} from './model'
import { OrderStatusBadge } from './status-badge'
import {
  CustomerCancelPanel,
  CustomerFulfillmentPanel,
  CustomerOrderFilters,
  CustomerOrderNextStep,
  CustomerOrdersTable,
  CustomerOrderTotals,
} from './customer-order-panels'

const ordersPageSize = 20
const adminOrdersPageSize = 20

export function OrderRequestPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const search = useSearch({ strict: false }) as { bicycleIds?: string | string[] }
  const bicycleIds = parseBicycleIds(search.bicycleIds)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)

  const selectedBicyclesQuery = useQuery({
    queryKey: ['orders', 'selected-bicycles', bicycleIds],
    enabled: auth.user?.role === 'user' && bicycleIds.length > 0,
    queryFn: async () => {
      const responses = await Promise.all(bicycleIds.map((id) => auth.api.publicBicycle(id)))
      return responses.map((response) => response.bicycle)
    },
  })

  const createOrder = useMutation({
    mutationFn: (input: Parameters<typeof auth.api.createOrder>[0]) => auth.api.createOrder(input),
    onSuccess: async (response) => {
      setCreatedOrderId(response.order.id)
      await queryClient.invalidateQueries({ queryKey: ['orders', auth.user?.id ?? null] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Заявка на аренду"
        title="Нужен вход"
        description="Войдите как клиент, чтобы создать заявку на аренду."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'user') {
    return (
      <GateCard
        eyebrow="Заявка на аренду"
        title="Нужен аккаунт клиента"
        description="Заявки на аренду можно создавать из аккаунта клиента."
      />
    )
  }

  if (bicycleIds.length === 0) {
    return (
      <GateCard
        eyebrow="Заявка на аренду"
        title="Велосипеды не выбраны"
        description="Выберите один или несколько велосипедов в каталоге перед созданием заявки."
        action={<Button asChild><Link to="/bicycles">Открыть каталог</Link></Button>}
      />
    )
  }

  const selectedBicycles = selectedBicyclesQuery.data ?? []
  const totals = selectedBicyclesTotal(selectedBicycles)

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Заявка на аренду
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Создать заявку</h1>
            <CardDescription>Выбранные велосипеды, даты, получение, контакты и согласие с безопасностью.</CardDescription>
          </div>
          <CardAction>
            <Button type="button" variant="outline" asChild>
              <Link to="/bicycles">Назад в каталог</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {selectedBicyclesQuery.isLoading && (
            <TableSkeleton
              actionColumn={false}
              columns={5}
              label="Загружаем выбранные велосипеды..."
              tableClassName="min-w-[760px]"
            />
          )}

          {selectedBicyclesQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить выбранные велосипеды</AlertTitle>
              <AlertDescription>{formatRequestError(selectedBicyclesQuery.error)}</AlertDescription>
            </Alert>
          )}

          {selectedBicycles.length > 0 && (
            <SelectedBicyclesTable bicycles={selectedBicycles} />
          )}

          {selectedBicycles.length > 0 && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Расчет заявки на сервере</AlertTitle>
              <AlertDescription>
                Выбранная дневная сумма {formatMoney(totals.daily)} и залог {formatMoney(totals.deposit)}.
                Итоговые дни аренды и суммы рассчитываются сервером при создании заявки.
              </AlertDescription>
            </Alert>
          )}

          {createdOrderId && (
            <Alert>
              <ClipboardListIcon />
              <AlertTitle>Заявка создана</AlertTitle>
              <AlertDescription>
                Заявка на аренду сохранена и видна в ваших заказах.
              </AlertDescription>
            </Alert>
          )}

          {createOrder.error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось создать заявку</AlertTitle>
              <AlertDescription>{formatRequestError(createOrder.error)}</AlertDescription>
            </Alert>
          )}

          <OrderForm
            key={bicycleIds.join(',')}
            disabled={selectedBicycles.length === 0 || createOrder.isPending || createdOrderId !== null}
            initialValues={emptyOrderForm(bicycleIds)}
            onSubmit={async (input) => {
              setCreatedOrderId(null)
              await createOrder.mutateAsync(input)
            }}
          />

          {createdOrderId && (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/orders/$id" params={{ id: createdOrderId }}>Открыть заявку</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/orders">Мои заказы</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

export function OrdersPage() {
  const auth = useAuth()
  const [page, setPage] = useState(1)
  const [scope, setScope] = useState<OrderListScope>('current')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const queryKey = ordersQueryKey(auth.user?.id, page, scope, status)

  const ordersQuery = useQuery({
    queryKey,
    enabled: auth.user?.role === 'user',
    queryFn: () =>
      auth.api.orders({
        page,
        pageSize: ordersPageSize,
        scope,
        ...(status === 'all' ? {} : { status }),
      }),
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Заказы"
        title="Нужен вход"
        description="Войдите как клиент, чтобы смотреть заявки на аренду."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'user') {
    return (
      <GateCard
        eyebrow="Заказы"
        title="Нужен аккаунт клиента"
        description="Заявки на аренду доступны для аккаунтов клиентов."
      />
    )
  }

  const data = ordersQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ordersPageSize))

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Заказы
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Мои заказы</h1>
            <CardDescription>Текущие и архивные заявки, состояние платежей и детали передачи.</CardDescription>
          </div>
          {data && (
            <CardAction>
              <Badge variant="secondary">
                Всего: {data.total}, страница {data.page} из {totalPages}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          <CustomerOrderFilters
            disabled={ordersQuery.isFetching}
            scope={scope}
            status={status}
            onScopeChange={(nextScope) => {
              setPage(1)
              setScope(nextScope)
              setStatus('all')
            }}
            onStatusChange={(nextStatus) => {
              setPage(1)
              setStatus(nextStatus)
            }}
          />

          {ordersQuery.isLoading && (
            <TableSkeleton
              columns={6}
              label="Загружаем заказы..."
              tableClassName="min-w-[980px]"
            />
          )}

          {ordersQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить заказы</AlertTitle>
              <AlertDescription>{formatRequestError(ordersQuery.error)}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardListIcon />
                </EmptyMedia>
                <EmptyTitle>Заказы не найдены.</EmptyTitle>
                <EmptyDescription>
                  {scope === 'history'
                    ? 'Здесь появятся возвращенные и отмененные заказы.'
                    : 'Создайте заявку из публичного каталога.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && <CustomerOrdersTable orders={data.items} />}
        </CardContent>
      </Card>

      <Pagination className="justify-end">
        <PaginationContent>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || ordersQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Назад
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || ordersQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Далее
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </section>
  )
}

export function OrderDetailPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const { id } = useParams({ strict: false }) as { id: string }
  const [cancelComment, setCancelComment] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null)
  const [paymentActionError, setPaymentActionError] = useState<unknown>(null)
  const [pendingPaymentAction, setPendingPaymentAction] = useState<PendingPaymentAction>(null)
  const orderQuery = useQuery({
    queryKey: orderDetailQueryKey(auth.user?.id, id),
    enabled: auth.user?.role === 'user',
    queryFn: () => auth.api.order(id),
  })
  const cancelOrder = useMutation({
    mutationFn: () =>
      auth.api.cancelOrder(id, {
        comment: cancelComment,
      }),
    onSuccess: async (response) => {
      setNotice('Заявка отменена')
      setCancelComment('')
      await queryClient.invalidateQueries({ queryKey: ['orders', auth.user?.id ?? null] })
      queryClient.setQueryData(orderDetailQueryKey(auth.user?.id, id), response)
    },
  })
  const createPayment = useMutation({
    onMutate: () => {
      setPaymentActionError(null)
      setPaymentNotice(null)
    },
    mutationFn: async (type: PaymentType) => {
      setPendingPaymentAction({ kind: 'create', type })
      return auth.api.createOrderPayment(id, type)
    },
    onSuccess: async (response) => {
      setPaymentActionError(null)
      setPaymentNotice(`${formatPaymentType(response.payment.type)}: ${paymentStatusLabel(response.payment.status)}`)
      await queryClient.invalidateQueries({ queryKey: ['orders', auth.user?.id ?? null] })
      await queryClient.invalidateQueries({ queryKey: orderDetailQueryKey(auth.user?.id, id) })
    },
    onError: (error) => {
      setPaymentActionError(error)
    },
    onSettled: () => {
      setPendingPaymentAction(null)
    },
  })
  const completePayment = useMutation({
    onMutate: () => {
      setPaymentActionError(null)
      setPaymentNotice(null)
    },
    mutationFn: async ({ paymentId, action }: { paymentId: string; action: StubPaymentAction }) => {
      setPendingPaymentAction({ kind: 'complete', paymentId, action })
      return auth.api.completeStubPayment(paymentId, action)
    },
    onSuccess: async (response) => {
      setPaymentActionError(null)
      setPaymentNotice(`${formatPaymentType(response.payment.type)}: ${paymentStatusLabel(response.payment.status)}`)
      await queryClient.invalidateQueries({ queryKey: ['orders', auth.user?.id ?? null] })
      await queryClient.invalidateQueries({ queryKey: orderDetailQueryKey(auth.user?.id, id) })
    },
    onError: (error) => {
      setPaymentActionError(error)
    },
    onSettled: () => {
      setPendingPaymentAction(null)
    },
  })

  if (auth.isBootstrapping || orderQuery.isLoading) {
    return <LoadingState message="Загружаем заказ..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Заказ"
        title="Нужен вход"
        description="Войдите как клиент, чтобы посмотреть этот заказ."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'user') {
    return (
      <GateCard
        eyebrow="Заказ"
        title="Нужен аккаунт клиента"
        description="Заявки на аренду доступны для аккаунтов клиентов."
      />
    )
  }

  if (orderQuery.isError) {
    return (
      <GateCard
        eyebrow="Заказ"
        title="Заказ недоступен"
        description={orderDetailErrorDescription(orderQuery.error)}
        action={
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{requestErrorNextStep(orderQuery.error)}</p>
            <Button className="w-fit" asChild>
              <Link to="/orders">Назад к заказам</Link>
            </Button>
          </div>
        }
      />
    )
  }

  const order = orderQuery.data?.order

  if (!order) {
    return <LoadingState message="Загружаем заказ..." />
  }

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={order.status} />
              <Badge variant="outline">{formatOrderDates(order)}</Badge>
              <Badge variant="secondary">{formatMoney(order.totalAmountKopecks)}</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Заявка на аренду</h1>
            <CardDescription>{order.rentalDays} дн. аренды, {fulfillmentTypeLabel(order.fulfillmentType)}</CardDescription>
          </div>
          <CardAction>
            <Button type="button" variant="outline" asChild>
              <Link to="/orders">Назад к заказам</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          <CustomerOrderNextStep order={order} />
          <SelectedOrderItemsTable order={order} />

          <CustomerOrderTotals order={order} />

          <CustomerFulfillmentPanel order={order} />

          <Alert>
            <CircleCheckIcon />
            <AlertTitle>Контакт</AlertTitle>
            <AlertDescription>{order.contactName}, {order.contactPhone}</AlertDescription>
          </Alert>

          {order.userComment && (
            <Alert>
              <ClipboardListIcon />
              <AlertTitle>Комментарий</AlertTitle>
              <AlertDescription>{order.userComment}</AlertDescription>
            </Alert>
          )}

          <OrderPaymentsPanel
            order={order}
            mode="user"
            notice={paymentNotice}
            error={paymentActionError}
            pendingAction={pendingPaymentAction}
            onCreate={(type) => createPayment.mutate(type)}
            onComplete={(paymentId, action) => completePayment.mutate({ paymentId, action })}
          />

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>{notice}</AlertTitle>
              <AlertDescription>Статус заявки обновлен.</AlertDescription>
            </Alert>
          )}

          {order.status === 'request' && (
            <CustomerCancelPanel
              comment={cancelComment}
              disabled={cancelOrder.isPending}
              error={cancelOrder.error}
              onCancel={() => cancelOrder.mutate()}
              onCommentChange={setCancelComment}
            />
          )}
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminOrdersPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    date?: string
    page?: number
    quickFilter?: string
    status?: string
  }
  const page = search.page ?? 1
  const quickFilter = parseAdminOrderQuickFilter(search.quickFilter)
  const status = quickFilter === 'none' ? parseAdminOrderStatusFilter(search.status) : 'all'
  const date = parseDateOnlySearch(search.date)

  const queryKey = orderAdminListQueryKey(page, status, quickFilter, date)
  const ordersQuery = useQuery({
    queryKey,
    enabled: auth.user?.role === 'admin',
    queryFn: () =>
      auth.api.adminOrders({
        page,
        pageSize: adminOrdersPageSize,
        ...(quickFilter === 'none'
          ? status === 'all'
            ? {}
            : { status }
          : {
              quickFilter,
              ...(quickFilter === 'orders_today' && date ? { date } : {}),
            }),
      }),
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Заказы"
        title="Нужен вход"
        description="Войдите под администратором, чтобы просматривать заявки на аренду."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Заказы"
        title="Доступ запрещен"
        description="У аккаунта нет прав на просмотр заявок на аренду."
      />
    )
  }

  const data = ordersQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / adminOrdersPageSize))

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Заказы администратора
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Заказы</h1>
            <CardDescription>Просматривайте заявки, доступность и историю статусов.</CardDescription>
          </div>
          {data && (
            <CardAction>
              <Badge variant="secondary">
                Всего: {data.total}, страница {data.page} из {totalPages}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          <TableFilters>
            <TableFilterSelect
              aria-label="Быстрый фильтр заказов администратора"
              disabled={ordersQuery.isFetching}
              value={quickFilter}
              onChange={(event) => {
                const nextFilter = event.target.value as AdminOrderQuickFilterOption
                void navigate({
                  to: '/admin/orders',
                  search: adminOrdersSearch(nextFilter, 'request', date),
                })
              }}
            >
              <NativeSelectOption value="none">Ручной статус</NativeSelectOption>
              {adminOrderQuickFilters.map((nextFilter) => (
                <NativeSelectOption key={nextFilter} value={nextFilter}>
                  {adminOrderQuickFilterLabel(nextFilter)}
                </NativeSelectOption>
              ))}
            </TableFilterSelect>
            <TableFilterSelect
              aria-label="Фильтр статуса заказов администратора"
              disabled={ordersQuery.isFetching || quickFilter !== 'none'}
              value={status}
              onChange={(event) => {
                void navigate({
                  to: '/admin/orders',
                  search: adminOrdersSearch('none', event.target.value as OrderStatus | 'all', date),
                })
              }}
            >
              <NativeSelectOption value="all">Все статусы</NativeSelectOption>
              {orderStatuses.map((nextStatus) => (
                <NativeSelectOption key={nextStatus} value={nextStatus}>
                  {orderStatusLabel(nextStatus)}
                </NativeSelectOption>
              ))}
            </TableFilterSelect>
            <TableFilterInput
              aria-label="Фильтр заказов администратора по дате"
              disabled={ordersQuery.isFetching || quickFilter !== 'orders_today'}
              type="date"
              value={date}
              onChange={(event) => {
                void navigate({
                  to: '/admin/orders',
                  search: adminOrdersSearch(quickFilter, status, event.target.value),
                })
              }}
            />
          </TableFilters>

          {ordersQuery.isLoading && (
            <TableSkeleton
              columns={7}
              label="Загружаем заказы..."
              tableClassName="min-w-[1120px]"
            />
          )}

          {ordersQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить заказы</AlertTitle>
              <AlertDescription>{formatRequestError(ordersQuery.error)}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardListIcon />
                </EmptyMedia>
                <EmptyTitle>Заказы не найдены.</EmptyTitle>
                <EmptyDescription>Текущий быстрый фильтр не вернул заказы.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Заявка</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Платежи</TableHead>
                    <TableHead>Даты</TableHead>
                    <TableHead>Итого</TableHead>
                    <TableHead className="w-[140px]">Детали</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="grid gap-1">
                          <span className="font-medium">{order.items.map((item) => item.bicycle.title).join(', ')}</span>
                          <span className="text-sm text-muted-foreground">{fulfillmentTypeLabel(order.fulfillmentType)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          <span>{order.user.displayName ?? order.user.email}</span>
                          <span className="text-sm text-muted-foreground">{order.contactPhone}</span>
                        </div>
                      </TableCell>
                      <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                      <TableCell><PaymentStatusSummary order={order} /></TableCell>
                      <TableCell>{formatOrderDates(order)}</TableCell>
                      <TableCell>{formatMoney(order.totalAmountKopecks)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link to="/admin/orders/$id" params={{ id: order.id }}>Открыть</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination className="justify-end">
        <PaginationContent>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || ordersQuery.isFetching}
              onClick={() => {
                void navigate({
                  to: '/admin/orders',
                  search: adminOrdersSearch(quickFilter, status, date, Math.max(1, page - 1)),
                })
              }}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Назад
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || ordersQuery.isFetching}
              onClick={() => {
                void navigate({
                  to: '/admin/orders',
                  search: adminOrdersSearch(quickFilter, status, date, page + 1),
                })
              }}
            >
              Далее
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </section>
  )
}

function adminOrdersSearch(
  quickFilter: AdminOrderQuickFilterOption,
  status: OrderStatus | 'all',
  date: string,
  page?: number,
) {
  return {
    ...(page && page > 1 ? { page } : {}),
    ...(quickFilter === 'none'
      ? { status }
      : {
          quickFilter,
          ...(quickFilter === 'orders_today' ? { date: parseDateOnlySearch(date) } : {}),
        }),
  }
}

export function AdminOrderDetailPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const { id } = useParams({ strict: false }) as { id: string }
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const orderQuery = useQuery({
    queryKey: orderAdminDetailQueryKey(id),
    enabled: auth.user?.role === 'admin',
    queryFn: () => auth.api.adminOrder(id),
  })
  const updateStatus = useMutation({
    mutationFn: (input: AdminOrderStatusUpdateInput) =>
      auth.api.updateAdminOrderStatus(id, input),
    onSuccess: async (response) => {
      setNotice(`Заказ: ${orderStatusLabel(response.order.status)}`)
      setComment('')
      queryClient.setQueryData(orderAdminDetailQueryKey(id), response)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'checklists'] })
      await queryClient.invalidateQueries({ queryKey: ['orders', response.order.userId] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['manufacturer', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['manufacturer', 'orders'] })
    },
  })

  if (auth.isBootstrapping || orderQuery.isLoading) {
    return <LoadingState message="Загружаем заказ..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Заказ администратора"
        title="Нужен вход"
        description="Войдите под администратором, чтобы просмотреть заявку на аренду."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Заказ администратора"
        title="Доступ запрещен"
        description="У аккаунта нет прав на просмотр заявок на аренду."
      />
    )
  }

  if (orderQuery.isError) {
    return (
      <GateCard
        eyebrow="Заказ администратора"
        title="Заказ недоступен"
        description={formatRequestError(orderQuery.error)}
        action={<Button asChild><Link to="/admin/orders">Назад к заказам</Link></Button>}
      />
    )
  }

  const order = orderQuery.data?.order
  if (!order) {
    return <LoadingState message="Загружаем заказ..." />
  }

  const requestPending = order.status === 'request'
  const confirmed = order.status === 'confirmed'
  const issued = order.status === 'issued'
  const cancellationAvailable = requestPending || confirmed
  const errorWarnings = order.availabilityWarnings.filter((warning) => warning.severity === 'error')
  const issueBlockedByWarnings = confirmed && errorWarnings.length > 0

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={order.status} />
              <Badge variant="outline">{formatOrderDates(order)}</Badge>
              <Badge variant="secondary">{formatMoney(order.totalAmountKopecks)}</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Заказ администратора</h1>
            <CardDescription>{order.rentalDays} дн. аренды, {fulfillmentTypeLabel(order.fulfillmentType)}</CardDescription>
          </div>
          <CardAction>
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/orders">Назад к заказам</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>{notice}</AlertTitle>
              <AlertDescription>История статусов обновлена.</AlertDescription>
            </Alert>
          )}

          {updateStatus.error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось обновить заказ</AlertTitle>
              <AlertDescription>
                {formatRequestError(updateStatus.error)}
                <RequestErrorDetails error={updateStatus.error} />
              </AlertDescription>
            </Alert>
          )}

          {requestPending && errorWarnings.length > 0 && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Подтверждение заблокировано</AlertTitle>
              <AlertDescription>Устраните конфликты доступности или состояния каталога перед подтверждением.</AlertDescription>
            </Alert>
          )}

          {issueBlockedByWarnings && order.paymentRequirementsMet && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Выдача заблокирована</AlertTitle>
              <AlertDescription>Устраните конфликты статуса велосипеда или производителя перед выдачей.</AlertDescription>
            </Alert>
          )}

          <AdminWarnings warnings={order.availabilityWarnings} />
          <SelectedAdminOrderItemsTable order={order} />

          <div className="grid gap-3 md:grid-cols-4">
            <Fact label="Аренда" value={formatMoney(order.rentalAmountKopecks)} />
            <Fact label="Залог" value={formatMoney(order.depositAmountKopecks)} />
            <Fact label="Доставка" value={formatMoney(order.deliveryAmountKopecks)} />
            <Fact label="Итого" value={formatMoney(order.totalAmountKopecks)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Alert>
              <UserRoundIcon />
              <AlertTitle>Клиент</AlertTitle>
              <AlertDescription>
                {order.user.displayName ?? order.user.email}, {order.contactName}, {order.contactPhone}
              </AlertDescription>
            </Alert>
            <Alert>
              <MapPinIcon />
              <AlertTitle>{order.fulfillmentType === 'delivery' ? 'Доставка' : 'Самовывоз'}</AlertTitle>
              <AlertDescription>
                {order.fulfillmentType === 'delivery'
                  ? order.deliveryAddress
                  : order.items.map((item) => item.bicycle.pickupAddress).join('; ')}
              </AlertDescription>
            </Alert>
          </div>

          <OrderPaymentsPanel order={order} mode="admin" />

          <AdminOrderChecklistsTable order={order} />

          {confirmed && order.paymentRequirementsMet && !issueBlockedByWarnings && (
            <AdminOrderChecklistTransitionPanel
              key={`${order.id}-issue`}
              disabled={updateStatus.isPending}
              order={order}
              type="issue"
              onSubmit={(input) => updateStatus.mutate(input)}
            />
          )}

          {issued && (
            <AdminOrderChecklistTransitionPanel
              key={`${order.id}-return`}
              disabled={updateStatus.isPending}
              order={order}
              type="return"
              onSubmit={(input) => updateStatus.mutate(input)}
            />
          )}

          <StatusHistoryTable order={order} />

          {cancellationAvailable && (
            <section className="grid gap-3 border-t pt-4">
              <div className="grid gap-1">
                <h2 className="text-base font-semibold">Решение</h2>
                <p className="text-sm text-muted-foreground">
                  {requestPending
                    ? 'Подтверждайте только когда доступность, логистика, контакты и лимиты безопасности проверены.'
                    : 'Подтвержденные заказы можно отменить до выдачи, если передача больше невозможна.'}
                </p>
              </div>
              <Textarea
                className="min-h-24"
                disabled={updateStatus.isPending}
                placeholder="Комментарий для истории статусов"
                value={comment}
                aria-label="Комментарий администратора к заказу"
                onChange={(event) => setComment(event.target.value)}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateStatus.isPending || comment.trim().length === 0}
                  onClick={() => updateStatus.mutate({ status: 'cancelled', comment })}
                >
                  <XCircleIcon data-icon="inline-start" />
                  Отменить
                </Button>
                {requestPending && (
                  <Button
                    type="button"
                    disabled={updateStatus.isPending || errorWarnings.length > 0}
                    onClick={() => updateStatus.mutate({ status: 'confirmed', comment })}
                  >
                    <ShieldCheckIcon data-icon="inline-start" />
                    Подтвердить
                  </Button>
                )}
              </div>
            </section>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function SelectedBicyclesTable({ bicycles }: { bicycles: PublicBicycleDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Велосипед</TableHead>
            <TableHead>Город</TableHead>
            <TableHead>За день</TableHead>
            <TableHead>Залог</TableHead>
            <TableHead>Доставка</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bicycles.map((bicycle) => (
            <TableRow key={bicycle.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{bicycle.title}</span>
                  <span className="text-sm text-muted-foreground">{bicycle.manufacturer.publicName}</span>
                </div>
              </TableCell>
              <TableCell>{bicycle.city}</TableCell>
              <TableCell>{formatMoney(bicycle.pricePerDayKopecks)}</TableCell>
              <TableCell>{formatMoney(bicycle.depositKopecks)}</TableCell>
              <TableCell>{bicycle.deliveryAvailable ? 'Доступна' : 'Только самовывоз'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SelectedOrderItemsTable({ order }: { order: OrderDto }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Велосипед</TableHead>
            <TableHead>Цена за день</TableHead>
            <TableHead>Залог</TableHead>
            <TableHead>Самовывоз</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{item.bicycle.title}</span>
                  <span className="text-sm text-muted-foreground">{item.bicycle.manufacturer.publicName}</span>
                </div>
              </TableCell>
              <TableCell>{formatMoney(item.pricePerDaySnapshotKopecks)}</TableCell>
              <TableCell>{formatMoney(item.depositSnapshotKopecks)}</TableCell>
              <TableCell>{item.bicycle.pickupAddress}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SelectedAdminOrderItemsTable({ order }: { order: AdminOrderDto }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Велосипед</TableHead>
            <TableHead>Снимок цены</TableHead>
            <TableHead>Текущий статус</TableHead>
            <TableHead>Ограничения безопасности</TableHead>
            <TableHead>Самовывоз</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{item.bicycle.title}</span>
                  <span className="text-sm text-muted-foreground">{item.bicycle.manufacturer.publicName}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="grid gap-1">
                  <span>{formatMoney(item.pricePerDaySnapshotKopecks)} / день</span>
                  <span className="text-sm text-muted-foreground">Залог {formatMoney(item.depositSnapshotKopecks)}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={liveBicycleStatusVariant(order.status, item.liveBicycle.status)}>
                    {bicycleStatusLabel(item.liveBicycle.status)}
                  </Badge>
                  <Badge variant={item.liveBicycle.manufacturerStatus === 'approved' ? 'secondary' : 'destructive'}>
                    производитель {manufacturerStatusLabel(item.liveBicycle.manufacturerStatus)}
                  </Badge>
                  <Badge variant={item.liveBicycle.deliveryAvailable ? 'secondary' : 'outline'}>
                    {item.liveBicycle.deliveryAvailable ? 'доставка' : 'только самовывоз'}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="grid gap-1 text-sm">
                  <span>Макс. нагрузка {item.liveBicycle.maxLoadKg} кг</span>
                  <span className="text-muted-foreground">
                    Сиденье {item.liveBicycle.seatHeightCm} см, рама {item.liveBicycle.frameLengthCm} см, колесо {item.liveBicycle.wheelDiameterCm} см
                  </span>
                </div>
              </TableCell>
              <TableCell>{item.bicycle.pickupAddress}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function liveBicycleStatusVariant(
  orderStatus: OrderStatus,
  bicycleStatus: BicycleStatus,
): 'default' | 'outline' | 'secondary' | 'destructive' {
  if (bicycleStatus === 'available') return 'secondary'
  if (orderStatus === 'issued' && bicycleStatus === 'rented') return 'secondary'
  if (orderStatus === 'returned' && (bicycleStatus === 'hidden' || bicycleStatus === 'maintenance')) return 'outline'
  return 'destructive'
}

function AdminWarnings({ warnings }: { warnings: AdminOrderWarningDto[] }) {
  if (warnings.length === 0) {
    return (
      <Alert>
        <CircleCheckIcon />
        <AlertTitle>Блокирующих предупреждений нет</AlertTitle>
        <AlertDescription>Проверьте контакты, логистику и примечания по безопасности перед подтверждением.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-2">
      {warnings.map((warning, index) => (
        <Alert
          key={`${warning.type}-${warning.bicycleId ?? 'order'}-${index}`}
          variant={warning.severity === 'error' ? 'destructive' : 'default'}
        >
          {warning.severity === 'error' ? <CircleAlertIcon /> : <AlertTriangleIcon />}
          <AlertTitle>{warning.bicycleTitle ?? 'Предупреждение по заказу'}</AlertTitle>
          <AlertDescription>{formatAdminOrderWarning(warning)}</AlertDescription>
        </Alert>
      ))}
    </div>
  )
}

function StatusHistoryTable({ order }: { order: AdminOrderDto }) {
  if (order.statusHistory.length === 0) {
    return (
      <Alert>
        <ClipboardListIcon />
        <AlertTitle>Истории статусов пока нет</AlertTitle>
        <AlertDescription>Первый переход администратора или клиента будет записан здесь.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Переход</TableHead>
            <TableHead>Автор</TableHead>
            <TableHead>Комментарий</TableHead>
            <TableHead>Создан</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.statusHistory.map((history) => (
            <TableRow key={history.id}>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <OrderStatusBadge status={history.fromStatus} />
                  <OrderStatusBadge status={history.toStatus} />
                </div>
              </TableCell>
              <TableCell>{history.changedByUser.displayName ?? history.changedByUser.email}</TableCell>
              <TableCell>{history.comment ?? '-'}</TableCell>
              <TableCell>{new Date(history.createdAt).toLocaleString('ru-RU')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RequestErrorDetails({ error }: { error: unknown }) {
  if (!(error instanceof ApiRequestError)) return null

  const details = error.details
  if (!details || typeof details !== 'object') return null

  if ('conflicts' in details && Array.isArray(details.conflicts)) {
    return (
      <ul className="mt-2 list-disc pl-4">
        {details.conflicts.map((conflict, index) => (
          <li key={index}>{formatConflict(conflict)}</li>
        ))}
      </ul>
    )
  }

  if ('warnings' in details && Array.isArray(details.warnings)) {
    return (
      <ul className="mt-2 list-disc pl-4">
        {details.warnings.map((warning, index) => (
          <li key={index}>{formatWarning(warning)}</li>
        ))}
      </ul>
    )
  }

  return null
}

function orderDetailErrorDescription(error: unknown) {
  if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') {
    return 'Этот заказ недоступен для текущей клиентской сессии.'
  }

  return formatRequestError(error)
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
