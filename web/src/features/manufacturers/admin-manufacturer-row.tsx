import {
  type AdminManufacturerProfileDto,
  type AdminManufacturerStatusUpdateRequest,
  type ManufacturerProfileStatus,
} from '@web-app-demo/contracts'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCell, TableRow } from '@/components/ui/table'

export function AdminManufacturerRow({
  disabled,
  profile,
  onUpdate,
}: {
  disabled: boolean
  profile: AdminManufacturerProfileDto
  onUpdate: (input: AdminManufacturerStatusUpdateRequest) => void
}) {
  const [moderationComment, setModerationComment] = useState(profile.moderationComment ?? '')
  const canDecideModeration = profile.status === 'moderation'
  const needsComment = moderationComment.trim().length === 0

  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div className="grid gap-1">
          <strong className="font-medium">{profile.publicName}</strong>
          <span className="[overflow-wrap:anywhere] text-muted-foreground">{profile.legalName}</span>
          <span className="[overflow-wrap:anywhere] text-muted-foreground">{profile.user.email}</span>
        </div>
      </TableCell>
      <TableCell>
        <ManufacturerStatusBadge status={profile.status} />
      </TableCell>
      <TableCell>{profile.city}</TableCell>
      <TableCell>
        {profile.submittedAt ? new Date(profile.submittedAt).toLocaleDateString() : 'Not submitted'}
      </TableCell>
      <TableCell>
        <div className="grid gap-2">
          <Input
            className="h-11"
            aria-label={`Moderation comment for ${profile.publicName}`}
            disabled={disabled}
            value={moderationComment}
            placeholder="Moderation comment"
            onChange={(event) => setModerationComment(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled || !canDecideModeration}
              onClick={() => onUpdate({ status: 'approved' })}
            >
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || !canDecideModeration || needsComment}
              onClick={() => onUpdate({ status: 'rejected', moderationComment })}
            >
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={disabled || profile.status === 'blocked' || needsComment}
              onClick={() => onUpdate({ status: 'blocked', moderationComment })}
            >
              Block
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ManufacturerStatusBadge({ status }: { status: ManufacturerProfileStatus }) {
  return (
    <Badge variant={status === 'blocked' || status === 'rejected' ? 'destructive' : 'secondary'}>
      {status}
    </Badge>
  )
}
