import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import type { UserDto, UserRole } from '@web-app-demo/contracts'

import { AdminChecklistsPage, AdminDashboardPage } from './features/admin/pages'
import {
  AdminBicyclesPage,
  BicycleDetailPage,
  CatalogPage,
  ManufacturerBicyclesPage,
} from './features/bicycles/pages'
import { AdminManufacturersPage, ManufacturerProfilePage } from './features/manufacturers/pages'
import {
  AdminOrderDetailPage,
  AdminOrdersPage,
  OrderDetailPage,
  OrderRequestPage,
  OrdersPage,
} from './features/orders/pages'
import {
  ManufacturerOrderDetailPage,
  ManufacturerOrdersPage,
} from './features/orders/manufacturer-pages'
import { AdminPaymentsPage } from './features/payments/pages'
import { normalizeAdminReportsSearch } from './features/reports/model'
import { AdminReportsPage } from './features/reports/pages'
import { AdminUsersPage, AppPage, HomePage, RootLayout } from './pages'

type RouterAuthContext = {
  isBootstrapping: boolean
  user: UserDto | null
}

type RouterContext = {
  auth: RouterAuthContext
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

const requireAuthenticated = requireAuth()
const requireCustomer = requireAuth('user')
const requireManufacturer = requireAuth('manufacturer')
const requireAdmin = requireAuth('admin')

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  beforeLoad: requireAuthenticated,
  component: AppPage,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  beforeLoad: requireAdmin,
  component: AdminDashboardPage,
})

const adminUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  beforeLoad: requireAdmin,
  component: AdminUsersPage,
})

const adminManufacturersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/manufacturers',
  beforeLoad: requireAdmin,
  component: AdminManufacturersPage,
})

const adminBicyclesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/bicycles',
  beforeLoad: requireAdmin,
  validateSearch: (search: Record<string, unknown>) => ({
    ...positivePageSearch(search.page),
    ...(typeof search.status === 'string' ? { status: search.status } : {}),
  }),
  component: AdminBicyclesPage,
})

const adminOrdersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/orders',
  beforeLoad: requireAdmin,
  validateSearch: (search: Record<string, unknown>) => ({
    ...positivePageSearch(search.page),
    ...(typeof search.date === 'string' ? { date: search.date } : {}),
    ...(typeof search.quickFilter === 'string' ? { quickFilter: search.quickFilter } : {}),
    ...(typeof search.status === 'string' ? { status: search.status } : {}),
  }),
  component: AdminOrdersPage,
})

const adminPaymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/payments',
  beforeLoad: requireAdmin,
  component: AdminPaymentsPage,
})

const adminChecklistsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/checklists',
  beforeLoad: requireAdmin,
  validateSearch: (search: Record<string, unknown>) => ({
    ...positivePageSearch(search.page),
    ...(typeof search.bicycleId === 'string' ? { bicycleId: search.bicycleId } : {}),
    ...(typeof search.orderId === 'string' ? { orderId: search.orderId } : {}),
    ...(typeof search.type === 'string' ? { type: search.type } : {}),
  }),
  component: AdminChecklistsPage,
})

const adminReportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/reports',
  beforeLoad: requireAdmin,
  validateSearch: (search: Record<string, unknown>) => normalizeAdminReportsSearch(search),
  component: AdminReportsPage,
})

const adminOrderDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/orders/$id',
  beforeLoad: requireAdmin,
  component: AdminOrderDetailPage,
})

const manufacturerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manufacturer/profile',
  beforeLoad: requireManufacturer,
  component: ManufacturerProfilePage,
})

const manufacturerBicyclesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manufacturer/bicycles',
  beforeLoad: requireManufacturer,
  component: ManufacturerBicyclesPage,
})

const manufacturerOrdersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manufacturer/orders',
  beforeLoad: requireManufacturer,
  component: ManufacturerOrdersPage,
})

const manufacturerOrderDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manufacturer/orders/$id',
  beforeLoad: requireManufacturer,
  component: ManufacturerOrderDetailPage,
})

const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bicycles',
  component: CatalogPage,
})

const bicycleDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bicycles/$id',
  component: BicycleDetailPage,
})

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  beforeLoad: requireCustomer,
  component: OrdersPage,
})

const newOrderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/new',
  beforeLoad: requireCustomer,
  validateSearch: (search: Record<string, unknown>) => ({
    bicycleIds: typeof search.bicycleIds === 'string' ? search.bicycleIds : undefined,
  }),
  component: OrderRequestPage,
})

const orderDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$id',
  beforeLoad: requireCustomer,
  component: OrderDetailPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute,
  adminRoute,
  adminUsersRoute,
  adminManufacturersRoute,
  adminBicyclesRoute,
  adminOrdersRoute,
  adminPaymentsRoute,
  adminChecklistsRoute,
  adminReportsRoute,
  adminOrderDetailRoute,
  manufacturerProfileRoute,
  manufacturerBicyclesRoute,
  manufacturerOrdersRoute,
  manufacturerOrderDetailRoute,
  catalogRoute,
  bicycleDetailRoute,
  ordersRoute,
  newOrderRoute,
  orderDetailRoute,
])

export const router = createRouter({
  routeTree,
  context: {
    auth: {
      isBootstrapping: true,
      user: null,
    },
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function positivePageSearch(value: unknown) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? { page } : {}
}

function requireAuth(requiredRole?: UserRole) {
  return ({ context, location }: { context: RouterContext; location: { href: string } }) => {
    const { auth } = context

    if (auth.isBootstrapping) {
      return
    }

    if (!auth.user) {
      throw redirect({
        href: `/?${new URLSearchParams({ redirectTo: location.href }).toString()}`,
        replace: true,
      })
    }

    if (requiredRole && auth.user.role !== requiredRole) {
      return
    }
  }
}
