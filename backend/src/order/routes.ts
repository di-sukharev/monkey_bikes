import {
  apiErrorSchema,
  orderCreateRequestSchema,
  orderResponseSchema,
  ordersQuerySchema,
  ordersResponseSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { requireRole } from '../auth/guards'
import type { AuthService } from '../auth/service'
import { errorResponse } from '../http/errors'
import type { OrderService } from './service'

type OrderRouteEnv = {
  Variables: {
    authService: AuthService
    orderService: OrderService
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

const listOrdersRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: ordersQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ordersResponseSchema,
        },
      },
      description: 'Current user orders',
    },
    401: {
      content: errorResponseContent,
      description: 'Authentication required',
    },
    403: {
      content: errorResponseContent,
      description: 'User role required',
    },
  },
})

const createOrderRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: orderCreateRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: orderResponseSchema,
        },
      },
      description: 'Created rental request',
    },
    400: {
      content: errorResponseContent,
      description: 'Invalid payload',
    },
    401: {
      content: errorResponseContent,
      description: 'Authentication required',
    },
    403: {
      content: errorResponseContent,
      description: 'User role required',
    },
    409: {
      content: errorResponseContent,
      description: 'Selected bicycles are not valid for this request',
    },
  },
})

const getOrderRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: orderIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: orderResponseSchema,
        },
      },
      description: 'Current user order details',
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
  },
})

export function createOrderRoutes() {
  const routes = new OpenAPIHono<OrderRouteEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorResponse('VALIDATION_ERROR', 'Invalid request payload', result.error.issues),
          400,
        )
      }
    },
  })

  routes.openapi(listOrdersRoute, async (c) => {
    const user = await requireRole(c, 'user')
    const orders = c.get('orderService')
    return c.json(await orders.listCurrentUserOrders(user, c.req.valid('query')), 200)
  })

  routes.openapi(createOrderRoute, async (c) => {
    const user = await requireRole(c, 'user')
    const orders = c.get('orderService')
    return c.json(await orders.createOrder(user, c.req.valid('json')), 201)
  })

  routes.openapi(getOrderRoute, async (c) => {
    const user = await requireRole(c, 'user')
    const orders = c.get('orderService')
    const { id } = c.req.valid('param')
    return c.json(await orders.getCurrentUserOrder(user, id), 200)
  })

  return routes
}
