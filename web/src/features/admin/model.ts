import type { OrderChecklistType } from '@web-app-demo/contracts'

export type AdminChecklistTypeFilter = OrderChecklistType | 'all'

export const adminChecklistTypes: OrderChecklistType[] = ['issue', 'return']

export function adminChecklistTypeLabel(type: AdminChecklistTypeFilter) {
  switch (type) {
    case 'all':
      return 'Все чеклисты'
    case 'issue':
      return 'Выдача'
    case 'return':
      return 'Возврат'
  }
}

export function adminChecklistsQueryKey(
  page: number,
  type: AdminChecklistTypeFilter,
  orderId: string,
  bicycleId: string,
) {
  return ['admin', 'checklists', page, type, orderId, bicycleId] as const
}

export function parseAdminChecklistTypeFilter(value: unknown): AdminChecklistTypeFilter {
  if (value === 'all') return 'all'
  return adminChecklistTypes.includes(value as OrderChecklistType)
    ? value as OrderChecklistType
    : 'all'
}
