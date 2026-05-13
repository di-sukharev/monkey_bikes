import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { OrderListScope, OrderStatus } from '@web-app-demo/contracts'
import { BikeIcon, ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, ClipboardListIcon } from 'lucide-react'
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import { pageShellClass } from '@/lib/page-layout'
import { formatRequestError } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'
import {
  ManufacturerOrderChecklists,
  ManufacturerOrderFilters,
  ManufacturerOrderFulfillmentPanel,
  ManufacturerOrderItemsTable,
  ManufacturerOrderNextStep,
  ManufacturerOrdersTable,
  ManufacturerOrderTotals,
} from './manufacturer-order-panels'
import {
  manufacturerOrderDetailQueryKey,
  manufacturerOrdersQueryKey,
  requestErrorNextStep,
} from './model'
import { OrderStatusBadge } from './status-badge'

const manufacturerOrdersPageSize = 20

export function ManufacturerOrdersPage() {
  const auth = useAuth()
  const [page, setPage] = useState(1)
  const [scope, setScope] = useState<OrderListScope>('current')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const queryKey = manufacturerOrdersQueryKey(auth.user?.id, page, scope, status)

  const ordersQuery = useQuery({
    queryKey,
    enabled: auth.user?.role === 'manufacturer',
    queryFn: () =>
      auth.api.manufacturerOrders({
        page,
        pageSize: manufacturerOrdersPageSize,
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
        eyebrow="Заказы производителя"
        title="Нужен вход"
        description="Войдите под производителем, чтобы смотреть связанные заказы аренды."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'manufacturer') {
    return (
      <GateCard
        eyebrow="Заказы производителя"
        title="Доступ запрещен"
        description="Ваш аккаунт не зарегистрирован как производитель."
      />
    )
  }

  const data = ordersQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / manufacturerOrdersPageSize))

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Заказы производителя
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Связанные заказы</h1>
            <CardDescription>Смотрите заказы с вашими велосипедами, состояние передачи и историю чеклистов.</CardDescription>
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
          <ManufacturerOrderFilters
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
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Загружаем связанные заказы...
            </div>
          )}

          {ordersQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить связанные заказы</AlertTitle>
              <AlertDescription>{formatRequestError(ordersQuery.error)}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardListIcon />
                </EmptyMedia>
                <EmptyTitle>Связанные заказы не найдены.</EmptyTitle>
                <EmptyDescription>Заказы с вашими велосипедами появятся здесь после создания клиентских заявок.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && <ManufacturerOrdersTable orders={data.items} />}
        </CardContent>
      </Card>

      {data && totalPages > 1 && (
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
      )}
    </section>
  )
}

export function ManufacturerOrderDetailPage() {
  const auth = useAuth()
  const { id } = useParams({ strict: false }) as { id: string }
  const orderQuery = useQuery({
    queryKey: manufacturerOrderDetailQueryKey(auth.user?.id, id),
    enabled: auth.user?.role === 'manufacturer',
    queryFn: () => auth.api.manufacturerOrder(id),
  })

  if (auth.isBootstrapping || orderQuery.isLoading) {
    return <LoadingState message="Загружаем связанный заказ..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Заказ производителя"
        title="Нужен вход"
        description="Войдите под производителем, чтобы просмотреть этот заказ."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'manufacturer') {
    return (
      <GateCard
        eyebrow="Заказ производителя"
        title="Доступ запрещен"
        description="Ваш аккаунт не зарегистрирован как производитель."
      />
    )
  }

  if (orderQuery.isError) {
    return (
      <GateCard
        eyebrow="Заказ производителя"
        title="Заказ недоступен"
        description={formatRequestError(orderQuery.error)}
        action={
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{requestErrorNextStep(orderQuery.error)}</p>
            <Button className="w-fit" asChild>
              <Link to="/manufacturer/orders">Назад к связанным заказам</Link>
            </Button>
          </div>
        }
      />
    )
  }

  const order = orderQuery.data?.order

  if (!order) {
    return <LoadingState message="Загружаем связанный заказ..." />
  }

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Заказ производителя
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Заказ {order.id}</h1>
            <CardDescription>Показаны только ваши велосипеды, ваши суммы и история ваших чеклистов.</CardDescription>
          </div>
          <CardAction>
            <OrderStatusBadge status={order.status} />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          <ManufacturerOrderNextStep order={order} />
          <ManufacturerOrderTotals order={order} />
          <ManufacturerOrderFulfillmentPanel order={order} />
          <ManufacturerOrderItemsTable order={order} />
          <section className="grid gap-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <BikeIcon className="size-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">История выдачи и возврата</h2>
            </div>
            <ManufacturerOrderChecklists checklists={order.checklists} />
          </section>
        </CardContent>
      </Card>
    </section>
  )
}
