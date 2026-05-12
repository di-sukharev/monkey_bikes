import type { BicycleSize, BicycleStatus } from '@web-app-demo/contracts'

import { Badge } from '@/components/ui/badge'

export function BicycleStatusBadge({ status }: { status: BicycleStatus }) {
  const variant =
    status === 'available'
      ? 'default'
      : status === 'moderation'
        ? 'secondary'
        : status === 'rejected' || status === 'hidden' || status === 'maintenance'
          ? 'outline'
          : status === 'archived'
            ? 'destructive'
            : 'outline'

  return <Badge variant={variant}>{status}</Badge>
}

export function BicycleSizeBadge({ size }: { size: BicycleSize }) {
  return <Badge variant="outline">{size}</Badge>
}
