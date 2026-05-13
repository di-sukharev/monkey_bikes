import type { OrderStatus } from '@web-app-demo/contracts'

import { Badge } from '@/components/ui/badge'
import { orderStatusLabel } from './model'

const variants: Record<OrderStatus, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  request: 'secondary',
  confirmed: 'default',
  issued: 'default',
  returned: 'outline',
  cancelled: 'destructive',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={variants[status]}>{orderStatusLabel(status)}</Badge>
}
