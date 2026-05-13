import type {
  AdminBicycleDto,
  AdminBicycleModerationRequest,
  AdminBicycleStatusUpdateRequest,
} from '@web-app-demo/contracts'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { TableCell, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  adminBicycleStatusOptionsFor,
  bicycleStatusLabel,
  canAdminApproveBicycle,
  formatMoney,
} from './model'
import { manufacturerStatusLabel } from '../manufacturers/model'
import { BicycleSizeBadge, BicycleStatusBadge } from './status-badge'

export function AdminBicycleRow({
  bicycle,
  disabled,
  onModerate,
  onStatusChange,
}: {
  bicycle: AdminBicycleDto
  disabled: boolean
  onModerate: (input: AdminBicycleModerationRequest) => void
  onStatusChange: (input: AdminBicycleStatusUpdateRequest) => void
}) {
  const [comment, setComment] = useState('')
  const statusOptions = adminBicycleStatusOptionsFor(bicycle.status, bicycle.manufacturer.status)
  const canUpdateOperationalStatus = statusOptions.length > 0
  const canApprove = canAdminApproveBicycle(bicycle.status, bicycle.manufacturer.status)

  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="grid gap-1">
          <span className="font-medium">{bicycle.title}</span>
          <span className="text-sm text-muted-foreground">{bicycle.manufacturer.publicName}</span>
          {bicycle.manufacturer.status !== 'approved' && (
            <span className="text-sm text-muted-foreground">
              Производитель: {manufacturerStatusLabel(bicycle.manufacturer.status)}
            </span>
          )}
          <span className="text-sm text-muted-foreground">{formatMoney(bicycle.pricePerDayKopecks)} / день</span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-wrap gap-2">
          <BicycleStatusBadge status={bicycle.status} />
          <BicycleSizeBadge size={bicycle.size} />
        </div>
      </TableCell>
      <TableCell className="align-top">{bicycle.city}</TableCell>
      <TableCell className="align-top">
        {bicycle.submittedAt ? new Date(bicycle.submittedAt).toLocaleDateString('ru-RU') : '-'}
      </TableCell>
      <TableCell className="align-top">
        <div className="grid gap-2">
          <Textarea
            aria-label={`Комментарий модерации для ${bicycle.title}`}
            className="min-h-20"
            disabled={disabled}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled || !canApprove}
              onClick={() => onModerate({ decision: 'approved' })}
            >
              Одобрить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || bicycle.status !== 'moderation' || comment.trim().length === 0}
              onClick={() => onModerate({ decision: 'rejected', moderationComment: comment })}
            >
              Отклонить
            </Button>
          </div>
          <NativeSelect
            aria-label={`Операционный статус для ${bicycle.title}`}
            disabled={disabled || !canUpdateOperationalStatus}
            value={bicycle.status}
            onChange={(event) =>
              onStatusChange({ status: event.target.value as AdminBicycleStatusUpdateRequest['status'] })
            }
          >
            <NativeSelectOption value={bicycle.status}>{bicycleStatusLabel(bicycle.status)}</NativeSelectOption>
            {statusOptions.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {bicycleStatusLabel(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {bicycle.status === 'rented' && (
            <span className="text-sm text-muted-foreground">
              Выданные велосипеды меняют статус через чеклист возврата.
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
