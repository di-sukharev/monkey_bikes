import type { UserRole } from '@web-app-demo/contracts'
import type { Context, Env } from 'hono'

import { AppError } from '../http/errors'
import type { AuthService, AuthenticatedUser } from './service'

type AuthGuardEnv = Env & {
  Variables: {
    authService: AuthService
  }
}

export async function requireAuth<TEnv extends AuthGuardEnv>(
  c: Context<TEnv>,
): Promise<AuthenticatedUser> {
  const auth = c.get('authService')
  return auth.authenticateAccessToken(bearerToken(c))
}

export async function requireRole<TEnv extends AuthGuardEnv>(
  c: Context<TEnv>,
  allowedRoles: UserRole | readonly UserRole[],
): Promise<AuthenticatedUser> {
  const user = await requireAuth(c)
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  if (!roles.includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
  }

  return user
}

function bearerToken(c: Context) {
  const authorization = c.req.header('authorization')
  if (!authorization?.startsWith('Bearer ')) return undefined
  return authorization.slice('Bearer '.length)
}
