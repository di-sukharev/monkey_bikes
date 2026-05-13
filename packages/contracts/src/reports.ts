import { z } from 'zod'

import { bicycleSizeSchema } from './bicycle'
import { dateOnlyStringSchema, rentalDaysInclusive } from './date'

export const maxReportPeriodDays = 366

const reportMoneyKopecks = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const reportCount = z.number().int().min(0)

export const adminReportPeriodQuerySchema = z
  .object({
    startsOn: dateOnlyStringSchema,
    endsOn: dateOnlyStringSchema,
  })
  .strict()
  .refine((value) => value.startsOn <= value.endsOn, {
    message: 'Start date must be before or equal to end date',
    path: ['startsOn'],
  })
  .refine((value) => {
    if (value.startsOn > value.endsOn) return true
    try {
      return rentalDaysInclusive(value.startsOn, value.endsOn) <= maxReportPeriodDays
    } catch {
      return true
    }
  }, {
    message: `Report period must be ${maxReportPeriodDays} days or less`,
    path: ['endsOn'],
  })

export const adminReportListQuerySchema = adminReportPeriodQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const adminReportPeriodSchema = z.object({
  startsOn: dateOnlyStringSchema,
  endsOn: dateOnlyStringSchema,
  days: z.number().int().min(1).max(maxReportPeriodDays),
})

export const adminReportPaymentTotalsSchema = z.object({
  rent: z.object({
    count: reportCount,
    amountKopecks: reportMoneyKopecks,
  }),
  deposit: z.object({
    count: reportCount,
    amountKopecks: reportMoneyKopecks,
  }),
})

export const adminReportSizeStatSchema = z.object({
  size: bicycleSizeSchema,
  rentalItemCount: reportCount,
  rentedDays: reportCount,
})

export const adminReportSummaryResponseSchema = z.object({
  period: adminReportPeriodSchema,
  orders: z.object({
    activeRentalOrderCount: reportCount,
    activeRentalItemCount: reportCount,
    cancelledOrderCount: reportCount,
  }),
  successfulPayments: adminReportPaymentTotalsSchema,
  mostRentedSizes: z.array(adminReportSizeStatSchema),
})

export const adminReportManufacturerSummarySchema = z.object({
  id: z.string(),
  publicName: z.string(),
  region: z.string().nullable(),
  city: z.string(),
})

export const adminBicycleUtilizationReportItemSchema = z.object({
  bicycleId: z.string(),
  title: z.string(),
  size: bicycleSizeSchema,
  manufacturer: adminReportManufacturerSummarySchema,
  rentalItemCount: reportCount,
  rentedDays: reportCount,
  rentalAmountKopecks: reportMoneyKopecks,
  utilizationRate: z.number().min(0),
})

export const adminBicycleUtilizationReportResponseSchema = z.object({
  period: adminReportPeriodSchema,
  items: z.array(adminBicycleUtilizationReportItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: reportCount,
})

export const adminManufacturerReportItemSchema = z.object({
  manufacturer: adminReportManufacturerSummarySchema,
  activeRentalOrderCount: reportCount,
  bicycleCount: reportCount,
  rentalItemCount: reportCount,
  rentedDays: reportCount,
  rentalAmountKopecks: reportMoneyKopecks,
  depositAmountKopecks: reportMoneyKopecks,
  cancelledOrderCount: reportCount,
})

export const adminManufacturerReportResponseSchema = z.object({
  period: adminReportPeriodSchema,
  items: z.array(adminManufacturerReportItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: reportCount,
})

export type AdminReportPeriodQuery = z.infer<typeof adminReportPeriodQuerySchema>
export type AdminReportListQuery = z.infer<typeof adminReportListQuerySchema>
export type AdminReportPeriod = z.infer<typeof adminReportPeriodSchema>
export type AdminReportPaymentTotals = z.infer<typeof adminReportPaymentTotalsSchema>
export type AdminReportSummaryResponse = z.infer<typeof adminReportSummaryResponseSchema>
export type AdminBicycleUtilizationReportItem = z.infer<typeof adminBicycleUtilizationReportItemSchema>
export type AdminBicycleUtilizationReportResponse = z.infer<typeof adminBicycleUtilizationReportResponseSchema>
export type AdminManufacturerReportItem = z.infer<typeof adminManufacturerReportItemSchema>
export type AdminManufacturerReportResponse = z.infer<typeof adminManufacturerReportResponseSchema>
