import type {
  AdminOrderChecklistInput,
  AdminOrderDto,
  AdminOrderStatusUpdateInput,
  OrderChecklistBicycleAction,
  OrderChecklistCondition,
  OrderChecklistDto,
  OrderChecklistType,
} from '@web-app-demo/contracts'
import {
  CircleCheckIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  Undo2Icon,
} from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  { key: 'frameCondition', label: 'Frame' },
  { key: 'wheelsCondition', label: 'Wheels' },
  { key: 'handlebarCondition', label: 'Handlebar' },
  { key: 'saddleCondition', label: 'Saddle' },
  { key: 'brakesCondition', label: 'Brakes' },
  { key: 'exteriorCondition', label: 'Exterior' },
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
  issue: 'Issue',
  return: 'Return',
}

export function AdminOrderChecklistsTable({ order }: { order: AdminOrderDto }) {
  if (order.checklists.length === 0) {
    return (
      <Alert>
        <ClipboardListIcon />
        <AlertTitle>No checklists yet</AlertTitle>
        <AlertDescription>Issue and return checklists will be recorded here with the administrator who completed them.</AlertDescription>
      </Alert>
    )
  }

  const bicycleTitles = new Map(order.items.map((item) => [item.bicycleId, item.bicycle.title]))

  return (
    <section className="grid gap-3 border-t pt-4">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">Checklists</h2>
        <p className="text-sm text-muted-foreground">
          Recorded bicycle condition at issue and return.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Bicycle</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead>Catalog action</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Checked</TableHead>
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
                <TableCell>{new Date(checklist.checkedAt).toLocaleString()}</TableCell>
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
  const status = type === 'issue' ? 'issued' : 'returned'
  const submitLabel = type === 'issue' ? 'Issue order' : 'Return order'

  return (
    <section className="grid gap-3 border-t pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold">{typeLabels[type]} checklist</h2>
          <p className="text-sm text-muted-foreground">
            One checklist is required for every bicycle in this order.
          </p>
        </div>
        <Badge variant="outline">{order.items.length} bicycle(s)</Badge>
      </div>

      <Alert>
        {type === 'issue' ? <ClipboardCheckIcon /> : <Undo2Icon />}
        <AlertTitle>{type === 'issue' ? 'Ready for handoff' : 'Ready for return'}</AlertTitle>
        <AlertDescription>
          {type === 'issue'
            ? 'The order can be issued after successful rent and deposit payments and condition review.'
            : 'Safety findings on return can move a bicycle to maintenance or hide it from the catalog.'}
        </AlertDescription>
      </Alert>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[1280px]">
          <TableHeader>
            <TableRow>
              <TableHead>Bicycle</TableHead>
              {conditionFields.map((field) => (
                <TableHead key={field.key}>{field.label}</TableHead>
              ))}
              {type === 'return' && <TableHead>Catalog action</TableHead>}
              <TableHead>Comment</TableHead>
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
                        aria-label={`${typeLabels[type]} ${field.label} condition for ${title}`}
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
                        aria-label={`Return safety action for ${title}`}
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
                      aria-label={`${typeLabels[type]} checklist comment for ${title}`}
                      className="min-h-20 w-64"
                      disabled={disabled}
                      placeholder="Optional note"
                      value={draft?.comment ?? ''}
                      onChange={(event) =>
                        updateDraft(item.bicycleId, {
                          comment: event.target.value,
                        })}
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
        placeholder="Comment for status history"
        value={comment}
        aria-label={`${typeLabels[type]} status comment`}
        onChange={(event) => setComment(event.target.value)}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={disabled}
          onClick={() =>
            onSubmit({
              status,
              comment,
              checklists: order.items.map((item) =>
                toChecklistInput(item.bicycleId, drafts[item.bicycleId], type),
              ),
            })}
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
    setDrafts((current) => ({
      ...current,
      [bicycleId]: {
        ...defaultDraft(),
        ...current[bicycleId],
        ...patch,
      },
    }))
  }
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
  return condition.replace('_', ' ')
}

function formatSafetyAction(action: OrderChecklistBicycleAction) {
  if (action === 'none') return 'No change'
  return action
}
