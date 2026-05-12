import {
  adminPaymentsQuerySchema,
  adminPaymentsResponseSchema,
  apiErrorSchema,
  paymentResponseSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { requireRole } from '../auth/guards'
import type { AuthService } from '../auth/service'
import { errorResponse } from '../http/errors'
import type { PaymentService } from './service'

type PaymentRouteEnv = {
  Variables: {
    authService: AuthService
    paymentService: PaymentService
  }
}

const errorResponseContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const orderIdParamsSchema = z.object({
  id: z.string().min(1),
})

const paymentIdParamsSchema = z.object({
  id: z.string().min(1),
})

const createPaymentResponses = {
  200: {
    content: {
      'application/json': {
        schema: paymentResponseSchema,
      },
    },
    description: 'Existing active payment',
  },
  201: {
    content: {
      'application/json': {
        schema: paymentResponseSchema,
      },
    },
    description: 'Created payment',
  },
  401: {
    content: errorResponseContent,
    description: 'Authentication required',
  },
  403: {
    content: errorResponseContent,
    description: 'User role required',
  },
  404: {
    content: errorResponseContent,
    description: 'Order not found',
  },
  409: {
    content: errorResponseContent,
    description: 'Order is not payable',
  },
  503: {
    content: errorResponseContent,
    description: 'Payment provider is disabled',
  },
}

const createRentPaymentRoute = createRoute({
  method: 'post',
  path: '/orders/{id}/payments/rent',
  request: {
    params: orderIdParamsSchema,
  },
  responses: createPaymentResponses,
})

const createDepositPaymentRoute = createRoute({
  method: 'post',
  path: '/orders/{id}/payments/deposit',
  request: {
    params: orderIdParamsSchema,
  },
  responses: createPaymentResponses,
})

const stubSuccessRoute = createRoute({
  method: 'post',
  path: '/payments/{id}/stub-success',
  request: {
    params: paymentIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: paymentResponseSchema,
        },
      },
      description: 'Stub payment completed successfully',
    },
    401: {
      content: errorResponseContent,
      description: 'Authentication required',
    },
    403: {
      content: errorResponseContent,
      description: 'Stub endpoint disabled or access denied',
    },
    404: {
      content: errorResponseContent,
      description: 'Payment not found',
    },
    409: {
      content: errorResponseContent,
      description: 'Payment cannot be completed',
    },
  },
})

const stubFailRoute = createRoute({
  method: 'post',
  path: '/payments/{id}/stub-fail',
  request: {
    params: paymentIdParamsSchema,
  },
  responses: stubSuccessRoute.responses,
})

const stubCancelRoute = createRoute({
  method: 'post',
  path: '/payments/{id}/stub-cancel',
  request: {
    params: paymentIdParamsSchema,
  },
  responses: stubSuccessRoute.responses,
})

const adminPaymentsRoute = createRoute({
  method: 'get',
  path: '/payments',
  request: {
    query: adminPaymentsQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminPaymentsResponseSchema,
        },
      },
      description: 'Paginated admin payment list',
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

export function createPaymentRoutes() {
  const routes = new OpenAPIHono<PaymentRouteEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorResponse('VALIDATION_ERROR', 'Invalid request payload', result.error.issues),
          400,
        )
      }
    },
  })

  routes.openapi(createRentPaymentRoute, async (c) => {
    const user = await requireRole(c, 'user')
    const payments = c.get('paymentService')
    const { id } = c.req.valid('param')
    const response = await payments.createCurrentUserPayment(user, id, 'rent')
    return c.json({ payment: response.payment }, response.created ? 201 : 200)
  })

  routes.openapi(createDepositPaymentRoute, async (c) => {
    const user = await requireRole(c, 'user')
    const payments = c.get('paymentService')
    const { id } = c.req.valid('param')
    const response = await payments.createCurrentUserPayment(user, id, 'deposit')
    return c.json({ payment: response.payment }, response.created ? 201 : 200)
  })

  routes.openapi(stubSuccessRoute, async (c) => {
    const user = await requireRole(c, ['admin', 'user'])
    const payments = c.get('paymentService')
    const { id } = c.req.valid('param')
    return c.json(await payments.completeStubPayment(user, id, 'succeeded'), 200)
  })

  routes.openapi(stubFailRoute, async (c) => {
    const user = await requireRole(c, ['admin', 'user'])
    const payments = c.get('paymentService')
    const { id } = c.req.valid('param')
    return c.json(await payments.completeStubPayment(user, id, 'failed'), 200)
  })

  routes.openapi(stubCancelRoute, async (c) => {
    const user = await requireRole(c, ['admin', 'user'])
    const payments = c.get('paymentService')
    const { id } = c.req.valid('param')
    return c.json(await payments.completeStubPayment(user, id, 'cancelled'), 200)
  })

  return routes
}

export function createAdminPaymentRoutes() {
  const routes = new OpenAPIHono<PaymentRouteEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorResponse('VALIDATION_ERROR', 'Invalid request payload', result.error.issues),
          400,
        )
      }
    },
  })

  routes.openapi(adminPaymentsRoute, async (c) => {
    await requireRole(c, 'admin')
    const payments = c.get('paymentService')
    return c.json(await payments.listAdminPayments(c.req.valid('query')), 200)
  })

  return routes
}
