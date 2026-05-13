import { Link, Outlet } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AdminUpdateUserRequest,
  type UserDto,
  type UserRole,
  type UserStatus,
} from '@web-app-demo/contracts'
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LogOutIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { AuthForm } from '@/components/AuthForm'
import { FactCard, GateCard, LoadingState } from '@/components/page-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { pageShellClass } from '@/lib/page-layout'
import { formatRequestError } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'

const adminUsersPageSize = 20
const userRoles: UserRole[] = ['user', 'manufacturer', 'admin']
const userStatuses: UserStatus[] = ['active', 'blocked']

export function RootLayout() {
  const auth = useAuth()

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              BR
            </span>
            web_app_demo
          </Link>

          <nav className="order-3 flex w-full gap-1 sm:order-none sm:ml-auto sm:w-auto">
            <NavLink to="/">Auth</NavLink>
            <NavLink to="/app">App</NavLink>
            <NavLink to="/bicycles">Catalog</NavLink>
            {auth.user?.role === 'user' && <NavLink to="/orders">My orders</NavLink>}
            {auth.user?.role === 'manufacturer' && (
              <NavLink to="/manufacturer/profile">Manufacturer</NavLink>
            )}
            {auth.user?.role === 'manufacturer' && (
              <NavLink to="/manufacturer/bicycles">My bicycles</NavLink>
            )}
            {auth.user?.role === 'manufacturer' && (
              <NavLink to="/manufacturer/orders">Orders</NavLink>
            )}
            {auth.user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            {auth.user?.role === 'admin' && <NavLink to="/admin/users">Users</NavLink>}
            {auth.user?.role === 'admin' && <NavLink to="/admin/manufacturers">Manufacturers</NavLink>}
            {auth.user?.role === 'admin' && <NavLink to="/admin/bicycles">Bicycles</NavLink>}
            {auth.user?.role === 'admin' && <NavLink to="/admin/orders">Orders</NavLink>}
            {auth.user?.role === 'admin' && <NavLink to="/admin/payments">Payments</NavLink>}
            {auth.user?.role === 'admin' && <NavLink to="/admin/checklists">Checklists</NavLink>}
          </nav>

          {auth.isAuthenticated && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto sm:ml-0"
              onClick={() => void auth.logout()}
            >
              <LogOutIcon data-icon="inline-start" />
              Logout
            </Button>
          )}
        </div>
      </header>
      <Outlet />
    </main>
  )
}

export function HomePage() {
  const auth = useAuth()

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (auth.user) {
    return (
      <section className={pageShellClass}>
        <Card className="max-w-3xl">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Authenticated starter
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Session is active
            </h1>
            <CardDescription className="text-base">
              Logged in as <strong className="text-foreground">{auth.user.email}</strong>. This is
              the baseline auth pattern for future web features.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/app">
                Open app
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section
      className={cn(
        pageShellClass,
        'grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-center',
      )}
    >
      <div className="grid gap-5">
        <Badge variant="outline" className="w-fit">
          Golden path template
        </Badge>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Auth, validation, API state, and forms are wired from day one.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          The web app uses shared Zod contracts, TanStack Query for server state, TanStack Form for
          input state, and an API client that refreshes sessions through the backend.
        </p>
      </div>
      <AuthForm />
    </section>
  )
}

export function AppPage() {
  const auth = useAuth()

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Protected example"
        title="Login required"
        description="This route intentionally stays small and shows where protected product UI begins."
        action={
          <Button asChild>
            <Link to="/">Go to auth</Link>
          </Button>
        }
      />
    )
  }

  return (
    <section className={cn(pageShellClass, 'grid gap-6')}>
      <div className="grid gap-3">
        <Badge variant="secondary" className="w-fit">
          Current user
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {auth.user.displayName ?? auth.user.email}
        </h1>
        <p className="text-muted-foreground">{auth.user.email}</p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <FactCard label="User ID" value={auth.user.id} icon={<UserRoundIcon />} />
        <FactCard label="Created" value={new Date(auth.user.createdAt).toLocaleString()} />
        <FactCard label="Role" value={auth.user.role} icon={<ShieldCheckIcon />} />
        <FactCard label="Status" value={auth.user.status} />
      </dl>
    </section>
  )
}

export function AdminUsersPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page],
    enabled: auth.user?.role === 'admin',
    queryFn: () => auth.api.adminUsers({ page, pageSize: adminUsersPageSize }),
  })

  const updateUser = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminUpdateUserRequest }) =>
      auth.api.updateAdminUser(id, input),
    onSuccess: async (response) => {
      setNotice(`${response.user.email} updated`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Admin users"
        title="Login required"
        description="Sign in with an administrator account to manage users."
        action={
          <Button asChild>
            <Link to="/">Go to auth</Link>
          </Button>
        }
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Admin users"
        title="Access denied"
        description="Your account does not have permission to manage users."
      />
    )
  }

  const data = usersQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / adminUsersPageSize))
  const mutationError = updateUser.error ? formatRequestError(updateUser.error) : null

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Admin users
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
            <CardDescription>Review accounts and keep role/status changes centralized.</CardDescription>
          </div>
          {data && (
            <CardAction>
              <Badge variant="secondary">
                {data.total} total, page {data.page} of {totalPages}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {usersQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading users...
            </div>
          )}

          {usersQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load users</AlertTitle>
              <AlertDescription>{formatRequestError(usersQuery.error)}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>User updated</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not update user</AlertTitle>
              <AlertDescription>{mutationError}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersRoundIcon />
                </EmptyMedia>
                <EmptyTitle>No users found.</EmptyTitle>
                <EmptyDescription>The current filters did not return any accounts.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42%]">User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((user) => (
                    <AdminUserRow
                      key={user.id}
                      disabled={updateUser.isPending}
                      user={user}
                      onUpdate={(input) => {
                        setNotice(null)
                        updateUser.mutate({ id: user.id, input })
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination className="justify-end">
        <PaginationContent>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || usersQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Previous
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || usersQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </section>
  )
}

function NavLink({
  to,
  children,
}: {
  to:
    | '/'
    | '/app'
    | '/admin'
    | '/admin/users'
    | '/admin/manufacturers'
    | '/admin/bicycles'
    | '/admin/orders'
    | '/admin/payments'
    | '/admin/checklists'
    | '/manufacturer/profile'
    | '/manufacturer/bicycles'
    | '/manufacturer/orders'
    | '/bicycles'
    | '/orders'
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
      activeProps={{
        className: cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'text-foreground'),
      }}
    >
      {children}
    </Link>
  )
}

function AdminUserRow({
  disabled,
  user,
  onUpdate,
}: {
  disabled: boolean
  user: UserDto
  onUpdate: (input: AdminUpdateUserRequest) => void
}) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div className="grid gap-1">
          <strong className="font-medium">{user.displayName ?? user.email}</strong>
          <span className="[overflow-wrap:anywhere] text-muted-foreground">{user.email}</span>
        </div>
      </TableCell>
      <TableCell>
        <NativeSelect
          aria-label={`Role for ${user.email}`}
          className="w-full min-w-36"
          disabled={disabled}
          size="default"
          value={user.role}
          onChange={(event) => {
            const role = event.target.value as UserRole
            if (role !== user.role) {
              onUpdate({ role })
            }
          }}
        >
          {userRoles.map((role) => (
            <NativeSelectOption key={role} value={role}>
              {role}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </TableCell>
      <TableCell>
        <NativeSelect
          aria-label={`Status for ${user.email}`}
          className="w-full min-w-32"
          disabled={disabled}
          size="default"
          value={user.status}
          onChange={(event) => {
            const status = event.target.value as UserStatus
            if (status !== user.status) {
              onUpdate({ status })
            }
          }}
        >
          {userStatuses.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {status}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </TableCell>
      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
    </TableRow>
  )
}
