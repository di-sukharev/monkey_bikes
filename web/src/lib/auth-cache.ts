import type { QueryClient } from '@tanstack/react-query'

export const meQueryKey = ['auth', 'me'] as const

const sessionQueryRoots = [['auth'], ['admin'], ['manufacturer'], ['orders']] as const

export async function clearSessionQueryCache(queryClient: QueryClient) {
  await Promise.all(
    sessionQueryRoots.map((queryKey) => queryClient.cancelQueries({ queryKey })),
  )

  for (const queryKey of sessionQueryRoots) {
    queryClient.removeQueries({ queryKey })
  }
}
