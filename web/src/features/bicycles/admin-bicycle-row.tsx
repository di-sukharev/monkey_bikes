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
import { adminBicycleStatusOptionsFor, canAdminApproveBicycle, formatMoney } from './model'
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
            <span className="text-sm text-muted-foreground">Manufacturer {bicycle.manufacturer.status}</span>
          )}
          <span className="text-sm text-muted-foreground">{formatMoney(bicycle.pricePerDayKopecks)} / day</span>
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
        {bicycle.submittedAt ? new Date(bicycle.submittedAt).toLocaleDateString() : '-'}
      </TableCell>
      <TableCell className="align-top">
        <div className="grid gap-2">
          <Textarea
            aria-label={`Moderation comment for ${bicycle.title}`}
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
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || bicycle.status !== 'moderation' || comment.trim().length === 0}
              onClick={() => onModerate({ decision: 'rejected', moderationComment: comment })}
            >
              Reject
            </Button>
          </div>
          <NativeSelect
            aria-label={`Operational status for ${bicycle.title}`}
            disabled={disabled || !canUpdateOperationalStatus}
            value={bicycle.status}
            onChange={(event) =>
              onStatusChange({ status: event.target.value as AdminBicycleStatusUpdateRequest['status'] })
            }
          >
            <NativeSelectOption value={bicycle.status}>{bicycle.status}</NativeSelectOption>
            {statusOptions.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {status}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </TableCell>
    </TableRow>
  )
}
