import { Link, useParams, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OrderDto, OrderStatus, PublicBicycleDto } from '@web-app-demo/contracts'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClipboardListIcon,
  MapPinIcon,
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { pageShellClass } from '@/lib/page-layout'
import { formatRequestError } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'
import { OrderForm } from './order-form'
import {
  emptyOrderForm,
  formatMoney,
  formatOrderDates,
  orderDetailQueryKey,
  orderStatuses,
  ordersQueryKey,
  parseBicycleIds,
  selectedBicyclesTotal,
} from './model'
import { OrderStatusBadge } from './status-badge'

const ordersPageSize = 20

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
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Rental request"
        title="Login required"
        description="Sign in as a customer to create a rental request."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'user') {
    return (
      <GateCard
        eyebrow="Rental request"
        title="Customer account required"
        description="Rental requests can be created from a customer account."
      />
    )
  }

  if (bicycleIds.length === 0) {
    return (
      <GateCard
        eyebrow="Rental request"
        title="No bicycles selected"
        description="Select one or more bicycles from the catalog before creating a request."
        action={<Button asChild><Link to="/bicycles">Open catalog</Link></Button>}
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
              Rental request
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Create request</h1>
            <CardDescription>Selected bicycles, dates, fulfillment, contacts, and safety agreement.</CardDescription>
          </div>
          <CardAction>
            <Button type="button" variant="outline" asChild>
              <Link to="/bicycles">Back to catalog</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {selectedBicyclesQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading selected bicycles...
            </div>
          )}

          {selectedBicyclesQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load selected bicycles</AlertTitle>
              <AlertDescription>{formatRequestError(selectedBicyclesQuery.error)}</AlertDescription>
            </Alert>
          )}

          {selectedBicycles.length > 0 && (
            <SelectedBicyclesTable bicycles={selectedBicycles} />
          )}

          {selectedBicycles.length > 0 && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Backend-calculated request</AlertTitle>
              <AlertDescription>
                Selected daily total {formatMoney(totals.daily)} and deposit {formatMoney(totals.deposit)}. Final
                rental days and totals are calculated by the backend when the request is created.
              </AlertDescription>
            </Alert>
          )}

          {createdOrderId && (
            <Alert>
              <ClipboardListIcon />
              <AlertTitle>Request created</AlertTitle>
              <AlertDescription>
                Rental request is saved and visible in your orders.
              </AlertDescription>
            </Alert>
          )}

          {createOrder.error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not create request</AlertTitle>
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
                <Link to="/orders/$id" params={{ id: createdOrderId }}>Open request</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/orders">My orders</Link>
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
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const queryKey = ordersQueryKey(auth.user?.id, page, status)

  const ordersQuery = useQuery({
    queryKey,
    enabled: auth.user?.role === 'user',
    queryFn: () =>
      auth.api.orders({
        page,
        pageSize: ordersPageSize,
        ...(status === 'all' ? {} : { status }),
      }),
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Orders"
        title="Login required"
        description="Sign in as a customer to view rental requests."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'user') {
    return (
      <GateCard
        eyebrow="Orders"
        title="Customer account required"
        description="Rental requests are available for customer accounts."
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
              Orders
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">My orders</h1>
            <CardDescription>Rental requests and current order statuses.</CardDescription>
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
          <NativeSelect
            aria-label="Order status filter"
            className="w-full max-w-56"
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value as OrderStatus | 'all')
            }}
          >
            <NativeSelectOption value="all">All statuses</NativeSelectOption>
            {orderStatuses.map((nextStatus) => (
              <NativeSelectOption key={nextStatus} value={nextStatus}>
                {nextStatus}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          {ordersQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading orders...
            </div>
          )}

          {ordersQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load orders</AlertTitle>
              <AlertDescription>{formatRequestError(ordersQuery.error)}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardListIcon />
                </EmptyMedia>
                <EmptyTitle>No orders found.</EmptyTitle>
                <EmptyDescription>Create a request from the public catalog.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="w-[140px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="grid gap-1">
                          <span className="font-medium">{order.items.map((item) => item.bicycle.title).join(', ')}</span>
                          <span className="text-sm text-muted-foreground">{order.fulfillmentType}</span>
                        </div>
                      </TableCell>
                      <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                      <TableCell>{formatOrderDates(order)}</TableCell>
                      <TableCell>{formatMoney(order.totalAmountKopecks)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link to="/orders/$id" params={{ id: order.id }}>Open</Link>
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
    </section>
  )
}

export function OrderDetailPage() {
  const auth = useAuth()
  const { id } = useParams({ strict: false }) as { id: string }
  const orderQuery = useQuery({
    queryKey: orderDetailQueryKey(auth.user?.id, id),
    enabled: auth.user?.role === 'user',
    queryFn: () => auth.api.order(id),
  })

  if (auth.isBootstrapping || orderQuery.isLoading) {
    return <LoadingState message="Loading order..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Order"
        title="Login required"
        description="Sign in as a customer to view this order."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'user') {
    return (
      <GateCard
        eyebrow="Order"
        title="Customer account required"
        description="Rental requests are available for customer accounts."
      />
    )
  }

  if (orderQuery.isError) {
    return (
      <GateCard
        eyebrow="Order"
        title="Order unavailable"
        description={formatRequestError(orderQuery.error)}
        action={<Button asChild><Link to="/orders">Back to orders</Link></Button>}
      />
    )
  }

  const order = orderQuery.data?.order

  if (!order) {
    return <LoadingState message="Loading order..." />
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
            <h1 className="text-3xl font-semibold tracking-tight">Rental request</h1>
            <CardDescription>{order.rentalDays} rental day(s), {order.fulfillmentType}</CardDescription>
          </div>
          <CardAction>
            <Button type="button" variant="outline" asChild>
              <Link to="/orders">Back to orders</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          <SelectedOrderItemsTable order={order} />

          <div className="grid gap-3 md:grid-cols-4">
            <Fact label="Rental" value={formatMoney(order.rentalAmountKopecks)} />
            <Fact label="Deposit" value={formatMoney(order.depositAmountKopecks)} />
            <Fact label="Delivery" value={formatMoney(order.deliveryAmountKopecks)} />
            <Fact label="Total" value={formatMoney(order.totalAmountKopecks)} />
          </div>

          <Alert>
            <MapPinIcon />
            <AlertTitle>{order.fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'}</AlertTitle>
            <AlertDescription>
              {order.fulfillmentType === 'delivery'
                ? order.deliveryAddress
                : order.items.map((item) => item.bicycle.pickupAddress).join('; ')}
            </AlertDescription>
          </Alert>

          <Alert>
            <CircleCheckIcon />
            <AlertTitle>Contact</AlertTitle>
            <AlertDescription>{order.contactName}, {order.contactPhone}</AlertDescription>
          </Alert>

          {order.userComment && (
            <Alert>
              <ClipboardListIcon />
              <AlertTitle>Comment</AlertTitle>
              <AlertDescription>{order.userComment}</AlertDescription>
            </Alert>
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
            <TableHead>Bicycle</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Daily</TableHead>
            <TableHead>Deposit</TableHead>
            <TableHead>Delivery</TableHead>
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
              <TableCell>{bicycle.deliveryAvailable ? 'Available' : 'Pickup only'}</TableCell>
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
            <TableHead>Bicycle</TableHead>
            <TableHead>Daily snapshot</TableHead>
            <TableHead>Deposit snapshot</TableHead>
            <TableHead>Pickup</TableHead>
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
