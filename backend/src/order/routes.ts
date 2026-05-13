import {
  adminOrderResponseSchema,
  adminOrdersQuerySchema,
  adminOrdersResponseSchema,
  adminOrderStatusUpdateRequestSchema,
  apiErrorSchema,
  manufacturerOrderResponseSchema,
  manufacturerOrdersQuerySchema,
  manufacturerOrdersResponseSchema,
  orderCancelRequestSchema,
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

const cancelOrderRoute = createRoute({
  method: 'post',
  path: '/{id}/cancel',
  request: {
    params: orderIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: orderCancelRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: orderResponseSchema,
        },
      },
      description: 'Cancelled current user rental request',
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
    404: {
      content: errorResponseContent,
      description: 'Order not found',
    },
    409: {
      content: errorResponseContent,
      description: 'Order cannot be cancelled by the current user',
    },
  },
})

const adminOrdersRoute = createRoute({
  method: 'get',
  path: '/orders',
  request: {
    query: adminOrdersQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminOrdersResponseSchema,
        },
      },
      description: 'Paginated admin order list',
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

const manufacturerOrdersRoute = createRoute({
  method: 'get',
  path: '/orders',
  request: {
    query: manufacturerOrdersQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: manufacturerOrdersResponseSchema,
        },
      },
      description: 'Current manufacturer related orders',
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
      description: 'Manufacturer role required',
    },
  },
})

const manufacturerOrderRoute = createRoute({
  method: 'get',
  path: '/orders/{id}',
  request: {
    params: orderIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: manufacturerOrderResponseSchema,
        },
      },
      description: 'Current manufacturer related order detail',
    },
    401: {
      content: errorResponseContent,
      description: 'Authentication required',
    },
    403: {
      content: errorResponseContent,
      description: 'Manufacturer role required',
    },
    404: {
      content: errorResponseContent,
      description: 'Order not found',
    },
  },
})

const adminOrderRoute = createRoute({
  method: 'get',
  path: '/orders/{id}',
  request: {
    params: orderIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminOrderResponseSchema,
        },
      },
      description: 'Admin order details',
    },
    401: {
      content: errorResponseContent,
      description: 'Authentication required',
    },
    403: {
      content: errorResponseContent,
      description: 'Admin role required',
    },
    404: {
      content: errorResponseContent,
      description: 'Order not found',
    },
  },
})

const adminUpdateOrderStatusRoute = createRoute({
  method: 'patch',
  path: '/orders/{id}/status',
  request: {
    params: orderIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: adminOrderStatusUpdateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminOrderResponseSchema,
        },
      },
      description: 'Updated admin order status',
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
      description: 'Admin role required',
    },
    404: {
      content: errorResponseContent,
      description: 'Order not found',
    },
    409: {
      content: errorResponseContent,
      description: 'Order status transition is not allowed',
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

  routes.openapi(cancelOrderRoute, async (c) => {
    const user = await requireRole(c, 'user')
    const orders = c.get('orderService')
    const { id } = c.req.valid('param')
    return c.json(await orders.cancelCurrentUserOrder(user, id, c.req.valid('json')), 200)
  })

  routes.openapi(getOrderRoute, async (c) => {
    const user = await requireRole(c, 'user')
    const orders = c.get('orderService')
    const { id } = c.req.valid('param')
    return c.json(await orders.getCurrentUserOrder(user, id), 200)
  })

  return routes
}

export function createManufacturerOrderRoutes() {
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

  routes.openapi(manufacturerOrdersRoute, async (c) => {
    const user = await requireRole(c, 'manufacturer')
    const orders = c.get('orderService')
    return c.json(await orders.listManufacturerOrders(user, c.req.valid('query')), 200)
  })

  routes.openapi(manufacturerOrderRoute, async (c) => {
    const user = await requireRole(c, 'manufacturer')
    const orders = c.get('orderService')
    const { id } = c.req.valid('param')
    return c.json(await orders.getManufacturerOrder(user, id), 200)
  })

  return routes
}

export function createAdminOrderRoutes() {
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

  routes.openapi(adminOrdersRoute, async (c) => {
    await requireRole(c, 'admin')
    const orders = c.get('orderService')
    return c.json(await orders.listAdminOrders(c.req.valid('query')), 200)
  })

  routes.openapi(adminOrderRoute, async (c) => {
    await requireRole(c, 'admin')
    const orders = c.get('orderService')
    const { id } = c.req.valid('param')
    return c.json(await orders.getAdminOrder(id), 200)
  })

  routes.openapi(adminUpdateOrderStatusRoute, async (c) => {
    const user = await requireRole(c, 'admin')
    const orders = c.get('orderService')
    const { id } = c.req.valid('param')
    return c.json(await orders.updateAdminOrderStatus(user, id, c.req.valid('json')), 200)
  })

  return routes
}
