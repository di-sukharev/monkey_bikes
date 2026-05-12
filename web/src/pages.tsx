import { Link, Outlet } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  manufacturerProfileUpsertRequestSchema,
  type AdminManufacturerProfileDto,
  type AdminManufacturerStatusUpdateRequest,
  type AdminUpdateUserRequest,
  type ManufacturerProfileDto,
  type ManufacturerProfileStatus,
  type ManufacturerProfileUpsertRequest,
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
  StoreIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { AuthForm } from '@/components/AuthForm'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ApiRequestError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'

const adminUsersPageSize = 20
const adminManufacturersPageSize = 20
const userRoles: UserRole[] = ['user', 'manufacturer', 'admin']
const userStatuses: UserStatus[] = ['active', 'blocked']
const manufacturerStatuses: ManufacturerProfileStatus[] = [
  'draft',
  'moderation',
  'approved',
  'rejected',
  'blocked',
]
const pageShellClass = 'mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-16'
const emptyManufacturerProfile: ManufacturerProfileUpsertRequest = {
  legalName: '',
  publicName: '',
  region: null,
  city: '',
  phone: '',
  email: '',
  description: '',
}
type ManufacturerProfileFormErrors = Partial<Record<keyof ManufacturerProfileUpsertRequest, string>>
type AdminManufacturerStatusFilter = ManufacturerProfileStatus | 'all'

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
            {auth.user?.role === 'manufacturer' && (
              <NavLink to="/manufacturer/profile">Manufacturer</NavLink>
            )}
            {auth.user?.role === 'admin' && <NavLink to="/admin/users">Users</NavLink>}
            {auth.user?.role === 'admin' && <NavLink to="/admin/manufacturers">Manufacturers</NavLink>}
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
  const mutationError = updateUser.error ? formatMutationError(updateUser.error) : null

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
              <AlertDescription>{formatMutationError(usersQuery.error)}</AlertDescription>
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
            <div className="overflow-hidden rounded-lg border">
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

export function ManufacturerProfilePage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['manufacturer', 'profile'],
    enabled: auth.user?.role === 'manufacturer',
    queryFn: () => auth.api.manufacturerProfile(),
  })

  const saveProfile = useMutation({
    mutationFn: (input: ManufacturerProfileUpsertRequest) => auth.api.upsertManufacturerProfile(input),
    onSuccess: async () => {
      setNotice('Profile saved as draft')
      await queryClient.invalidateQueries({ queryKey: ['manufacturer', 'profile'] })
    },
  })

  const submitProfile = useMutation({
    mutationFn: () => auth.api.submitManufacturerProfile(),
    onSuccess: async () => {
      setNotice('Profile submitted for moderation')
      await queryClient.invalidateQueries({ queryKey: ['manufacturer', 'profile'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Manufacturer profile"
        title="Login required"
        description="Sign in with a manufacturer account to edit the public manufacturer profile."
        action={
          <Button asChild>
            <Link to="/">Go to auth</Link>
          </Button>
        }
      />
    )
  }

  if (auth.user.role !== 'manufacturer') {
    return (
      <GateCard
        eyebrow="Manufacturer profile"
        title="Access denied"
        description="Your account is not registered as a manufacturer."
      />
    )
  }

  const profile = profileQuery.data?.profile ?? null
  const mutationError = saveProfile.error ?? submitProfile.error
  const formDisabled =
    profileQuery.isLoading || saveProfile.isPending || submitProfile.isPending || profile?.status === 'blocked'

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Manufacturer profile
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
            <CardDescription>
              Keep public manufacturer details ready for administrator moderation.
            </CardDescription>
          </div>
          {profile && (
            <CardAction>
              <StatusBadge status={profile.status} />
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {profileQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading profile...
            </div>
          )}

          {profileQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load profile</AlertTitle>
              <AlertDescription>{formatMutationError(profileQuery.error)}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Manufacturer profile</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not update profile</AlertTitle>
              <AlertDescription>{formatMutationError(mutationError)}</AlertDescription>
            </Alert>
          )}

          {profile?.moderationComment && (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>Moderation comment</AlertTitle>
              <AlertDescription>{profile.moderationComment}</AlertDescription>
            </Alert>
          )}

          <ManufacturerProfileForm
            key={profile?.id ?? 'empty'}
            disabled={formDisabled}
            initialValues={profile ? manufacturerProfileToForm(profile) : emptyManufacturerProfile}
            onSubmit={(input) => {
              setNotice(null)
              saveProfile.mutate(input)
            }}
          />

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={
                !profile ||
                profile.status === 'blocked' ||
                profile.status === 'moderation' ||
                saveProfile.isPending ||
                submitProfile.isPending
              }
              onClick={() => {
                setNotice(null)
                submitProfile.mutate()
              }}
            >
              Submit for moderation
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminManufacturersPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<AdminManufacturerStatusFilter>('moderation')
  const [notice, setNotice] = useState<string | null>(null)

  const manufacturersQuery = useQuery({
    queryKey: ['admin', 'manufacturers', page, status],
    enabled: auth.user?.role === 'admin',
    queryFn: () =>
      auth.api.adminManufacturers({
        page,
        pageSize: adminManufacturersPageSize,
        ...(status === 'all' ? {} : { status }),
      }),
  })

  const updateStatus = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: AdminManufacturerStatusUpdateRequest
    }) => auth.api.updateAdminManufacturerStatus(id, input),
    onSuccess: async (response) => {
      setNotice(`${response.profile.publicName} updated`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'manufacturers'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Admin manufacturers"
        title="Login required"
        description="Sign in with an administrator account to moderate manufacturer profiles."
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
        eyebrow="Admin manufacturers"
        title="Access denied"
        description="Your account does not have permission to moderate manufacturer profiles."
      />
    )
  }

  const data = manufacturersQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / adminManufacturersPageSize))
  const mutationError = updateStatus.error ? formatMutationError(updateStatus.error) : null

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Admin manufacturers
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Manufacturers</h1>
            <CardDescription>Review submitted manufacturer profiles before catalog work begins.</CardDescription>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <NativeSelect
              aria-label="Manufacturer status filter"
              className="w-full max-w-56"
              value={status}
              onChange={(event) => {
                setPage(1)
                setStatus(event.target.value as AdminManufacturerStatusFilter)
              }}
            >
              <NativeSelectOption value="all">All statuses</NativeSelectOption>
              {manufacturerStatuses.map((nextStatus) => (
                <NativeSelectOption key={nextStatus} value={nextStatus}>
                  {nextStatus}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {manufacturersQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading manufacturers...
            </div>
          )}

          {manufacturersQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load manufacturers</AlertTitle>
              <AlertDescription>{formatMutationError(manufacturersQuery.error)}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Manufacturer updated</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not update manufacturer</AlertTitle>
              <AlertDescription>{mutationError}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <StoreIcon />
                </EmptyMedia>
                <EmptyTitle>No manufacturer profiles found.</EmptyTitle>
                <EmptyDescription>The current status filter did not return any profiles.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Manufacturer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[32%]">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((profile) => (
                    <AdminManufacturerRow
                      key={profile.id}
                      disabled={updateStatus.isPending}
                      profile={profile}
                      onUpdate={(input) => {
                        setNotice(null)
                        updateStatus.mutate({ id: profile.id, input })
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
              disabled={page <= 1 || manufacturersQuery.isFetching}
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
              disabled={page >= totalPages || manufacturersQuery.isFetching}
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
  to: '/' | '/app' | '/admin/users' | '/admin/manufacturers' | '/manufacturer/profile'
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

function LoadingState({ message }: { message: string }) {
  return (
    <section className={pageShellClass}>
      <Card className="max-w-sm">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Spinner />
          {message}
        </CardContent>
      </Card>
    </section>
  )
}

function GateCard({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode
  description: string
  eyebrow: string
  title: string
}) {
  return (
    <section className={pageShellClass}>
      <Card className="max-w-2xl">
        <CardHeader>
          <Badge variant="outline" className="w-fit">
            {eyebrow}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        {action && <CardContent>{action}</CardContent>}
      </Card>
    </section>
  )
}

function FactCard({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
          {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
        </div>
        <Separator />
        <dd className="[overflow-wrap:anywhere] text-sm text-foreground">{value}</dd>
      </CardHeader>
    </Card>
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

function ManufacturerProfileForm({
  disabled,
  initialValues,
  onSubmit,
}: {
  disabled: boolean
  initialValues: ManufacturerProfileUpsertRequest
  onSubmit: (input: ManufacturerProfileUpsertRequest) => void
}) {
  const [values, setValues] = useState<ManufacturerProfileUpsertRequest>(initialValues)
  const [errors, setErrors] = useState<ManufacturerProfileFormErrors>({})

  function updateField<Key extends keyof ManufacturerProfileUpsertRequest>(
    field: Key,
    value: ManufacturerProfileUpsertRequest[Key],
  ) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const result = manufacturerProfileUpsertRequestSchema.safeParse(values)

        if (!result.success) {
          setErrors(manufacturerProfileIssuesToErrors(result.error.issues))
          return
        }

        setErrors({})
        onSubmit(result.data)
      }}
    >
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <ProfileInput
            disabled={disabled}
            error={errors.legalName}
            label="Legal name"
            name="legalName"
            value={values.legalName}
            onChange={(value) => updateField('legalName', value)}
          />
          <ProfileInput
            disabled={disabled}
            error={errors.publicName}
            label="Public name"
            name="publicName"
            value={values.publicName}
            onChange={(value) => updateField('publicName', value)}
          />
          <ProfileInput
            disabled={disabled}
            error={errors.email}
            label="Contact email"
            name="email"
            type="email"
            value={values.email}
            onChange={(value) => updateField('email', value)}
          />
          <ProfileInput
            disabled={disabled}
            error={errors.phone}
            label="Phone"
            name="phone"
            value={values.phone}
            onChange={(value) => updateField('phone', value)}
          />
          <ProfileInput
            disabled={disabled}
            error={errors.region}
            label="Region"
            name="region"
            value={values.region ?? ''}
            onChange={(value) => updateField('region', value)}
          />
          <ProfileInput
            disabled={disabled}
            error={errors.city}
            label="City"
            name="city"
            value={values.city}
            onChange={(value) => updateField('city', value)}
          />
        </div>

        <Field data-invalid={Boolean(errors.description)}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            className="min-h-32"
            disabled={disabled}
            id="description"
            name="description"
            value={values.description}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'description-error' : undefined}
            onChange={(event) => updateField('description', event.target.value)}
          />
          {errors.description && <FieldError id="description-error">{errors.description}</FieldError>}
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={disabled}>
            Save draft
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

function ProfileInput({
  disabled,
  error,
  label,
  name,
  onChange,
  type = 'text',
  value,
}: {
  disabled: boolean
  error?: string
  label: string
  name: keyof ManufacturerProfileUpsertRequest
  onChange: (value: string) => void
  type?: 'email' | 'text'
  value: string
}) {
  const errorId = error ? `${name}-error` : undefined

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        className="h-11"
        disabled={disabled}
        id={name}
        name={name}
        type={type}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  )
}

function AdminManufacturerRow({
  disabled,
  profile,
  onUpdate,
}: {
  disabled: boolean
  profile: AdminManufacturerProfileDto
  onUpdate: (input: AdminManufacturerStatusUpdateRequest) => void
}) {
  const [moderationComment, setModerationComment] = useState(profile.moderationComment ?? '')
  const requiresModerationDecision = profile.status === 'moderation'
  const requiresComment = moderationComment.trim().length === 0

  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div className="grid gap-1">
          <strong className="font-medium">{profile.publicName}</strong>
          <span className="[overflow-wrap:anywhere] text-muted-foreground">{profile.legalName}</span>
          <span className="[overflow-wrap:anywhere] text-muted-foreground">{profile.user.email}</span>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={profile.status} />
      </TableCell>
      <TableCell>{profile.city}</TableCell>
      <TableCell>
        {profile.submittedAt ? new Date(profile.submittedAt).toLocaleDateString() : 'Not submitted'}
      </TableCell>
      <TableCell>
        <div className="grid gap-2">
          <Input
            className="h-11"
            aria-label={`Moderation comment for ${profile.publicName}`}
            disabled={disabled}
            value={moderationComment}
            placeholder="Moderation comment"
            onChange={(event) => setModerationComment(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled || !requiresModerationDecision}
              onClick={() => onUpdate({ status: 'approved' })}
            >
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || !requiresModerationDecision || requiresComment}
              onClick={() => onUpdate({ status: 'rejected', moderationComment })}
            >
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={disabled || profile.status === 'blocked' || requiresComment}
              onClick={() => onUpdate({ status: 'blocked', moderationComment })}
            >
              Block
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

function StatusBadge({ status }: { status: ManufacturerProfileStatus }) {
  return <Badge variant={status === 'blocked' || status === 'rejected' ? 'destructive' : 'secondary'}>{status}</Badge>
}

function manufacturerProfileToForm(profile: ManufacturerProfileDto): ManufacturerProfileUpsertRequest {
  return {
    legalName: profile.legalName,
    publicName: profile.publicName,
    region: profile.region,
    city: profile.city,
    phone: profile.phone,
    email: profile.email,
    description: profile.description,
  }
}

function manufacturerProfileIssuesToErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): ManufacturerProfileFormErrors {
  return issues.reduce<ManufacturerProfileFormErrors>((errors, issue) => {
    const field = issue.path[0]
    if (typeof field === 'string' && field in emptyManufacturerProfile) {
      errors[field as keyof ManufacturerProfileUpsertRequest] = issue.message
    }
    return errors
  }, {})
}

function formatMutationError(error: unknown) {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return 'Unexpected request error'
}
