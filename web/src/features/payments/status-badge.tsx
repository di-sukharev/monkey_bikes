import type { PaymentStatus } from '@web-app-demo/contracts'

import { Badge } from '@/components/ui/badge'

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const variant =
    status === 'succeeded'
      ? 'secondary'
      : status === 'failed'
        ? 'destructive'
        : 'outline'

  return <Badge variant={variant}>{status}</Badge>
}
