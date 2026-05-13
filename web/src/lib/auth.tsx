import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest } from '@web-app-demo/contracts'
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { ApiClient } from './api'
import { clearSessionQueryCache, meQueryKey } from './auth-cache'
import { AuthContext, type AuthContextValue } from './auth-context'
import { bootstrapAuthSession } from './bootstrap-auth'

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [accessToken, setAccessTokenState] = useState<string | null>(null)
  const [isRefreshingSession, setIsRefreshingSession] = useState(true)

  const setAccessToken = useCallback(
    (nextAccessToken: string | null) => setAccessTokenState(nextAccessToken),
    [],
  )
  const resetSessionQueries = useCallback(
    () => clearSessionQueryCache(queryClient),
    [queryClient],
  )
  const handleAuthExpired = useCallback(async () => {
    setAccessToken(null)
    await resetSessionQueries()
  }, [resetSessionQueries, setAccessToken])

  const api = useMemo(
    () =>
      new ApiClient({
        getAccessToken: () => accessToken,
        setAccessToken,
        onAuthExpired: handleAuthExpired,
      }),
    [accessToken, handleAuthExpired, setAccessToken],
  )

  useEffect(() => {
    let isMounted = true
    const bootstrapApi = new ApiClient({
      getAccessToken: () => null,
      setAccessToken,
    })

    bootstrapAuthSession({
      api: bootstrapApi,
      shouldApply: () => isMounted,
      setAccessToken,
    })
      .then(() => {
        return undefined
      })
      .finally(() => {
        if (isMounted) {
          setIsRefreshingSession(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [setAccessToken])

  const meQuery = useQuery({
    queryKey: meQueryKey,
    enabled: !isRefreshingSession && Boolean(accessToken),
    queryFn: () => api.me(),
  })
  const isBootstrapping =
    isRefreshingSession || (Boolean(accessToken) && meQuery.isPending)

  const register = useCallback(
    async (input: RegisterRequest) => {
      const response = await api.register(input)
      await resetSessionQueries()
      setAccessToken(response.accessToken)
      queryClient.setQueryData(meQueryKey, { user: response.user })
    },
    [api, queryClient, resetSessionQueries, setAccessToken],
  )

  const login = useCallback(
    async (input: LoginRequest) => {
      const response = await api.login(input)
      await resetSessionQueries()
      setAccessToken(response.accessToken)
      queryClient.setQueryData(meQueryKey, { user: response.user })
    },
    [api, queryClient, resetSessionQueries, setAccessToken],
  )

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined)
    setAccessToken(null)
    await resetSessionQueries()
  }, [api, resetSessionQueries, setAccessToken])

  const value = useMemo<AuthContextValue>(
    () => ({
      api,
      user: meQuery.data?.user ?? null,
      isBootstrapping,
      isAuthenticated: Boolean(meQuery.data?.user),
      register,
      login,
      logout,
    }),
    [api, isBootstrapping, login, logout, meQuery.data?.user, register],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
