import { RouterProvider } from '@tanstack/react-router'

import { TooltipProvider } from '@/components/ui/tooltip'
import { router } from './routes'

export default function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  )
}
