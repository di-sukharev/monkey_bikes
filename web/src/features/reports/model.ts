import {
  adminReportPeriodQuerySchema,
  dateOnlyStringSchema,
} from '@web-app-demo/contracts'

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

export type AdminReportsSearch = {
  startsOn: string
  endsOn: string
  bicyclePage: number
  manufacturerPage: number
}

export function defaultReportsPeriod(now = new Date()) {
  return {
    startsOn: dateOnlyFromLocalDate(addLocalDays(now, -29)),
    endsOn: dateOnlyFromLocalDate(now),
  }
}

export function normalizeAdminReportsSearch(
  search: Record<string, unknown>,
  now = new Date(),
): AdminReportsSearch {
  const fallback = defaultReportsPeriod(now)
  const startsOn = parseDateOnly(search.startsOn) ?? fallback.startsOn
  const endsOn = parseDateOnly(search.endsOn) ?? fallback.endsOn
  const period = adminReportPeriodQuerySchema.safeParse({ startsOn, endsOn })

  return {
    startsOn: period.success ? period.data.startsOn : fallback.startsOn,
    endsOn: period.success ? period.data.endsOn : fallback.endsOn,
    bicyclePage: positivePage(search.bicyclePage),
    manufacturerPage: positivePage(search.manufacturerPage),
  }
}

export function adminReportsSearch(
  startsOn: string,
  endsOn: string,
  bicyclePage = 1,
  manufacturerPage = 1,
) {
  return {
    startsOn,
    endsOn,
    bicyclePage,
    manufacturerPage,
  }
}

export function adminReportSummaryQueryKey(startsOn: string, endsOn: string) {
  return ['admin', 'reports', 'summary', startsOn, endsOn] as const
}

export function adminBicycleUtilizationReportQueryKey(
  startsOn: string,
  endsOn: string,
  page: number,
) {
  return ['admin', 'reports', 'bicycle-utilization', startsOn, endsOn, page] as const
}

export function adminManufacturerReportQueryKey(
  startsOn: string,
  endsOn: string,
  page: number,
) {
  return ['admin', 'reports', 'manufacturers', startsOn, endsOn, page] as const
}

export function formatUtilizationRate(rate: number) {
  return `${Math.round(rate * 100)}%`
}

function parseDateOnly(value: unknown) {
  if (typeof value !== 'string' || !dateOnlyPattern.test(value)) return null
  const result = dateOnlyStringSchema.safeParse(value)
  return result.success ? result.data : null
}

function positivePage(value: unknown) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function dateOnlyFromLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
