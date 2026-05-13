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
import {
  adminBicycleUtilizationReportQueryKey,
  adminManufacturerReportQueryKey,
  adminReportSummaryQueryKey,
  adminReportsSearch,
  defaultReportsPeriod,
  formatUtilizationRate,
  normalizeAdminReportsSearch,
} from '../src/features/reports/model'

test('admin filter helpers normalize route search values', () => {
  expect(parseAdminOrderStatusFilter('returned')).toBe('returned')
  expect(parseAdminOrderStatusFilter('lost')).toBe('request')
  expect(parseAdminOrderQuickFilter('unpaid_deposit')).toBe('unpaid_deposit')
  expect(parseAdminOrderQuickFilter('unknown')).toBe('none')
  expect(parseDateOnlySearch('2026-05-13', '2026-05-12')).toBe('2026-05-13')
  expect(parseDateOnlySearch('bad-date', '2026-05-12')).toBe('2026-05-12')
  expect(todayDateOnly(new Date(2026, 4, 13))).toBe('2026-05-13')
  expect(adminOrderQuickFilterLabel('orders_today')).toBe('Заявки на сегодня')
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
  expect(adminChecklistTypeLabel('issue')).toBe('Выдача')
  expect(adminChecklistsQueryKey(1, 'return', 'order_1', 'bike_1')).toEqual([
    'admin',
    'checklists',
    1,
    'return',
    'order_1',
    'bike_1',
  ])
})

test('admin report helpers normalize period route search values', () => {
  expect(defaultReportsPeriod(new Date(2026, 4, 13))).toEqual({
    startsOn: '2026-04-14',
    endsOn: '2026-05-13',
  })
  expect(normalizeAdminReportsSearch({
    startsOn: '2026-05-01',
    endsOn: '2026-05-31',
    bicyclePage: '2',
    manufacturerPage: 3,
  }, new Date(2026, 4, 13))).toEqual({
    startsOn: '2026-05-01',
    endsOn: '2026-05-31',
    bicyclePage: 2,
    manufacturerPage: 3,
  })
  expect(normalizeAdminReportsSearch({
    startsOn: '2026-05-31',
    endsOn: '2026-05-01',
  }, new Date(2026, 4, 13))).toEqual({
    startsOn: '2026-04-14',
    endsOn: '2026-05-13',
    bicyclePage: 1,
    manufacturerPage: 1,
  })
  expect(normalizeAdminReportsSearch({
    startsOn: '2026-02-31',
    endsOn: '2026-03-01',
  }, new Date(2026, 4, 13))).toEqual({
    startsOn: '2026-04-14',
    endsOn: '2026-05-13',
    bicyclePage: 1,
    manufacturerPage: 1,
  })
  expect(normalizeAdminReportsSearch({
    startsOn: '2026-01-01',
    endsOn: '2027-01-02',
  }, new Date(2026, 4, 13))).toEqual({
    startsOn: '2026-04-14',
    endsOn: '2026-05-13',
    bicyclePage: 1,
    manufacturerPage: 1,
  })
  expect(adminReportsSearch('2026-05-01', '2026-05-31', 2, 1)).toEqual({
    startsOn: '2026-05-01',
    endsOn: '2026-05-31',
    bicyclePage: 2,
    manufacturerPage: 1,
  })
  expect(adminReportSummaryQueryKey('2026-05-01', '2026-05-31')).toEqual([
    'admin',
    'reports',
    'summary',
    '2026-05-01',
    '2026-05-31',
  ])
  expect(adminBicycleUtilizationReportQueryKey('2026-05-01', '2026-05-31', 2)).toEqual([
    'admin',
    'reports',
    'bicycle-utilization',
    '2026-05-01',
    '2026-05-31',
    2,
  ])
  expect(adminManufacturerReportQueryKey('2026-05-01', '2026-05-31', 3)).toEqual([
    'admin',
    'reports',
    'manufacturers',
    '2026-05-01',
    '2026-05-31',
    3,
  ])
  expect(formatUtilizationRate(0.33)).toBe('33%')
})
