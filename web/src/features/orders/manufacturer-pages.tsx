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
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Manufacturer orders"
        title="Login required"
        description="Sign in with a manufacturer account to review related rental orders."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'manufacturer') {
    return (
      <GateCard
        eyebrow="Manufacturer orders"
        title="Access denied"
        description="Your account is not registered as a manufacturer."
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
              Manufacturer orders
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Related orders</h1>
            <CardDescription>Review orders that include your bicycles, handoff state, and checklist history.</CardDescription>
          </div>
          {data && (
            <CardAction>
              <Badge variant="secondary">
                {data.total} total, page {data.page} of {totalPages}
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
              Loading related orders...
            </div>
          )}

          {ordersQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load related orders</AlertTitle>
              <AlertDescription>{formatRequestError(ordersQuery.error)}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardListIcon />
                </EmptyMedia>
                <EmptyTitle>No related orders found.</EmptyTitle>
                <EmptyDescription>Orders containing your bicycles will appear here after customers create requests.</EmptyDescription>
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
                Previous
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
                Next
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
    return <LoadingState message="Loading related order..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Manufacturer order"
        title="Login required"
        description="Sign in with a manufacturer account to review this order."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'manufacturer') {
    return (
      <GateCard
        eyebrow="Manufacturer order"
        title="Access denied"
        description="Your account is not registered as a manufacturer."
      />
    )
  }

  if (orderQuery.isError) {
    return (
      <GateCard
        eyebrow="Manufacturer order"
        title="Order unavailable"
        description={formatRequestError(orderQuery.error)}
        action={
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{requestErrorNextStep(orderQuery.error)}</p>
            <Button className="w-fit" asChild>
              <Link to="/manufacturer/orders">Back to related orders</Link>
            </Button>
          </div>
        }
      />
    )
  }

  const order = orderQuery.data?.order

  if (!order) {
    return <LoadingState message="Loading related order..." />
  }

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Manufacturer order
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Order {order.id}</h1>
            <CardDescription>Only your bicycles, your subtotals, and your checklist history are shown.</CardDescription>
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
              <h2 className="text-base font-semibold">Issue and return history</h2>
            </div>
            <ManufacturerOrderChecklists checklists={order.checklists} />
          </section>
        </CardContent>
      </Card>
    </section>
  )
}
