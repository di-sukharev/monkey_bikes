import {
  adminBicycleModerationRequestSchema,
  adminBicycleResponseSchema,
  adminBicyclesQuerySchema,
  adminBicyclesResponseSchema,
  adminBicycleStatusUpdateRequestSchema,
  apiErrorSchema,
  bicycleResponseSchema,
  bicycleUpsertRequestSchema,
  manufacturerBicyclesQuerySchema,
  manufacturerBicyclesResponseSchema,
  publicBicycleResponseSchema,
  publicBicyclesQuerySchema,
  publicBicyclesResponseSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { requireRole } from '../auth/guards'
import type { AuthService } from '../auth/service'
import { errorResponse } from '../http/errors'
import type { BicycleService } from './service'

type BicycleRouteEnv = {
  Variables: {
    authService: AuthService
    bicycleService: BicycleService
  }
}

const errorResponseContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const bicycleIdParamsSchema = z.object({
  id: z.string().min(1),
})

const publicBicyclesRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: publicBicyclesQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: publicBicyclesResponseSchema,
        },
      },
      description: 'Paginated public bicycle catalog',
    },
    400: {
      content: errorResponseContent,
      description: 'Invalid query',
    },
  },
})

const publicBicycleRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: bicycleIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: publicBicycleResponseSchema,
        },
      },
      description: 'Public bicycle details',
    },
    404: {
      content: errorResponseContent,
      description: 'Bicycle not found or not public',
    },
  },
})

const manufacturerBicyclesRoute = createRoute({
  method: 'get',
  path: '/bicycles',
  request: {
    query: manufacturerBicyclesQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: manufacturerBicyclesResponseSchema,
        },
      },
      description: 'Current manufacturer bicycles',
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

const createManufacturerBicycleRoute = createRoute({
  method: 'post',
  path: '/bicycles',
  request: {
    body: {
      content: {
        'application/json': {
          schema: bicycleUpsertRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: bicycleResponseSchema,
        },
      },
      description: 'Created manufacturer bicycle draft',
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
      description: 'Manufacturer role required',
    },
    409: {
      content: errorResponseContent,
      description: 'Manufacturer profile is not allowed to manage bicycles',
    },
  },
})

const updateManufacturerBicycleRoute = createRoute({
  method: 'patch',
  path: '/bicycles/{id}',
  request: {
    params: bicycleIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: bicycleUpsertRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: bicycleResponseSchema,
        },
      },
      description: 'Updated manufacturer bicycle draft',
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
      description: 'Manufacturer role required',
    },
    404: {
      content: errorResponseContent,
      description: 'Bicycle not found',
    },
    409: {
      content: errorResponseContent,
      description: 'Bicycle state does not allow changes',
    },
  },
})

const submitManufacturerBicycleRoute = createRoute({
  method: 'post',
  path: '/bicycles/{id}/submit',
  request: {
    params: bicycleIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: bicycleResponseSchema,
        },
      },
      description: 'Submitted bicycle for moderation',
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
      description: 'Bicycle not found',
    },
    409: {
      content: errorResponseContent,
      description: 'Bicycle state does not allow submission',
    },
  },
})

const adminBicyclesRoute = createRoute({
  method: 'get',
  path: '/bicycles',
  request: {
    query: adminBicyclesQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminBicyclesResponseSchema,
        },
      },
      description: 'Paginated admin bicycle list',
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

const adminModerateBicycleRoute = createRoute({
  method: 'patch',
  path: '/bicycles/{id}/moderation',
  request: {
    params: bicycleIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: adminBicycleModerationRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminBicycleResponseSchema,
        },
      },
      description: 'Updated bicycle moderation decision',
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
      description: 'Bicycle not found',
    },
    409: {
      content: errorResponseContent,
      description: 'Bicycle state does not allow this moderation decision',
    },
  },
})

const adminUpdateBicycleStatusRoute = createRoute({
  method: 'patch',
  path: '/bicycles/{id}/status',
  request: {
    params: bicycleIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: adminBicycleStatusUpdateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminBicycleResponseSchema,
        },
      },
      description: 'Updated bicycle operational status',
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
      description: 'Bicycle not found',
    },
    409: {
      content: errorResponseContent,
      description: 'Bicycle state does not allow this status change',
    },
  },
})

export function createPublicBicycleRoutes() {
  const routes = createRoutes()

  routes.openapi(publicBicyclesRoute, async (c) => {
    const bicycles = c.get('bicycleService')
    return c.json(await bicycles.listPublicBicycles(c.req.valid('query')), 200)
  })

  routes.openapi(publicBicycleRoute, async (c) => {
    const bicycles = c.get('bicycleService')
    const { id } = c.req.valid('param')
    return c.json(await bicycles.getPublicBicycle(id), 200)
  })

  return routes
}

export function createManufacturerBicycleRoutes() {
  const routes = createRoutes()

  routes.openapi(manufacturerBicyclesRoute, async (c) => {
    const user = await requireRole(c, 'manufacturer')
    const bicycles = c.get('bicycleService')
    return c.json(await bicycles.listManufacturerBicycles(user, c.req.valid('query')), 200)
  })

  routes.openapi(createManufacturerBicycleRoute, async (c) => {
    const user = await requireRole(c, 'manufacturer')
    const bicycles = c.get('bicycleService')
    return c.json(await bicycles.createManufacturerBicycle(user, c.req.valid('json')), 200)
  })

  routes.openapi(updateManufacturerBicycleRoute, async (c) => {
    const user = await requireRole(c, 'manufacturer')
    const bicycles = c.get('bicycleService')
    const { id } = c.req.valid('param')
    return c.json(await bicycles.updateManufacturerBicycle(user, id, c.req.valid('json')), 200)
  })

  routes.openapi(submitManufacturerBicycleRoute, async (c) => {
    const user = await requireRole(c, 'manufacturer')
    const bicycles = c.get('bicycleService')
    const { id } = c.req.valid('param')
    return c.json(await bicycles.submitManufacturerBicycle(user, id), 200)
  })

  return routes
}

export function createAdminBicycleRoutes() {
  const routes = createRoutes()

  routes.openapi(adminBicyclesRoute, async (c) => {
    await requireRole(c, 'admin')
    const bicycles = c.get('bicycleService')
    return c.json(await bicycles.listAdminBicycles(c.req.valid('query')), 200)
  })

  routes.openapi(adminModerateBicycleRoute, async (c) => {
    await requireRole(c, 'admin')
    const bicycles = c.get('bicycleService')
    const { id } = c.req.valid('param')
    return c.json(await bicycles.moderateAdminBicycle(id, c.req.valid('json')), 200)
  })

  routes.openapi(adminUpdateBicycleStatusRoute, async (c) => {
    await requireRole(c, 'admin')
    const bicycles = c.get('bicycleService')
    const { id } = c.req.valid('param')
    return c.json(await bicycles.updateAdminBicycleStatus(id, c.req.valid('json')), 200)
  })

  return routes
}

function createRoutes() {
  return new OpenAPIHono<BicycleRouteEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorResponse('VALIDATION_ERROR', 'Invalid request payload', result.error.issues),
          400,
        )
      }
    },
  })
}
