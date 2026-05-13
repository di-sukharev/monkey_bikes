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
import { formatMoney, requestErrorNextStep } from '../orders/model'
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
          <h2 className="text-base font-semibold">Платежи</h2>
          <p className="text-sm text-muted-foreground">
            Оплата аренды и залога выполняется отдельными тестовыми попытками.
          </p>
        </div>
        <Badge variant={order.paymentRequirementsMet ? 'secondary' : 'outline'}>
          {order.paymentRequirementsMet ? 'оплачено' : 'оплачено не полностью'}
        </Badge>
      </div>

      {order.status === 'request' && !order.paymentRequirementsMet && (
        <Alert>
          <CreditCardIcon />
          <AlertTitle>Ожидается подтверждение</AlertTitle>
          <AlertDescription>Платежи становятся доступны после подтверждения администратором.</AlertDescription>
        </Alert>
      )}

      {(order.status === 'cancelled' || order.status === 'returned') && !order.paymentRequirementsMet && (
        <Alert>
          <BanIcon />
          <AlertTitle>Платежи недоступны</AlertTitle>
          <AlertDescription>Этот статус заказа не принимает новые платежные попытки.</AlertDescription>
        </Alert>
      )}

      {mode === 'admin' && order.status === 'confirmed' && !order.paymentRequirementsMet && (
        <Alert>
          <CircleAlertIcon />
          <AlertTitle>Выдача заблокирована</AlertTitle>
          <AlertDescription>Перед выдачей должны быть успешно оплачены и аренда, и залог.</AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>{notice}</AlertTitle>
          <AlertDescription>Статус платежа обновлен.</AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Действие с платежом не удалось</AlertTitle>
          <AlertDescription>
            {formatRequestError(error)}
            <span className="mt-1 block">{requestErrorNextStep(error)}</span>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[780px]">
          <TableHeader>
            <TableRow>
              <TableHead>Тип</TableHead>
              <TableHead>Сумма</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Попытка</TableHead>
              {interactive && <TableHead className="w-[260px]">Действия</TableHead>}
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
                    {latestPayment ? <PaymentStatusBadge status={latestPayment.status} /> : <Badge variant="outline">не создан</Badge>}
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
            {payment ? <PaymentStatusBadge status={payment.status} /> : <Badge variant="outline">нет</Badge>}
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
    return <span className="text-sm text-muted-foreground">Завершен</span>
  }

  if (activePaymentId) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          aria-label={`Отметить платеж ${formatPaymentType(type)} как успешный`}
          disabled={completing}
          onClick={() => onComplete?.(activePaymentId, 'stub-success')}
        >
          {completing && pendingAction?.action === 'stub-success' ? <Spinner /> : <CheckCircle2Icon data-icon="inline-start" />}
          Успех
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Отметить платеж ${formatPaymentType(type)} как ошибочный`}
          disabled={completing}
          onClick={() => onComplete?.(activePaymentId, 'stub-fail')}
        >
          {completing && pendingAction?.action === 'stub-fail' ? <Spinner /> : <XCircleIcon data-icon="inline-start" />}
          Ошибка
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Отменить платеж ${formatPaymentType(type)}`}
          disabled={completing}
          onClick={() => onComplete?.(activePaymentId, 'stub-cancel')}
        >
          {completing && pendingAction?.action === 'stub-cancel' ? <Spinner /> : <BanIcon data-icon="inline-start" />}
          Отменить
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
        aria-label={`${latestStatus === 'failed' || latestStatus === 'cancelled' ? 'Повторить' : 'Создать'} платеж ${formatPaymentType(type)}`}
        disabled={createPending}
        onClick={() => onCreate?.(type)}
      >
        {createPending ? <Spinner /> : <RotateCcwIcon data-icon="inline-start" />}
        {latestStatus === 'failed' || latestStatus === 'cancelled' ? 'Повторить' : 'Создать'}
      </Button>
    )
  }

  return <span className="text-sm text-muted-foreground">Недоступно</span>
}
