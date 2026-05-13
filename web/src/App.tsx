import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuth } from '@/lib/use-auth'
import { router } from './routes'

export default function App() {
  const auth = useAuth()
  const routerContext = useMemo(
    () => ({
      auth: {
        isBootstrapping: auth.isBootstrapping,
        user: auth.user,
      },
    }),
    [auth.isBootstrapping, auth.user],
  )

  useEffect(() => {
    void router.invalidate()
  }, [auth.isBootstrapping, auth.user?.id, auth.user?.role, auth.user?.status])

  return (
    <TooltipProvider>
      <RouterProvider router={router} context={routerContext} />
    </TooltipProvider>
  )
}
