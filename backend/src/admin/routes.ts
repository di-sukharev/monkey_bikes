import {
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
import type { AdminUserService } from './service'

type AdminRouteEnv = {
  Variables: {
    adminUserService: AdminUserService
    authService: AuthService
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

  return routes
}
