import {
  apiErrorSchema,
  authResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  meResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  registerRequestSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import type { AppEnv } from '../env'
import { AppError, errorResponse } from '../http/errors'
import { requireAuth } from './guards'
import type { AuthService } from './service'

const refreshCookieName = 'web_app_demo_refresh'

type AuthRouteEnv = {
  Variables: {
    authService: AuthService
    env: AppEnv
  }
}

const authResponseContent = {
  'application/json': {
    schema: authResponseSchema,
  },
}

const refreshResponseContent = {
  'application/json': {
    schema: refreshResponseSchema,
  },
}

const meResponseContent = {
  'application/json': {
    schema: meResponseSchema,
  },
}

const errorResponseContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  request: {
    body: {
      content: {
        'application/json': {
          schema: registerRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: authResponseContent,
      description: 'Created user and session',
    },
    400: {
      content: errorResponseContent,
      description: 'Invalid payload',
    },
    409: {
      content: errorResponseContent,
      description: 'Email already exists',
    },
  },
})

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: loginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: authResponseContent,
      description: 'Created session',
    },
    400: {
      content: errorResponseContent,
      description: 'Invalid payload',
    },
    401: {
      content: errorResponseContent,
      description: 'Invalid credentials',
    },
    403: {
      content: errorResponseContent,
      description: 'User is blocked',
    },
  },
})

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  request: {
    body: {
      content: {
        'application/json': {
          schema: refreshRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: refreshResponseContent,
      description: 'Rotated refresh session and returned a new access token',
    },
    400: {
      content: errorResponseContent,
      description: 'Invalid payload',
    },
    401: {
      content: errorResponseContent,
      description: 'Invalid refresh token',
    },
    403: {
      content: errorResponseContent,
      description: 'User is blocked',
    },
  },
})

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  responses: {
    200: {
      content: meResponseContent,
      description: 'Current user',
    },
    401: {
      content: errorResponseContent,
      description: 'Invalid access token',
    },
    403: {
      content: errorResponseContent,
      description: 'User is blocked',
    },
  },
})

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  request: {
    body: {
      content: {
        'application/json': {
          schema: logoutRequestSchema,
        },
      },
    },
  },
  responses: {
    204: {
      description: 'Session revoked',
    },
    400: {
      content: errorResponseContent,
      description: 'Invalid payload',
    },
  },
})

export function createAuthRoutes() {
  const routes = new OpenAPIHono<AuthRouteEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorResponse('VALIDATION_ERROR', 'Invalid request payload', result.error.issues),
          400,
        )
      }
    },
  })

  routes.openapi(registerRoute, async (c) => {
    const auth = c.get('authService')
    const env = c.get('env')
    const result = await auth.register(c.req.valid('json'), requestMetadata(c))
    setRefreshCookie(c, result.refreshToken, env)

    return c.json(responseForClient(c, result), 201)
  })

  routes.openapi(loginRoute, async (c) => {
    const auth = c.get('authService')
    const env = c.get('env')
    const result = await auth.login(c.req.valid('json'), requestMetadata(c))
    setRefreshCookie(c, result.refreshToken, env)

    return c.json(responseForClient(c, result), 200)
  })

  routes.openapi(refreshRoute, async (c) => {
    const auth = c.get('authService')
    const env = c.get('env')
    const body = c.req.valid('json')
    const cookieRefreshToken = getRefreshCookie(c)
    assertTrustedCookieRequest(c, env, body.refreshToken, cookieRefreshToken)
    const result = await auth.refresh(body.refreshToken ?? cookieRefreshToken, requestMetadata(c))
    setRefreshCookie(c, result.refreshToken, env)

    return c.json(responseForClient(c, result), 200)
  })

  routes.openapi(meRoute, async (c) => {
    return c.json({ user: await requireAuth(c) }, 200)
  })

  routes.openapi(logoutRoute, async (c) => {
    const auth = c.get('authService')
    const body = c.req.valid('json')
    const env = c.get('env')
    const cookieRefreshToken = getRefreshCookie(c)
    assertTrustedCookieRequest(c, env, body.refreshToken, cookieRefreshToken)
    await auth.logout(body.refreshToken ?? cookieRefreshToken)
    deleteCookie(c, refreshCookieName, {
      path: '/api/auth',
      secure: refreshCookieSecure(env),
      sameSite: refreshCookieSameSite(env),
    })

    return c.body(null, 204)
  })

  return routes
}

function requestMetadata(c: Context): { userAgent?: string; ipAddress?: string } {
  const forwardedFor = c.req.header('x-forwarded-for')
  return {
    userAgent: c.req.header('user-agent'),
    ipAddress: forwardedFor?.split(',')[0]?.trim(),
  }
}

function getRefreshCookie(c: Context) {
  return getCookie(c, refreshCookieName)
}

function assertTrustedCookieRequest(
  c: Context,
  env: AppEnv,
  bodyRefreshToken: string | undefined,
  cookieRefreshToken: string | undefined,
) {
  if (env.APP_ENV !== 'production' || bodyRefreshToken !== undefined || !cookieRefreshToken) {
    return
  }

  const origin = c.req.header('origin')
  if (origin && env.CORS_ORIGINS.includes(origin)) {
    return
  }

  throw new AppError(403, 'FORBIDDEN', 'Cookie auth requests require a trusted Origin')
}

function setRefreshCookie(c: Context, refreshToken: string, env: AppEnv) {
  setCookie(c, refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: refreshCookieSecure(env),
    sameSite: refreshCookieSameSite(env),
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  })
}

function refreshCookieSecure(env: AppEnv) {
  return env.APP_ENV === 'production' ? true : env.COOKIE_SECURE
}

function refreshCookieSameSite(env: AppEnv): 'None' | 'Lax' {
  return env.APP_ENV === 'production' ? 'None' : 'Lax'
}

function responseForClient<T extends { refreshToken: string }>(c: Context, response: T) {
  if (c.req.header('x-client-platform') === 'mobile') {
    return response
  }

  const { refreshToken: _refreshToken, ...webResponse } = response
  return webResponse
}
