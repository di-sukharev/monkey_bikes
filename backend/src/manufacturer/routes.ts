import {
  apiErrorSchema,
  manufacturerProfileGetResponseSchema,
  manufacturerProfileResponseSchema,
  manufacturerProfileSubmitResponseSchema,
  manufacturerProfileUpsertRequestSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { requireRole } from '../auth/guards'
import type { AuthService } from '../auth/service'
import { errorResponse } from '../http/errors'
import type { ManufacturerProfileService } from './service'

type ManufacturerRouteEnv = {
  Variables: {
    authService: AuthService
    manufacturerProfileService: ManufacturerProfileService
  }
}

const errorResponseContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const getProfileRoute = createRoute({
  method: 'get',
  path: '/profile',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: manufacturerProfileGetResponseSchema,
        },
      },
      description: 'Current manufacturer profile',
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

const upsertProfileRoute = createRoute({
  method: 'put',
  path: '/profile',
  request: {
    body: {
      content: {
        'application/json': {
          schema: manufacturerProfileUpsertRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: manufacturerProfileResponseSchema,
        },
      },
      description: 'Saved manufacturer profile as draft',
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
      description: 'Profile state does not allow changes',
    },
  },
})

const submitProfileRoute = createRoute({
  method: 'post',
  path: '/profile/submit',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: manufacturerProfileSubmitResponseSchema,
        },
      },
      description: 'Submitted manufacturer profile for moderation',
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
      description: 'Profile state does not allow submission',
    },
  },
})

export function createManufacturerRoutes() {
  const routes = new OpenAPIHono<ManufacturerRouteEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorResponse('VALIDATION_ERROR', 'Invalid request payload', result.error.issues),
          400,
        )
      }
    },
  })

  routes.openapi(getProfileRoute, async (c) => {
    const user = await requireRole(c, 'manufacturer')
    const manufacturerProfiles = c.get('manufacturerProfileService')

    return c.json(await manufacturerProfiles.getCurrentProfile(user), 200)
  })

  routes.openapi(upsertProfileRoute, async (c) => {
    const user = await requireRole(c, 'manufacturer')
    const manufacturerProfiles = c.get('manufacturerProfileService')

    return c.json(await manufacturerProfiles.upsertCurrentProfile(user, c.req.valid('json')), 200)
  })

  routes.openapi(submitProfileRoute, async (c) => {
    const user = await requireRole(c, 'manufacturer')
    const manufacturerProfiles = c.get('manufacturerProfileService')

    return c.json(await manufacturerProfiles.submitCurrentProfile(user), 200)
  })

  return routes
}
