import {
  adminBicycleUtilizationReportResponseSchema,
  adminManufacturerReportResponseSchema,
  adminReportListQuerySchema,
  adminReportPeriodQuerySchema,
  adminReportSummaryResponseSchema,
  apiErrorSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { requireRole } from '../auth/guards'
import type { AuthService } from '../auth/service'
import { errorResponse } from '../http/errors'
import type { ReportService } from './service'

type ReportRouteEnv = {
  Variables: {
    authService: AuthService
    reportService: ReportService
  }
}

const errorResponseContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const adminReportSummaryRoute = createRoute({
  method: 'get',
  path: '/reports/summary',
  request: {
    query: adminReportPeriodQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminReportSummaryResponseSchema,
        },
      },
      description: 'Admin aggregate report summary',
    },
    400: {
      content: errorResponseContent,
      description: 'Invalid query',
    },
    401: {
      content: errorResponseContent,
      description: 'Authentication required',
    },
    403: {
      content: errorResponseContent,
      description: 'Admin role required',
    },
  },
})

const adminBicycleUtilizationRoute = createRoute({
  method: 'get',
  path: '/reports/bicycle-utilization',
  request: {
    query: adminReportListQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminBicycleUtilizationReportResponseSchema,
        },
      },
      description: 'Paginated admin bicycle utilization report',
    },
    400: {
      content: errorResponseContent,
      description: 'Invalid query',
    },
    401: {
      content: errorResponseContent,
      description: 'Authentication required',
    },
    403: {
      content: errorResponseContent,
      description: 'Admin role required',
    },
  },
})

const adminManufacturerReportRoute = createRoute({
  method: 'get',
  path: '/reports/manufacturers',
  request: {
    query: adminReportListQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminManufacturerReportResponseSchema,
        },
      },
      description: 'Paginated admin manufacturer report',
    },
    400: {
      content: errorResponseContent,
      description: 'Invalid query',
    },
    401: {
      content: errorResponseContent,
      description: 'Authentication required',
    },
    403: {
      content: errorResponseContent,
      description: 'Admin role required',
    },
  },
})

export function createAdminReportRoutes() {
  const routes = new OpenAPIHono<ReportRouteEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorResponse('VALIDATION_ERROR', 'Invalid request payload', result.error.issues),
          400,
        )
      }
    },
  })

  routes.openapi(adminReportSummaryRoute, async (c) => {
    await requireRole(c, 'admin')
    const reports = c.get('reportService')

    return c.json(await reports.adminSummary(c.req.valid('query')), 200)
  })

  routes.openapi(adminBicycleUtilizationRoute, async (c) => {
    await requireRole(c, 'admin')
    const reports = c.get('reportService')

    return c.json(await reports.adminBicycleUtilization(c.req.valid('query')), 200)
  })

  routes.openapi(adminManufacturerReportRoute, async (c) => {
    await requireRole(c, 'admin')
    const reports = c.get('reportService')

    return c.json(await reports.adminManufacturers(c.req.valid('query')), 200)
  })

  return routes
}
