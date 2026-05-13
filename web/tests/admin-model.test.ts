import { expect, test } from 'bun:test'

import {
  adminChecklistTypeLabel,
  adminChecklistsQueryKey,
  parseAdminChecklistTypeFilter,
} from '../src/features/admin/model'
import {
  adminOrderQuickFilterLabel,
  orderAdminListQueryKey,
  parseAdminOrderQuickFilter,
  parseAdminOrderStatusFilter,
  parseDateOnlySearch,
  todayDateOnly,
} from '../src/features/orders/model'
import { parseAdminBicycleStatusFilter } from '../src/features/bicycles/model'

test('admin filter helpers normalize route search values', () => {
  expect(parseAdminOrderStatusFilter('returned')).toBe('returned')
  expect(parseAdminOrderStatusFilter('lost')).toBe('request')
  expect(parseAdminOrderQuickFilter('unpaid_deposit')).toBe('unpaid_deposit')
  expect(parseAdminOrderQuickFilter('unknown')).toBe('none')
  expect(parseDateOnlySearch('2026-05-13', '2026-05-12')).toBe('2026-05-13')
  expect(parseDateOnlySearch('bad-date', '2026-05-12')).toBe('2026-05-12')
  expect(todayDateOnly(new Date(2026, 4, 13))).toBe('2026-05-13')
  expect(adminOrderQuickFilterLabel('orders_today')).toBe('Orders today')
  expect(orderAdminListQueryKey(2, 'all', 'orders_today', '2026-05-13')).toEqual([
    'admin',
    'orders',
    2,
    'all',
    'orders_today',
    '2026-05-13',
  ])
})

test('admin bicycle and checklist filter helpers stay explicit', () => {
  expect(parseAdminBicycleStatusFilter('maintenance')).toBe('maintenance')
  expect(parseAdminBicycleStatusFilter('lost')).toBe('moderation')
  expect(parseAdminChecklistTypeFilter('return')).toBe('return')
  expect(parseAdminChecklistTypeFilter('unknown')).toBe('all')
  expect(adminChecklistTypeLabel('issue')).toBe('Issue')
  expect(adminChecklistsQueryKey(1, 'return', 'order_1', 'bike_1')).toEqual([
    'admin',
    'checklists',
    1,
    'return',
    'order_1',
    'bike_1',
  ])
})
