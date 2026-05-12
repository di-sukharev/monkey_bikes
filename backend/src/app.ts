import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import type { DbClient } from './db'
import type { AppEnv } from './env'
import { createAdminRoutes } from './admin/routes'
import { AdminUserService } from './admin/service'
import { createAuthRoutes } from './auth/routes'
import { AuthService } from './auth/service'
import {
  createAdminBicycleRoutes,
  createManufacturerBicycleRoutes,
  createPublicBicycleRoutes,
} from './bicycle/routes'
import { BicycleService } from './bicycle/service'
import { errorResponse, handleError } from './http/errors'
import { createManufacturerRoutes } from './manufacturer/routes'
import { ManufacturerProfileService } from './manufacturer/service'
import { createAdminOrderRoutes, createOrderRoutes } from './order/routes'
import { OrderService } from './order/service'

type AppBindings = {
  Variables: {
    adminUserService: AdminUserService
    authService: AuthService
    bicycleService: BicycleService
    env: AppEnv
    manufacturerProfileService: ManufacturerProfileService
    orderService: OrderService
  }
}

type CreateAppOptions = {
  env: AppEnv
  prisma: DbClient
}

export function createApp({ env, prisma }: CreateAppOptions) {
  const adminUserService = new AdminUserService(prisma)
  const authService = new AuthService(prisma, env)
  const bicycleService = new BicycleService(prisma)
  const manufacturerProfileService = new ManufacturerProfileService(prisma)
  const orderService = new OrderService(prisma)
  const app = new OpenAPIHono<AppBindings>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorResponse('VALIDATION_ERROR', 'Invalid request payload', result.error.issues),
          400,
        )
      }
    },
  })

  app.use(secureHeaders())
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return env.CORS_ORIGINS[0] ?? null
        return env.CORS_ORIGINS.includes(origin) ? origin : null
      },
      allowHeaders: ['Content-Type', 'Authorization', 'X-Client-Platform'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
      credentials: true,
      maxAge: 600,
    }),
  )
  app.use('*', async (c, next) => {
    c.set('adminUserService', adminUserService)
    c.set('authService', authService)
    c.set('bicycleService', bicycleService)
    c.set('env', env)
    c.set('manufacturerProfileService', manufacturerProfileService)
    c.set('orderService', orderService)
    await next()
  })

  app.get('/', (c) => {
    return c.json({
      name: 'web_app_demo backend',
      status: 'ok',
    })
  })

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
    })
  })

  app.route('/api/auth', createAuthRoutes())
  app.route('/api/bicycles', createPublicBicycleRoutes())
  app.route('/api/manufacturer', createManufacturerRoutes())
  app.route('/api/manufacturer', createManufacturerBicycleRoutes())
  app.route('/api/orders', createOrderRoutes())
  app.route('/api/admin', createAdminRoutes())
  app.route('/api/admin', createAdminBicycleRoutes())
  app.route('/api/admin', createAdminOrderRoutes())

  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'web_app_demo API',
      version: '1.0.0',
    },
  })

  app.notFound((c) => c.json(errorResponse('NOT_FOUND', 'Route not found'), 404))
  app.onError(handleError)

  return app
}

export type AppType = ReturnType<typeof createApp>
