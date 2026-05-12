import type { OrderDto, PaymentType } from '@web-app-demo/contracts'
import {
  BanIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CreditCardIcon,
  RotateCcwIcon,
  XCircleIcon,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRequestError } from '@/lib/request-error'
import { formatMoney } from '../orders/model'
import {
  activePaymentFor,
  canCreatePayment,
  formatPaymentType,
  latestPaymentFor,
  paymentAmountFor,
  paymentTypes,
  type StubPaymentAction,
} from './model'
import { PaymentStatusBadge } from './status-badge'

export type PendingPaymentAction =
  | { kind: 'complete'; action: StubPaymentAction; paymentId: string }
  | { kind: 'create'; type: PaymentType }
  | null

type OrderPaymentsPanelProps = {
  order: OrderDto
  mode: 'admin' | 'user'
  error?: unknown
  notice?: string | null
  pendingAction?: PendingPaymentAction
  onComplete?: (paymentId: string, action: StubPaymentAction) => void
  onCreate?: (type: PaymentType) => void
}

export function OrderPaymentsPanel({
  order,
  mode,
  error,
  notice,
  pendingAction = null,
  onComplete,
  onCreate,
}: OrderPaymentsPanelProps) {
  const interactive = mode === 'user' && order.status === 'confirmed'

  return (
    <section className="grid gap-3 border-t pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold">Payments</h2>
          <p className="text-sm text-muted-foreground">
            Rent and deposit payments are separate stub attempts.
          </p>
        </div>
        <Badge variant={order.paymentRequirementsMet ? 'secondary' : 'outline'}>
          {order.paymentRequirementsMet ? 'paid' : 'not fully paid'}
        </Badge>
      </div>

      {order.status === 'request' && !order.paymentRequirementsMet && (
        <Alert>
          <CreditCardIcon />
          <AlertTitle>Waiting for confirmation</AlertTitle>
          <AlertDescription>Payments become available after administrator confirmation.</AlertDescription>
        </Alert>
      )}

      {(order.status === 'cancelled' || order.status === 'returned') && !order.paymentRequirementsMet && (
        <Alert>
          <BanIcon />
          <AlertTitle>Payments unavailable</AlertTitle>
          <AlertDescription>This order status does not accept new payment attempts.</AlertDescription>
        </Alert>
      )}

      {mode === 'admin' && order.status === 'confirmed' && !order.paymentRequirementsMet && (
        <Alert>
          <CircleAlertIcon />
          <AlertTitle>Issuance is blocked</AlertTitle>
          <AlertDescription>Both rent and deposit payments must be successful before issuance.</AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>{notice}</AlertTitle>
          <AlertDescription>Payment status has been updated.</AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Payment action failed</AlertTitle>
          <AlertDescription>{formatRequestError(error)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[780px]">
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempt</TableHead>
              {interactive && <TableHead className="w-[260px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentTypes.map((type) => {
              const latestPayment = latestPaymentFor(order, type)
              const activePayment = activePaymentFor(order, type)
              const createAllowed = canCreatePayment(order, type)

              return (
                <TableRow key={type}>
                  <TableCell className="font-medium">{formatPaymentType(type)}</TableCell>
                  <TableCell>{formatMoney(paymentAmountFor(order, type))}</TableCell>
                  <TableCell>
                    {latestPayment ? <PaymentStatusBadge status={latestPayment.status} /> : <Badge variant="outline">not created</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1 text-sm">
                      <span>{latestPayment?.providerPaymentId ?? '-'}</span>
                      {latestPayment?.failureReason && (
                        <span className="text-muted-foreground">{latestPayment.failureReason}</span>
                      )}
                    </div>
                  </TableCell>
                  {interactive && (
                    <TableCell>
                      <PaymentActions
                        activePaymentId={activePayment?.id ?? null}
                        createAllowed={createAllowed}
                        latestStatus={latestPayment?.status ?? null}
                        pendingAction={pendingAction}
                        type={type}
                        onComplete={onComplete}
                        onCreate={onCreate}
                      />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

export function PaymentStatusSummary({ order }: { order: OrderDto }) {
  return (
    <div className="flex flex-wrap gap-2">
      {paymentTypes.map((type) => {
        const payment = latestPaymentFor(order, type)
        return (
          <span key={type} className="inline-flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{formatPaymentType(type)}</span>
            {payment ? <PaymentStatusBadge status={payment.status} /> : <Badge variant="outline">none</Badge>}
          </span>
        )
      })}
    </div>
  )
}

function PaymentActions({
  activePaymentId,
  createAllowed,
  latestStatus,
  pendingAction,
  type,
  onComplete,
  onCreate,
}: {
  activePaymentId: string | null
  createAllowed: boolean
  latestStatus: string | null
  pendingAction: PendingPaymentAction
  type: PaymentType
  onComplete?: (paymentId: string, action: StubPaymentAction) => void
  onCreate?: (type: PaymentType) => void
}) {
  const createPending = pendingAction?.kind === 'create' && pendingAction.type === type
  const completing = pendingAction?.kind === 'complete' && pendingAction.paymentId === activePaymentId

  if (latestStatus === 'succeeded') {
    return <span className="text-sm text-muted-foreground">Completed</span>
  }

  if (activePaymentId) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          aria-label={`Mark ${formatPaymentType(type)} payment as succeeded`}
          disabled={completing}
          onClick={() => onComplete?.(activePaymentId, 'stub-success')}
        >
          {completing && pendingAction?.action === 'stub-success' ? <Spinner /> : <CheckCircle2Icon data-icon="inline-start" />}
          Success
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Mark ${formatPaymentType(type)} payment as failed`}
          disabled={completing}
          onClick={() => onComplete?.(activePaymentId, 'stub-fail')}
        >
          {completing && pendingAction?.action === 'stub-fail' ? <Spinner /> : <XCircleIcon data-icon="inline-start" />}
          Fail
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Cancel ${formatPaymentType(type)} payment`}
          disabled={completing}
          onClick={() => onComplete?.(activePaymentId, 'stub-cancel')}
        >
          {completing && pendingAction?.action === 'stub-cancel' ? <Spinner /> : <BanIcon data-icon="inline-start" />}
          Cancel
        </Button>
      </div>
    )
  }

  if (createAllowed) {
    return (
      <Button
        type="button"
        size="sm"
        variant={latestStatus === 'failed' || latestStatus === 'cancelled' ? 'outline' : 'default'}
        aria-label={`${latestStatus === 'failed' || latestStatus === 'cancelled' ? 'Retry' : 'Create'} ${formatPaymentType(type)} payment`}
        disabled={createPending}
        onClick={() => onCreate?.(type)}
      >
        {createPending ? <Spinner /> : <RotateCcwIcon data-icon="inline-start" />}
        {latestStatus === 'failed' || latestStatus === 'cancelled' ? 'Retry' : 'Create'}
      </Button>
    )
  }

  return <span className="text-sm text-muted-foreground">Unavailable</span>
}
