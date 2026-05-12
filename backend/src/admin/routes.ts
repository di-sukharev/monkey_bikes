import {
  adminManufacturerStatusUpdateRequestSchema,
  adminManufacturersQuerySchema,
  adminManufacturersResponseSchema,
  adminManufacturerProfileSchema,
  adminUpdateUserRequestSchema,
  adminUserResponseSchema,
  adminUsersQuerySchema,
  adminUsersResponseSchema,
  apiErrorSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { requireRole } from '../auth/guards'
import type { AuthService } from '../auth/service'
import { errorResponse } from '../http/errors'
import type { ManufacturerProfileService } from '../manufacturer/service'
import type { AdminUserService } from './service'

type AdminRouteEnv = {
  Variables: {
    adminUserService: AdminUserService
    authService: AuthService
    manufacturerProfileService: ManufacturerProfileService
  }
}

const errorResponseContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const userIdParamsSchema = z.object({
  id: z.string().min(1),
})

const manufacturerProfileIdParamsSchema = z.object({
  id: z.string().min(1),
})

const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  request: {
    query: adminUsersQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminUsersResponseSchema,
        },
      },
      description: 'Paginated users list',
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

const getUserRoute = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: userIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminUserResponseSchema,
        },
      },
      description: 'User details',
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
      description: 'User not found',
    },
  },
})

const updateUserRoute = createRoute({
  method: 'patch',
  path: '/users/{id}',
  request: {
    params: userIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: adminUpdateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminUserResponseSchema,
        },
      },
      description: 'Updated user',
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
      description: 'User not found',
    },
    409: {
      content: errorResponseContent,
      description: 'Role or status change violates admin safety rules',
    },
  },
})

const listManufacturersRoute = createRoute({
  method: 'get',
  path: '/manufacturers',
  request: {
    query: adminManufacturersQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: adminManufacturersResponseSchema,
        },
      },
      description: 'Paginated manufacturer profiles list',
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

const updateManufacturerStatusRoute = createRoute({
  method: 'patch',
  path: '/manufacturers/{id}/status',
  request: {
    params: manufacturerProfileIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: adminManufacturerStatusUpdateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ profile: adminManufacturerProfileSchema }),
        },
      },
      description: 'Updated manufacturer profile moderation status',
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
      description: 'Manufacturer profile not found',
    },
  },
})

export function createAdminRoutes() {
  const routes = new OpenAPIHono<AdminRouteEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorResponse('VALIDATION_ERROR', 'Invalid request payload', result.error.issues),
          400,
        )
      }
    },
  })

  routes.openapi(listUsersRoute, async (c) => {
    await requireRole(c, 'admin')
    const adminUsers = c.get('adminUserService')

    return c.json(await adminUsers.listUsers(c.req.valid('query')), 200)
  })

  routes.openapi(getUserRoute, async (c) => {
    await requireRole(c, 'admin')
    const adminUsers = c.get('adminUserService')
    const { id } = c.req.valid('param')

    return c.json(await adminUsers.getUser(id), 200)
  })

  routes.openapi(updateUserRoute, async (c) => {
    const actor = await requireRole(c, 'admin')
    const adminUsers = c.get('adminUserService')
    const { id } = c.req.valid('param')

    return c.json(await adminUsers.updateUser(id, c.req.valid('json'), actor), 200)
  })

  routes.openapi(listManufacturersRoute, async (c) => {
    await requireRole(c, 'admin')
    const manufacturerProfiles = c.get('manufacturerProfileService')

    return c.json(await manufacturerProfiles.listAdminManufacturers(c.req.valid('query')), 200)
  })

  routes.openapi(updateManufacturerStatusRoute, async (c) => {
    await requireRole(c, 'admin')
    const manufacturerProfiles = c.get('manufacturerProfileService')
    const { id } = c.req.valid('param')

    return c.json(
      await manufacturerProfiles.updateAdminManufacturerStatus(id, c.req.valid('json')),
      200,
    )
  })

  return routes
}
