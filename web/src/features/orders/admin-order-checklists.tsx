import type {
  AdminOrderChecklistInput,
  AdminOrderDto,
  AdminOrderStatusUpdateInput,
  OrderChecklistBicycleAction,
  OrderChecklistCondition,
  OrderChecklistDto,
  OrderChecklistType,
} from '@web-app-demo/contracts'
import { adminOrderStatusUpdateRequestSchema } from '@web-app-demo/contracts'
import {
  CircleCheckIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CircleAlertIcon,
  Undo2Icon,
} from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatFormError } from '@/lib/form-errors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
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

type ChecklistConditionKey =
  | 'frameCondition'
  | 'wheelsCondition'
  | 'handlebarCondition'
  | 'saddleCondition'
  | 'brakesCondition'
  | 'exteriorCondition'

type ChecklistDraft = Record<ChecklistConditionKey, OrderChecklistCondition> & {
  safetyAction: OrderChecklistBicycleAction
  comment: string
}

const conditionFields: Array<{ key: ChecklistConditionKey; label: string }> = [
  { key: 'frameCondition', label: 'Рама' },
  { key: 'wheelsCondition', label: 'Колеса' },
  { key: 'handlebarCondition', label: 'Руль' },
  { key: 'saddleCondition', label: 'Седло' },
  { key: 'brakesCondition', label: 'Тормоза' },
  { key: 'exteriorCondition', label: 'Внешний вид' },
]

const conditionOptions: OrderChecklistCondition[] = [
  'ok',
  'worn',
  'damaged',
  'unsafe',
  'not_applicable',
]

const safetyActions: OrderChecklistBicycleAction[] = ['none', 'maintenance', 'hidden']

const typeLabels: Record<OrderChecklistType, string> = {
  issue: 'Выдача',
  return: 'Возврат',
}

export function AdminOrderChecklistsTable({ order }: { order: AdminOrderDto }) {
  if (order.checklists.length === 0) {
    return (
      <Alert>
        <ClipboardListIcon />
        <AlertTitle>Чеклистов пока нет</AlertTitle>
        <AlertDescription>Чеклисты выдачи и возврата будут записаны здесь вместе с администратором, который их заполнил.</AlertDescription>
      </Alert>
    )
  }

  const bicycleTitles = new Map(order.items.map((item) => [item.bicycleId, item.bicycle.title]))

  return (
    <section className="grid gap-3 border-t pt-4">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">Чеклисты</h2>
        <p className="text-sm text-muted-foreground">
          Зафиксированное состояние велосипеда при выдаче и возврате.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Тип</TableHead>
              <TableHead>Велосипед</TableHead>
              <TableHead>Состояние</TableHead>
              <TableHead>Действие в каталоге</TableHead>
              <TableHead>Комментарий</TableHead>
              <TableHead>Автор</TableHead>
              <TableHead>Проверено</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.checklists.map((checklist) => (
              <TableRow key={checklist.id}>
                <TableCell><ChecklistTypeBadge type={checklist.type} /></TableCell>
                <TableCell className="font-medium">
                  {bicycleTitles.get(checklist.bicycleId) ?? checklist.bicycleId}
                </TableCell>
                <TableCell>
                  <ConditionSummary checklist={checklist} />
                </TableCell>
                <TableCell>{formatSafetyAction(checklist.safetyAction)}</TableCell>
                <TableCell>{checklist.comment ?? '-'}</TableCell>
                <TableCell>{checklist.checkedByUser.displayName ?? checklist.checkedByUser.email}</TableCell>
                <TableCell>{new Date(checklist.checkedAt).toLocaleString('ru-RU')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

export function AdminOrderChecklistTransitionPanel({
  disabled,
  order,
  type,
  onSubmit,
}: {
  disabled: boolean
  order: AdminOrderDto
  type: OrderChecklistType
  onSubmit: (input: AdminOrderStatusUpdateInput) => void
}) {
  const [comment, setComment] = useState('')
  const [drafts, setDrafts] = useState<Record<string, ChecklistDraft>>(() => initialDrafts(order, type))
  const [submitError, setSubmitError] = useState<string | null>(null)
  const status = type === 'issue' ? 'issued' : 'returned'
  const submitLabel = type === 'issue' ? 'Выдать заказ' : 'Вернуть заказ'
  const transitionPayload = adminOrderStatusUpdateRequestSchema.safeParse({
    status,
    comment,
    checklists: order.items.map((item) => toChecklistInput(item.bicycleId, drafts[item.bicycleId], type)),
  })

  return (
    <section className="grid gap-3 border-t pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold">{typeLabels[type]} чеклист</h2>
          <p className="text-sm text-muted-foreground">
            Для каждого велосипеда в заказе нужен отдельный чеклист.
          </p>
        </div>
        <Badge variant="outline">Велосипедов: {order.items.length}</Badge>
      </div>

      {submitError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Не удалось подтвердить переход</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Alert>
        {type === 'issue' ? <ClipboardCheckIcon /> : <Undo2Icon />}
        <AlertTitle>{type === 'issue' ? 'Готов к передаче' : 'Готов к возврату'}</AlertTitle>
        <AlertDescription>
          {type === 'issue'
            ? 'Заказ можно выдать после успешной оплаты аренды и залога, а также проверки состояния.'
            : 'Замечания безопасности при возврате могут перевести велосипед в обслуживание или скрыть из каталога.'}
        </AlertDescription>
      </Alert>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[1280px]">
          <TableHeader>
            <TableRow>
              <TableHead>Велосипед</TableHead>
              {conditionFields.map((field) => (
                <TableHead key={field.key}>{field.label}</TableHead>
              ))}
              {type === 'return' && <TableHead>Действие в каталоге</TableHead>}
              <TableHead>Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => {
              const draft = drafts[item.bicycleId]
              const title = item.bicycle.title

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{title}</span>
                      <span className="text-sm text-muted-foreground">{item.bicycle.size}, {item.bicycle.city}</span>
                    </div>
                  </TableCell>
                  {conditionFields.map((field) => (
                    <TableCell key={field.key}>
                      <NativeSelect
                        aria-label={`${typeLabels[type]}: ${field.label.toLowerCase()} для ${title}`}
                        className="w-36"
                        disabled={disabled}
                        value={draft?.[field.key] ?? 'ok'}
                        onChange={(event) =>
                          updateDraft(item.bicycleId, {
                            [field.key]: event.target.value as OrderChecklistCondition,
                          })}
                      >
                        {conditionOptions.map((condition) => (
                          <NativeSelectOption key={condition} value={condition}>
                            {formatCondition(condition)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                  ))}
                  {type === 'return' && (
                    <TableCell>
                      <NativeSelect
                        aria-label={`Действие безопасности при возврате для ${title}`}
                        className="w-40"
                        disabled={disabled}
                        value={draft?.safetyAction ?? 'none'}
                        onChange={(event) =>
                          updateDraft(item.bicycleId, {
                            safetyAction: event.target.value as OrderChecklistBicycleAction,
                          })}
                      >
                        {safetyActions.map((action) => (
                          <NativeSelectOption key={action} value={action}>
                            {formatSafetyAction(action)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                  )}
                  <TableCell>
                    <Textarea
                      aria-label={`Комментарий чеклиста: ${typeLabels[type].toLowerCase()} для ${title}`}
                      className="min-h-20 w-64"
                      disabled={disabled}
                      placeholder="Необязательная заметка"
                      value={draft?.comment ?? ''}
                      onChange={(event) => {
                        setSubmitError(null)
                        updateDraft(item.bicycleId, {
                          comment: event.target.value,
                        })
                      }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Textarea
        className="min-h-20"
        disabled={disabled}
        placeholder="Комментарий для истории статусов"
        value={comment}
        aria-label={`Комментарий к переходу статуса: ${typeLabels[type].toLowerCase()}`}
        onChange={(event) => {
          setSubmitError(null)
          setComment(event.target.value)
        }}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!transitionPayload.success) {
              setSubmitError(transitionPayload.error.issues.map(formatFormError).join(', '))
              return
            }

            setSubmitError(null)
            onSubmit(transitionPayload.data)
          }}
        >
          {disabled
            ? <Spinner />
            : type === 'issue'
              ? <ClipboardCheckIcon data-icon="inline-start" />
              : <CircleCheckIcon data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </div>
    </section>
  )

  function updateDraft(bicycleId: string, patch: Partial<ChecklistDraft>) {
    setSubmitError(null)
    setDrafts((current) => ({
      ...current,
      [bicycleId]: {
        ...defaultDraft(),
        ...current[bicycleId],
        ...patch,
      },
    }))
  }

function initialDrafts(order: AdminOrderDto, type: OrderChecklistType) {
  const existingByBicycle = new Map(
    order.checklists
      .filter((checklist) => checklist.type === type)
      .map((checklist) => [checklist.bicycleId, checklist]),
  )

  return order.items.reduce<Record<string, ChecklistDraft>>((drafts, item) => {
    drafts[item.bicycleId] = fromExistingChecklist(existingByBicycle.get(item.bicycleId), type)
    return drafts
  }, {})
}

function defaultDraft(): ChecklistDraft {
  return {
    frameCondition: 'ok',
    wheelsCondition: 'ok',
    handlebarCondition: 'ok',
    saddleCondition: 'ok',
    brakesCondition: 'ok',
    exteriorCondition: 'ok',
    safetyAction: 'none',
    comment: '',
  }
}

function fromExistingChecklist(checklist: OrderChecklistDto | undefined, type: OrderChecklistType): ChecklistDraft {
  if (!checklist) return defaultDraft()

  return {
    frameCondition: checklist.frameCondition,
    wheelsCondition: checklist.wheelsCondition,
    handlebarCondition: checklist.handlebarCondition,
    saddleCondition: checklist.saddleCondition,
    brakesCondition: checklist.brakesCondition,
    exteriorCondition: checklist.exteriorCondition,
    safetyAction: type === 'return' ? checklist.safetyAction : 'none',
    comment: checklist.comment ?? '',
  }
}

function toChecklistInput(
  bicycleId: string,
  draft: ChecklistDraft | undefined,
  type: OrderChecklistType,
): AdminOrderChecklistInput {
  const nextDraft = {
    ...defaultDraft(),
    ...draft,
  }

  return {
    bicycleId,
    frameCondition: nextDraft.frameCondition,
    wheelsCondition: nextDraft.wheelsCondition,
    handlebarCondition: nextDraft.handlebarCondition,
    saddleCondition: nextDraft.saddleCondition,
    brakesCondition: nextDraft.brakesCondition,
    exteriorCondition: nextDraft.exteriorCondition,
    safetyAction: type === 'return' ? nextDraft.safetyAction : 'none',
    comment: nextDraft.comment,
  }
}

function ChecklistTypeBadge({ type }: { type: OrderChecklistType }) {
  return <Badge variant={type === 'issue' ? 'secondary' : 'outline'}>{typeLabels[type]}</Badge>
}

function ConditionSummary({ checklist }: { checklist: OrderChecklistDto }) {
  return (
    <div className="flex max-w-[360px] flex-wrap gap-1">
      {conditionFields.map((field) => (
        <Badge
          key={field.key}
          variant={checklist[field.key] === 'ok' || checklist[field.key] === 'not_applicable' ? 'outline' : 'destructive'}
        >
          {field.label}: {formatCondition(checklist[field.key])}
        </Badge>
      ))}
    </div>
  )
}

function formatCondition(condition: OrderChecklistCondition) {
  switch (condition) {
    case 'damaged':
      return 'Повреждено'
    case 'not_applicable':
      return 'Не применимо'
    case 'ok':
      return 'В порядке'
    case 'unsafe':
      return 'Небезопасно'
    case 'worn':
      return 'Изношено'
  }
}

function formatSafetyAction(action: OrderChecklistBicycleAction) {
  switch (action) {
    case 'hidden':
      return 'Скрыть'
    case 'maintenance':
      return 'На обслуживание'
    case 'none':
      return 'Без изменений'
  }
}
