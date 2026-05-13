import type {
  AdminBicycleUtilizationReportResponse,
  AdminManufacturerReportResponse,
  AdminReportListQuery,
  AdminReportPaymentTotals,
  AdminReportPeriod,
  AdminReportPeriodQuery,
  AdminReportSummaryResponse,
} from '@web-app-demo/contracts'
import { dateOnlyToEpochDay, rentalDaysInclusive } from '@web-app-demo/contracts'

import type { DbClient } from '../db'
import { Prisma } from '../generated/prisma/client'
import { AppError } from '../http/errors'

type ReportPeriod = {
  startsOn: string
  endsOn: string
  startEpochDay: number
  endEpochDay: number
  days: number
  startDate: Date
  endExclusiveDate: Date
}

type ReportDbValue = bigint | number | string | null

type CountRow = {
  total: ReportDbValue
}

type SummaryActivityRow = {
  activeRentalOrderCount: ReportDbValue
  activeRentalItemCount: ReportDbValue
}

type SizeStatRow = {
  size: string
  rentalItemCount: ReportDbValue
  rentedDays: ReportDbValue
}

type BicycleUtilizationRow = {
  bicycleId: string
  title: string
  size: string
  manufacturerId: string
  manufacturerPublicName: string
  manufacturerRegion: string | null
  manufacturerCity: string
  rentalItemCount: ReportDbValue
  rentedDays: ReportDbValue
  rentalAmountKopecks: ReportDbValue
}

type ManufacturerReportRow = {
  manufacturerId: string
  manufacturerPublicName: string
  manufacturerRegion: string | null
  manufacturerCity: string
  activeRentalOrderCount: ReportDbValue
  bicycleCount: ReportDbValue
  rentalItemCount: ReportDbValue
  rentedDays: ReportDbValue
  rentalAmountKopecks: ReportDbValue
  depositAmountKopecks: ReportDbValue
  cancelledOrderCount: ReportDbValue
}

const millisecondsPerDay = 86_400_000

export class ReportService {
  constructor(private readonly db: DbClient) {}

  async adminSummary(query: AdminReportPeriodQuery): Promise<AdminReportSummaryResponse> {
    const period = reportPeriod(query)
    const [
      paymentGroups,
      cancelledOrderCount,
      activityRows,
      sizeRows,
    ] = await Promise.all([
      this.db.payment.groupBy({
        by: ['type'],
        where: {
          status: 'succeeded',
          completedAt: {
            gte: period.startDate,
            lt: period.endExclusiveDate,
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountKopecks: true,
        },
      }),
      this.db.orderStatusHistory.count({
        where: {
          toStatus: 'cancelled',
          createdAt: {
            gte: period.startDate,
            lt: period.endExclusiveDate,
          },
        },
      }),
      this.summaryActivityRows(period),
      this.sizeStatRows(period),
    ])

    const successfulPayments = emptyPaymentTotals()
    for (const group of paymentGroups) {
      successfulPayments[group.type] = {
        count: group._count._all,
        amountKopecks: group._sum.amountKopecks ?? 0,
      }
    }

    const activity = activityRows[0] ?? {
      activeRentalOrderCount: 0,
      activeRentalItemCount: 0,
    }

    return {
      period: reportPeriodDto(period),
      orders: {
        activeRentalOrderCount: numberFromDb(activity.activeRentalOrderCount),
        activeRentalItemCount: numberFromDb(activity.activeRentalItemCount),
        cancelledOrderCount,
      },
      successfulPayments,
      mostRentedSizes: sizeRows.map((row) => ({
        size: row.size as 'L' | 'M' | 'S',
        rentalItemCount: numberFromDb(row.rentalItemCount),
        rentedDays: numberFromDb(row.rentedDays),
      })),
    }
  }

  async adminBicycleUtilization(
    query: AdminReportListQuery,
  ): Promise<AdminBicycleUtilizationReportResponse> {
    const period = reportPeriod(query)
    const [countRows, rows] = await Promise.all([
      this.bicycleUtilizationCountRows(period),
      this.bicycleUtilizationRows(period, query),
    ])

    return {
      period: reportPeriodDto(period),
      items: rows.map((row) => {
        const rentedDays = numberFromDb(row.rentedDays)

        return {
          bicycleId: row.bicycleId,
          title: row.title,
          size: row.size as 'L' | 'M' | 'S',
          manufacturer: {
            id: row.manufacturerId,
            publicName: row.manufacturerPublicName,
            region: row.manufacturerRegion,
            city: row.manufacturerCity,
          },
          rentalItemCount: numberFromDb(row.rentalItemCount),
          rentedDays,
          rentalAmountKopecks: numberFromDb(row.rentalAmountKopecks),
          utilizationRate: rentedDays / period.days,
        }
      }),
      page: query.page,
      pageSize: query.pageSize,
      total: numberFromDb(countRows[0]?.total),
    }
  }

  async adminManufacturers(
    query: AdminReportListQuery,
  ): Promise<AdminManufacturerReportResponse> {
    const period = reportPeriod(query)
    const [countRows, rows] = await Promise.all([
      this.manufacturerReportCountRows(period),
      this.manufacturerReportRows(period, query),
    ])

    return {
      period: reportPeriodDto(period),
      items: rows.map((row) => ({
        manufacturer: {
          id: row.manufacturerId,
          publicName: row.manufacturerPublicName,
          region: row.manufacturerRegion,
          city: row.manufacturerCity,
        },
        activeRentalOrderCount: numberFromDb(row.activeRentalOrderCount),
        bicycleCount: numberFromDb(row.bicycleCount),
        rentalItemCount: numberFromDb(row.rentalItemCount),
        rentedDays: numberFromDb(row.rentedDays),
        rentalAmountKopecks: numberFromDb(row.rentalAmountKopecks),
        depositAmountKopecks: numberFromDb(row.depositAmountKopecks),
        cancelledOrderCount: numberFromDb(row.cancelledOrderCount),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: numberFromDb(countRows[0]?.total),
    }
  }

  private summaryActivityRows(period: ReportPeriod) {
    return this.db.$queryRaw<SummaryActivityRow[]>`
      SELECT
        COUNT(DISTINCT o."id")::integer AS "activeRentalOrderCount",
        COUNT(*)::integer AS "activeRentalItemCount"
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      WHERE ${activityWhereSql(period)}
    `
  }

  private sizeStatRows(period: ReportPeriod) {
    return this.db.$queryRaw<SizeStatRow[]>`
      SELECT
        oi."bicycleSizeSnapshot"::text AS "size",
        COUNT(*)::integer AS "rentalItemCount",
        SUM(${overlapDaysSql(period)})::integer AS "rentedDays"
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      WHERE ${activityWhereSql(period)}
      GROUP BY oi."bicycleSizeSnapshot"
      ORDER BY "rentedDays" DESC, "size" ASC
    `
  }

  private bicycleUtilizationCountRows(period: ReportPeriod) {
    return this.db.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT oi."bicycleId")::integer AS "total"
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      WHERE ${activityWhereSql(period)}
    `
  }

  private bicycleUtilizationRows(period: ReportPeriod, query: AdminReportListQuery) {
    return this.db.$queryRaw<BicycleUtilizationRow[]>`
      SELECT
        oi."bicycleId" AS "bicycleId",
        MIN(oi."bicycleTitleSnapshot") AS "title",
        MIN(oi."bicycleSizeSnapshot"::text) AS "size",
        MIN(oi."manufacturerProfileIdSnapshot") AS "manufacturerId",
        MIN(oi."manufacturerPublicNameSnapshot") AS "manufacturerPublicName",
        MIN(oi."manufacturerRegionSnapshot") AS "manufacturerRegion",
        MIN(oi."manufacturerCitySnapshot") AS "manufacturerCity",
        COUNT(*)::integer AS "rentalItemCount",
        SUM(${overlapDaysSql(period)})::integer AS "rentedDays",
        SUM(oi."pricePerDaySnapshotKopecks" * ${overlapDaysSql(period)})::bigint
          AS "rentalAmountKopecks"
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      WHERE ${activityWhereSql(period)}
      GROUP BY oi."bicycleId"
      ORDER BY "rentedDays" DESC, "rentalAmountKopecks" DESC, "title" ASC, "bicycleId" ASC
      LIMIT ${query.pageSize}
      OFFSET ${reportOffset(query)}
    `
  }

  private manufacturerReportCountRows(period: ReportPeriod) {
    return this.db.$queryRaw<CountRow[]>`
      WITH active AS (
        SELECT DISTINCT oi."manufacturerProfileIdSnapshot" AS "manufacturerId"
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId"
        WHERE ${activityWhereSql(period)}
      ),
      cancelled AS (
        SELECT DISTINCT oi."manufacturerProfileIdSnapshot" AS "manufacturerId"
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId"
        JOIN "order_status_history" h ON h."orderId" = o."id"
        WHERE ${cancelledWhereSql(period)}
      )
      SELECT COUNT(*)::integer AS "total"
      FROM (
        SELECT "manufacturerId" FROM active
        UNION
        SELECT "manufacturerId" FROM cancelled
      ) manufacturers
    `
  }

  private manufacturerReportRows(period: ReportPeriod, query: AdminReportListQuery) {
    return this.db.$queryRaw<ManufacturerReportRow[]>`
      WITH active AS (
        SELECT
          oi."manufacturerProfileIdSnapshot" AS "manufacturerId",
          MIN(oi."manufacturerPublicNameSnapshot") AS "manufacturerPublicName",
          MIN(oi."manufacturerRegionSnapshot") AS "manufacturerRegion",
          MIN(oi."manufacturerCitySnapshot") AS "manufacturerCity",
          COUNT(DISTINCT o."id")::integer AS "activeRentalOrderCount",
          COUNT(DISTINCT oi."bicycleId")::integer AS "bicycleCount",
          COUNT(*)::integer AS "rentalItemCount",
          SUM(${overlapDaysSql(period)})::integer AS "rentedDays",
          SUM(oi."pricePerDaySnapshotKopecks" * ${overlapDaysSql(period)})::bigint
            AS "rentalAmountKopecks",
          SUM(oi."depositSnapshotKopecks")::bigint AS "depositAmountKopecks"
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId"
        WHERE ${activityWhereSql(period)}
        GROUP BY oi."manufacturerProfileIdSnapshot"
      ),
      cancelled AS (
        SELECT
          oi."manufacturerProfileIdSnapshot" AS "manufacturerId",
          MIN(oi."manufacturerPublicNameSnapshot") AS "manufacturerPublicName",
          MIN(oi."manufacturerRegionSnapshot") AS "manufacturerRegion",
          MIN(oi."manufacturerCitySnapshot") AS "manufacturerCity",
          COUNT(DISTINCT o."id")::integer AS "cancelledOrderCount"
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId"
        JOIN "order_status_history" h ON h."orderId" = o."id"
        WHERE ${cancelledWhereSql(period)}
        GROUP BY oi."manufacturerProfileIdSnapshot"
      )
      SELECT
        COALESCE(active."manufacturerId", cancelled."manufacturerId") AS "manufacturerId",
        COALESCE(active."manufacturerPublicName", cancelled."manufacturerPublicName") AS "manufacturerPublicName",
        COALESCE(active."manufacturerRegion", cancelled."manufacturerRegion") AS "manufacturerRegion",
        COALESCE(active."manufacturerCity", cancelled."manufacturerCity") AS "manufacturerCity",
        COALESCE(active."activeRentalOrderCount", 0)::integer AS "activeRentalOrderCount",
        COALESCE(active."bicycleCount", 0)::integer AS "bicycleCount",
        COALESCE(active."rentalItemCount", 0)::integer AS "rentalItemCount",
        COALESCE(active."rentedDays", 0)::integer AS "rentedDays",
        COALESCE(active."rentalAmountKopecks", 0)::bigint AS "rentalAmountKopecks",
        COALESCE(active."depositAmountKopecks", 0)::bigint AS "depositAmountKopecks",
        COALESCE(cancelled."cancelledOrderCount", 0)::integer AS "cancelledOrderCount"
      FROM active
      FULL OUTER JOIN cancelled ON cancelled."manufacturerId" = active."manufacturerId"
      ORDER BY "rentedDays" DESC, "rentalAmountKopecks" DESC, "manufacturerPublicName" ASC, "manufacturerId" ASC
      LIMIT ${query.pageSize}
      OFFSET ${reportOffset(query)}
    `
  }
}

function reportPeriod(query: AdminReportPeriodQuery): ReportPeriod {
  const startEpochDay = dateOnlyToEpochDay(query.startsOn)
  const endEpochDay = dateOnlyToEpochDay(query.endsOn)

  return {
    startsOn: query.startsOn,
    endsOn: query.endsOn,
    startEpochDay,
    endEpochDay,
    days: rentalDaysInclusive(query.startsOn, query.endsOn),
    startDate: new Date(startEpochDay * millisecondsPerDay),
    endExclusiveDate: new Date((endEpochDay + 1) * millisecondsPerDay),
  }
}

function reportPeriodDto(period: ReportPeriod): AdminReportPeriod {
  return {
    startsOn: period.startsOn,
    endsOn: period.endsOn,
    days: period.days,
  }
}

function emptyPaymentTotals(): AdminReportPaymentTotals {
  return {
    rent: {
      count: 0,
      amountKopecks: 0,
    },
    deposit: {
      count: 0,
      amountKopecks: 0,
    },
  }
}

function activityWhereSql(period: ReportPeriod) {
  return Prisma.sql`
    o."status"::text IN ('confirmed', 'issued', 'returned')
    AND o."startsOn" <= ${period.endsOn}
    AND o."endsOn" >= ${period.startsOn}
  `
}

function cancelledWhereSql(period: ReportPeriod) {
  return Prisma.sql`
    h."toStatus"::text = 'cancelled'
    AND h."createdAt" >= ${period.startDate}
    AND h."createdAt" < ${period.endExclusiveDate}
  `
}

function overlapDaysSql(period: ReportPeriod) {
  return Prisma.sql`
    (LEAST(o."endsOn"::date, ${period.endsOn}::date) -
      GREATEST(o."startsOn"::date, ${period.startsOn}::date) + 1)
  `
}

function reportOffset(query: Pick<AdminReportListQuery, 'page' | 'pageSize'>) {
  return (query.page - 1) * query.pageSize
}

function numberFromDb(value: ReportDbValue | undefined) {
  if (value === undefined || value === null) return 0
  const numberValue =
    typeof value === 'bigint' || typeof value === 'string'
      ? Number(value)
      : value

  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Report aggregate exceeds safe integer range')
  }

  return numberValue
}
