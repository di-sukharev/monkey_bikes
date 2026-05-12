import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { PaymentStatus, PaymentType } from '@web-app-demo/contracts'
import { ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, CreditCardIcon } from 'lucide-react'
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
import { formatMoney } from '../orders/model'
import {
  formatPaymentType,
  paymentAdminListQueryKey,
  paymentStatuses,
  paymentTypes,
} from './model'
import { PaymentStatusBadge } from './status-badge'

const adminPaymentsPageSize = 20

export function AdminPaymentsPage() {
  const auth = useAuth()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all')
  const [type, setType] = useState<PaymentType | 'all'>('all')
  const paymentsQuery = useQuery({
    queryKey: paymentAdminListQueryKey(page, status, type),
    enabled: auth.user?.role === 'admin',
    queryFn: () =>
      auth.api.adminPayments({
        page,
        pageSize: adminPaymentsPageSize,
        ...(status === 'all' ? {} : { status }),
        ...(type === 'all' ? {} : { type }),
      }),
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Admin payments"
        title="Login required"
        description="Sign in with an administrator account to review payments."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Admin payments"
        title="Access denied"
        description="Your account does not have permission to review payments."
      />
    )
  }

  const data = paymentsQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / adminPaymentsPageSize))

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Admin payments
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Payments</h1>
            <CardDescription>Stub rent and deposit payment attempts.</CardDescription>
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
          <div className="flex flex-wrap gap-2">
            <NativeSelect
              aria-label="Payment status filter"
              className="w-full max-w-56"
              value={status}
              onChange={(event) => {
                setPage(1)
                setStatus(event.target.value as PaymentStatus | 'all')
              }}
            >
              <NativeSelectOption value="all">All statuses</NativeSelectOption>
              {paymentStatuses.map((nextStatus) => (
                <NativeSelectOption key={nextStatus} value={nextStatus}>
                  {nextStatus}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Payment type filter"
              className="w-full max-w-56"
              value={type}
              onChange={(event) => {
                setPage(1)
                setType(event.target.value as PaymentType | 'all')
              }}
            >
              <NativeSelectOption value="all">All types</NativeSelectOption>
              {paymentTypes.map((nextType) => (
                <NativeSelectOption key={nextType} value={nextType}>
                  {formatPaymentType(nextType)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {paymentsQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading payments...
            </div>
          )}

          {paymentsQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load payments</AlertTitle>
              <AlertDescription>{formatRequestError(paymentsQuery.error)}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CreditCardIcon />
                </EmptyMedia>
                <EmptyTitle>No payments found.</EmptyTitle>
                <EmptyDescription>The current filters did not return payment attempts.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="w-[140px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="grid gap-1">
                          <span className="font-medium">{formatPaymentType(payment.type)}</span>
                          <span className="break-all text-sm text-muted-foreground">{payment.providerPaymentId}</span>
                        </div>
                      </TableCell>
                      <TableCell><PaymentStatusBadge status={payment.status} /></TableCell>
                      <TableCell>{formatMoney(payment.amountKopecks)}</TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          <span>{payment.order.startsOn} - {payment.order.endsOn}</span>
                          <span className="text-sm text-muted-foreground">{payment.order.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          <span>{payment.order.user.displayName ?? payment.order.user.email}</span>
                          {payment.order.user.displayName && (
                            <span className="break-all text-sm text-muted-foreground">{payment.order.user.email}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link to="/admin/orders/$id" params={{ id: payment.order.id }}>Open</Link>
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
              disabled={page <= 1 || paymentsQuery.isFetching}
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
              disabled={page >= totalPages || paymentsQuery.isFetching}
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
