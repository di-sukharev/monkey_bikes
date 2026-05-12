import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminManufacturerStatusUpdateRequest,
  ManufacturerProfileUpsertRequest,
} from '@web-app-demo/contracts'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  StoreIcon,
} from 'lucide-react'
import { useState } from 'react'

import { GateCard, LoadingState } from '@/components/page-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { pageShellClass } from '@/lib/page-layout'
import { formatRequestError } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'
import { AdminManufacturerRow, ManufacturerStatusBadge } from './admin-manufacturer-row'
import {
  emptyManufacturerProfile,
  manufacturerProfileQueryKey,
  manufacturerProfileToForm,
  manufacturerStatuses,
  type AdminManufacturerStatusFilter,
} from './model'
import { ManufacturerProfileForm } from './profile-form'

const adminManufacturersPageSize = 20

export function ManufacturerProfilePage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const profileQueryKey = manufacturerProfileQueryKey(auth.user?.id)

  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    enabled: auth.user?.role === 'manufacturer',
    queryFn: () => auth.api.manufacturerProfile(),
  })

  const saveProfile = useMutation({
    mutationFn: (input: ManufacturerProfileUpsertRequest) => auth.api.upsertManufacturerProfile(input),
    onSuccess: async () => {
      setNotice('Profile saved as draft')
      await queryClient.invalidateQueries({ queryKey: profileQueryKey })
    },
  })

  const submitProfile = useMutation({
    mutationFn: () => auth.api.submitManufacturerProfile(),
    onSuccess: async () => {
      setNotice('Profile submitted for moderation')
      await queryClient.invalidateQueries({ queryKey: profileQueryKey })
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
    profileQuery.isLoading ||
    saveProfile.isPending ||
    submitProfile.isPending ||
    profile?.status === 'blocked'
  const canSubmitProfile = profile?.status === 'draft' || profile?.status === 'rejected'

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
              <ManufacturerStatusBadge status={profile.status} />
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
              <AlertDescription>{formatRequestError(profileQuery.error)}</AlertDescription>
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
              <AlertDescription>{formatRequestError(mutationError)}</AlertDescription>
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
            key={profile?.updatedAt ?? 'empty'}
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
                !canSubmitProfile ||
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
  const mutationError = updateStatus.error ? formatRequestError(updateStatus.error) : null

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
              <AlertDescription>{formatRequestError(manufacturersQuery.error)}</AlertDescription>
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
            <div className="overflow-x-auto rounded-lg border">
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
