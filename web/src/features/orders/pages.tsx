import { Link, useParams, useSearch } from '@tanstack/react-router'
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
import { formatPaymentType, type StubPaymentAction } from '../payments/model'
import {
  emptyOrderForm,
  formatMoney,
  formatOrderDates,
  orderAdminDetailQueryKey,
  orderAdminListQueryKey,
  orderDetailQueryKey,
  orderStatuses,
  ordersQueryKey,
  parseBicycleIds,
  requestErrorNextStep,
  selectedBicyclesTotal,
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
            <CardDescription>Current and historical rental requests, payment state, and handoff details.</CardDescription>
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
                <EmptyDescription>
                  {scope === 'history'
                    ? 'Returned and cancelled orders will appear here.'
                    : 'Create a request from the public catalog.'}
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
      setNotice('Request cancelled')
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
      setPaymentNotice(`${formatPaymentType(response.payment.type)} payment ${response.payment.status}`)
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
      setPaymentNotice(`${formatPaymentType(response.payment.type)} payment ${response.payment.status}`)
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
        description={orderDetailErrorDescription(orderQuery.error)}
        action={
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{requestErrorNextStep(orderQuery.error)}</p>
            <Button className="w-fit" asChild>
              <Link to="/orders">Back to orders</Link>
            </Button>
          </div>
        }
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
          <CustomerOrderNextStep order={order} />
          <SelectedOrderItemsTable order={order} />

          <CustomerOrderTotals order={order} />

          <CustomerFulfillmentPanel order={order} />

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
              <AlertDescription>The request status has been updated.</AlertDescription>
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
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<OrderStatus | 'all'>('request')
  const queryKey = orderAdminListQueryKey(page, status)
  const ordersQuery = useQuery({
    queryKey,
    enabled: auth.user?.role === 'admin',
    queryFn: () =>
      auth.api.adminOrders({
        page,
        pageSize: adminOrdersPageSize,
        ...(status === 'all' ? {} : { status }),
      }),
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Admin orders"
        title="Login required"
        description="Sign in with an administrator account to review rental requests."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Admin orders"
        title="Access denied"
        description="Your account does not have permission to review rental requests."
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
              Admin orders
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
            <CardDescription>Review rental requests, availability, and status history.</CardDescription>
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
            aria-label="Admin order status filter"
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
                <EmptyDescription>The current status filter did not return any orders.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payments</TableHead>
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
                          <Link to="/admin/orders/$id" params={{ id: order.id }}>Open</Link>
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
      setNotice(`Order ${response.order.status}`)
      setComment('')
      queryClient.setQueryData(orderAdminDetailQueryKey(id), response)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      await queryClient.invalidateQueries({ queryKey: ['orders', response.order.userId] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['manufacturer', 'bicycles'] })
    },
  })

  if (auth.isBootstrapping || orderQuery.isLoading) {
    return <LoadingState message="Loading order..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Admin order"
        title="Login required"
        description="Sign in with an administrator account to review this rental request."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Admin order"
        title="Access denied"
        description="Your account does not have permission to review rental requests."
      />
    )
  }

  if (orderQuery.isError) {
    return (
      <GateCard
        eyebrow="Admin order"
        title="Order unavailable"
        description={formatRequestError(orderQuery.error)}
        action={<Button asChild><Link to="/admin/orders">Back to orders</Link></Button>}
      />
    )
  }

  const order = orderQuery.data?.order
  if (!order) {
    return <LoadingState message="Loading order..." />
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
            <h1 className="text-3xl font-semibold tracking-tight">Admin order</h1>
            <CardDescription>{order.rentalDays} rental day(s), {order.fulfillmentType}</CardDescription>
          </div>
          <CardAction>
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/orders">Back to orders</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>{notice}</AlertTitle>
              <AlertDescription>Status history has been updated.</AlertDescription>
            </Alert>
          )}

          {updateStatus.error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not update order</AlertTitle>
              <AlertDescription>
                {formatRequestError(updateStatus.error)}
                <RequestErrorDetails error={updateStatus.error} />
              </AlertDescription>
            </Alert>
          )}

          {requestPending && errorWarnings.length > 0 && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Confirmation is blocked</AlertTitle>
              <AlertDescription>Resolve availability or catalog state conflicts before confirming.</AlertDescription>
            </Alert>
          )}

          {issueBlockedByWarnings && order.paymentRequirementsMet && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Issuance is blocked</AlertTitle>
              <AlertDescription>Resolve live bicycle or manufacturer state conflicts before issuing.</AlertDescription>
            </Alert>
          )}

          <AdminWarnings warnings={order.availabilityWarnings} />
          <SelectedAdminOrderItemsTable order={order} />

          <div className="grid gap-3 md:grid-cols-4">
            <Fact label="Rental" value={formatMoney(order.rentalAmountKopecks)} />
            <Fact label="Deposit" value={formatMoney(order.depositAmountKopecks)} />
            <Fact label="Delivery" value={formatMoney(order.deliveryAmountKopecks)} />
            <Fact label="Total" value={formatMoney(order.totalAmountKopecks)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Alert>
              <UserRoundIcon />
              <AlertTitle>Customer</AlertTitle>
              <AlertDescription>
                {order.user.displayName ?? order.user.email}, {order.contactName}, {order.contactPhone}
              </AlertDescription>
            </Alert>
            <Alert>
              <MapPinIcon />
              <AlertTitle>{order.fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'}</AlertTitle>
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
                <h2 className="text-base font-semibold">Decision</h2>
                <p className="text-sm text-muted-foreground">
                  {requestPending
                    ? 'Confirm only when availability, logistics, contacts, and safety limits are acceptable.'
                    : 'Confirmed orders can still be cancelled before issue when handoff is no longer possible.'}
                </p>
              </div>
              <Textarea
                className="min-h-24"
                disabled={updateStatus.isPending}
                placeholder="Comment for status history"
                value={comment}
                aria-label="Admin order comment"
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
                  Cancel
                </Button>
                {requestPending && (
                  <Button
                    type="button"
                    disabled={updateStatus.isPending || errorWarnings.length > 0}
                    onClick={() => updateStatus.mutate({ status: 'confirmed', comment })}
                  >
                    <ShieldCheckIcon data-icon="inline-start" />
                    Confirm
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

function SelectedAdminOrderItemsTable({ order }: { order: AdminOrderDto }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Bicycle</TableHead>
            <TableHead>Snapshot</TableHead>
            <TableHead>Live status</TableHead>
            <TableHead>Safety limits</TableHead>
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
              <TableCell>
                <div className="grid gap-1">
                  <span>{formatMoney(item.pricePerDaySnapshotKopecks)} / day</span>
                  <span className="text-sm text-muted-foreground">Deposit {formatMoney(item.depositSnapshotKopecks)}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={liveBicycleStatusVariant(order.status, item.liveBicycle.status)}>
                    {item.liveBicycle.status}
                  </Badge>
                  <Badge variant={item.liveBicycle.manufacturerStatus === 'approved' ? 'secondary' : 'destructive'}>
                    maker {item.liveBicycle.manufacturerStatus}
                  </Badge>
                  <Badge variant={item.liveBicycle.deliveryAvailable ? 'secondary' : 'outline'}>
                    {item.liveBicycle.deliveryAvailable ? 'delivery' : 'pickup only'}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="grid gap-1 text-sm">
                  <span>Max load {item.liveBicycle.maxLoadKg} kg</span>
                  <span className="text-muted-foreground">
                    Seat {item.liveBicycle.seatHeightCm} cm, frame {item.liveBicycle.frameLengthCm} cm, wheel {item.liveBicycle.wheelDiameterCm} cm
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
        <AlertTitle>No blocking availability warnings</AlertTitle>
        <AlertDescription>Review contacts, logistics, and safety notes before confirming.</AlertDescription>
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
          <AlertTitle>{warning.bicycleTitle ?? 'Order warning'}</AlertTitle>
          <AlertDescription>{warning.message}</AlertDescription>
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
        <AlertTitle>No status history yet</AlertTitle>
        <AlertDescription>The first administrator or customer transition will be recorded here.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Transition</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Comment</TableHead>
            <TableHead>Created</TableHead>
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
              <TableCell>{new Date(history.createdAt).toLocaleString()}</TableCell>
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
    return 'This order is not available for the current customer session.'
  }

  return formatRequestError(error)
}

function formatConflict(value: unknown) {
  if (!value || typeof value !== 'object') return 'Availability conflict'
  const conflict = value as {
    bicycleTitle?: unknown
    conflictingOrderId?: unknown
    startsOn?: unknown
    endsOn?: unknown
  }
  const title = typeof conflict.bicycleTitle === 'string' ? conflict.bicycleTitle : 'Bicycle'
  const orderId = typeof conflict.conflictingOrderId === 'string' ? conflict.conflictingOrderId : 'another order'
  const startsOn = typeof conflict.startsOn === 'string' ? conflict.startsOn : '?'
  const endsOn = typeof conflict.endsOn === 'string' ? conflict.endsOn : '?'
  return `${title} conflicts with ${orderId} (${startsOn} - ${endsOn}).`
}

function formatWarning(value: unknown) {
  if (!value || typeof value !== 'object') return 'Availability warning'
  const warning = value as { message?: unknown }
  return typeof warning.message === 'string' ? warning.message : 'Availability warning'
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
