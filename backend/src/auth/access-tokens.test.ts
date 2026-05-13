import { describe, expect, test } from 'bun:test'

import type { AppEnv } from '../env'
import { signAccessToken, verifyAccessToken } from './access-tokens'

const env: AppEnv = {
  PORT: 43180,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:54329/web_app_demo',
  JWT_SECRET: '12345678901234567890123456789012',
  CORS_ORIGINS: ['http://localhost:43181'],
  ACCESS_TOKEN_TTL_SECONDS: 60,
  REFRESH_TOKEN_TTL_DAYS: 30,
  COOKIE_SECURE: false,
  APP_ENV: 'test',
  PAYMENT_PROVIDER: 'stub',
  PAYMENT_STUB_DEV_ENDPOINTS_ENABLED: true,
  PAYMENT_CURRENCY: 'RUB',
}

describe('access tokens', () => {
  test('signs and verifies session-scoped JWT payloads', async () => {
    const token = await signAccessToken(
      {
        sub: 'user_1',
        sessionId: 'session_1',
        email: 'user@example.com',
      },
      env,
    )

    await expect(verifyAccessToken(token, env)).resolves.toEqual({
      sub: 'user_1',
      sessionId: 'session_1',
      email: 'user@example.com',
    })
  })
})
