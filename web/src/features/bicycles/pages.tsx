import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BicycleDto, BicycleSize, BicycleStatus } from '@web-app-demo/contracts'
import {
  BikeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  MapPinIcon,
  TruckIcon,
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
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
import { AdminBicycleRow } from './admin-bicycle-row'
import { BicycleForm } from './bicycle-form'
import { PublicBicycleCard } from './bicycle-card'
import {
  adminBicyclesQueryKey,
  bicycleSizes,
  bicycleStatuses,
  bicycleToForm,
  canManufacturerEditBicycle,
  canManufacturerSubmitBicycle,
  emptyBicycleForm,
  formatMoney,
  manufacturerBicyclesQueryKey,
  manufacturerBicyclesRootQueryKey,
} from './model'
import { BicycleSizeBadge, BicycleStatusBadge } from './status-badge'

const bicyclesPageSize = 20

export function CatalogPage() {
  const auth = useAuth()
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sizes, setSizes] = useState<BicycleSize[]>([])
  const [city, setCity] = useState('')
  const [minPriceKopecks, setMinPriceKopecks] = useState('')
  const [maxPriceKopecks, setMaxPriceKopecks] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')

  const catalogQuery = useQuery({
    queryKey: ['catalog', 'bicycles', page, sizes, city, minPriceKopecks, maxPriceKopecks, startsOn, endsOn],
    queryFn: () =>
      auth.api.publicBicycles({
        page,
        pageSize: bicyclesPageSize,
        ...(sizes.length === 0 ? {} : { sizes }),
        ...(city.trim() ? { city } : {}),
        ...(minPriceKopecks ? { minPriceKopecks: Number(minPriceKopecks) } : {}),
        ...(maxPriceKopecks ? { maxPriceKopecks: Number(maxPriceKopecks) } : {}),
        ...(startsOn ? { startsOn } : {}),
        ...(endsOn ? { endsOn } : {}),
      }),
  })

  const data = catalogQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / bicyclesPageSize))
  const selectedSearch = { bicycleIds: selectedIds.join(',') }

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Catalog
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Bicycles</h1>
            <CardDescription>Available moderated bicycles ready for rental requests.</CardDescription>
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
          <div className="grid gap-3 md:grid-cols-4">
            <Field>
              <FieldLabel>Sizes</FieldLabel>
              <div className="flex flex-wrap gap-3">
                {bicycleSizes.map((size) => (
                  <label key={size} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={sizes.includes(size)}
                      onCheckedChange={(checked) => {
                        setPage(1)
                        setSizes((current) =>
                          checked === true
                            ? [...current, size]
                            : current.filter((nextSize) => nextSize !== size),
                        )
                      }}
                    />
                    {size}
                  </label>
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="catalog-city">City</FieldLabel>
              <Input
                id="catalog-city"
                value={city}
                onChange={(event) => {
                  setPage(1)
                  setCity(event.target.value)
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="catalog-min-price">Min price, kopecks</FieldLabel>
              <Input
                id="catalog-min-price"
                min={0}
                type="number"
                value={minPriceKopecks}
                onChange={(event) => {
                  setPage(1)
                  setMinPriceKopecks(event.target.value)
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="catalog-max-price">Max price, kopecks</FieldLabel>
              <Input
                id="catalog-max-price"
                min={0}
                type="number"
                value={maxPriceKopecks}
                onChange={(event) => {
                  setPage(1)
                  setMaxPriceKopecks(event.target.value)
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="catalog-starts-on">Starts on</FieldLabel>
              <Input
                id="catalog-starts-on"
                type="date"
                value={startsOn}
                onChange={(event) => {
                  setPage(1)
                  setStartsOn(event.target.value)
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="catalog-ends-on">Ends on</FieldLabel>
              <Input
                id="catalog-ends-on"
                type="date"
                value={endsOn}
                onChange={(event) => {
                  setPage(1)
                  setEndsOn(event.target.value)
                }}
              />
            </Field>
          </div>

          {catalogQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading bicycles...
            </div>
          )}

          {catalogQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load catalog</AlertTitle>
              <AlertDescription>{formatRequestError(catalogQuery.error)}</AlertDescription>
            </Alert>
          )}

          {selectedIds.length > 0 && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>{selectedIds.length} bicycle(s) selected</AlertTitle>
              <AlertDescription className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link to="/orders/new" search={selectedSearch}>
                    Create rental request
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIds([])}
                >
                  Clear selection
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BikeIcon />
                </EmptyMedia>
                <EmptyTitle>No bicycles found.</EmptyTitle>
                <EmptyDescription>The current filters did not return available bicycles.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {data.items.map((bicycle) => (
                <PublicBicycleCard
                  key={bicycle.id}
                  bicycle={bicycle}
                  selected={selectedIds.includes(bicycle.id)}
                  onSelectedChange={(selected) => {
                    setSelectedIds((current) =>
                      selected
                        ? [...current, bicycle.id]
                        : current.filter((id) => id !== bicycle.id),
                    )
                  }}
                />
              ))}
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
              disabled={page <= 1 || catalogQuery.isFetching}
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
              disabled={page >= totalPages || catalogQuery.isFetching}
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

export function BicycleDetailPage() {
  const auth = useAuth()
  const { id } = useParams({ strict: false }) as { id: string }
  const bicycleQuery = useQuery({
    queryKey: ['catalog', 'bicycles', id],
    queryFn: () => auth.api.publicBicycle(id),
  })

  if (bicycleQuery.isLoading) {
    return <LoadingState message="Loading bicycle..." />
  }

  if (bicycleQuery.isError) {
    return (
      <GateCard
        eyebrow="Bicycle"
        title="Bicycle unavailable"
        description={formatRequestError(bicycleQuery.error)}
        action={
          <Button asChild>
            <Link to="/bicycles">Back to catalog</Link>
          </Button>
        }
      />
    )
  }

  const bicycle = bicycleQuery.data?.bicycle

  if (!bicycle) {
    return <LoadingState message="Loading bicycle..." />
  }

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <BicycleSizeBadge size={bicycle.size} />
              <Badge variant="secondary">{formatMoney(bicycle.pricePerDayKopecks)} / day</Badge>
              <Badge variant="outline">Deposit {formatMoney(bicycle.depositKopecks)}</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{bicycle.title}</h1>
            <CardDescription>{bicycle.manufacturer.publicName}</CardDescription>
          </div>
          <CardAction>
            <Button asChild>
              <Link to="/orders/new" search={{ bicycleIds: bicycle.id }}>
                Request rental
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-5 py-4">
          {bicycle.photoUrls.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {bicycle.photoUrls.map((url) => (
                <div key={url} className="aspect-video overflow-hidden rounded-md border bg-muted">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
          <p className="text-sm leading-6 text-muted-foreground">{bicycle.description}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Fact label="City" value={bicycle.city} />
            <Fact label="Max load" value={`${bicycle.maxLoadKg} kg`} />
            <Fact label="Seat height" value={`${bicycle.seatHeightCm} cm`} />
            <Fact label="Frame length" value={`${bicycle.frameLengthCm} cm`} />
            <Fact label="Wheel diameter" value={`${bicycle.wheelDiameterCm} cm`} />
            <Fact label="Delivery" value={bicycle.deliveryAvailable ? 'Available' : 'Pickup only'} />
          </div>
          <Alert>
            <MapPinIcon />
            <AlertTitle>Pickup</AlertTitle>
            <AlertDescription>{bicycle.pickupAddress}</AlertDescription>
          </Alert>
          {bicycle.deliveryAvailable && (
            <Alert>
              <TruckIcon />
              <AlertTitle>Delivery</AlertTitle>
              <AlertDescription>Delivery can be requested during order creation.</AlertDescription>
            </Alert>
          )}
          <Alert>
            <CircleAlertIcon />
            <AlertTitle>Safety notes</AlertTitle>
            <AlertDescription>{bicycle.safetyNotes}</AlertDescription>
          </Alert>
          <Alert>
            <CircleCheckIcon />
            <AlertTitle>Recommended dimensions</AlertTitle>
            <AlertDescription>{bicycle.recommendedAnimalDimensions}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </section>
  )
}

export function ManufacturerBicyclesPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [editingBicycle, setEditingBicycle] = useState<BicycleDto | null>(null)
  const [page, setPage] = useState(1)
  const rootQueryKey = manufacturerBicyclesRootQueryKey(auth.user?.id)
  const queryKey = manufacturerBicyclesQueryKey(auth.user?.id, page)

  const profileQuery = useQuery({
    queryKey: ['manufacturer', 'profile', auth.user?.id ?? null],
    enabled: auth.user?.role === 'manufacturer',
    queryFn: () => auth.api.manufacturerProfile(),
  })

  const bicyclesQuery = useQuery({
    queryKey,
    enabled: auth.user?.role === 'manufacturer',
    queryFn: () => auth.api.manufacturerBicycles({ page, pageSize: bicyclesPageSize }),
  })

  const saveBicycle = useMutation({
    mutationFn: (input: { bicycle: BicycleDto | null; values: Parameters<typeof auth.api.createManufacturerBicycle>[0] }) =>
      input.bicycle
        ? auth.api.updateManufacturerBicycle(input.bicycle.id, input.values)
        : auth.api.createManufacturerBicycle(input.values),
    onSuccess: async (response, variables) => {
      setNotice(`${response.bicycle.title} saved as draft`)
      setEditingBicycle(null)
      if (!variables.bicycle) {
        setPage(1)
      }
      await queryClient.invalidateQueries({ queryKey: rootQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
    },
  })

  const submitBicycle = useMutation({
    mutationFn: (id: string) => auth.api.submitManufacturerBicycle(id),
    onSuccess: async (response) => {
      setNotice(`${response.bicycle.title} submitted for moderation`)
      await queryClient.invalidateQueries({ queryKey: rootQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Manufacturer bicycles"
        title="Login required"
        description="Sign in with a manufacturer account to manage bicycles."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'manufacturer') {
    return (
      <GateCard
        eyebrow="Manufacturer bicycles"
        title="Access denied"
        description="Your account is not registered as a manufacturer."
      />
    )
  }

  const profile = profileQuery.data?.profile ?? null
  const canManageBicycles = profile?.status === 'approved'
  const mutationError = saveBicycle.error ?? submitBicycle.error
  const bicyclesData = bicyclesQuery.data
  const totalPages = Math.max(1, Math.ceil((bicyclesData?.total ?? 0) / bicyclesPageSize))

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Manufacturer bicycles
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Bicycles</h1>
            <CardDescription>Create drafts and submit approved-profile bicycles for moderation.</CardDescription>
          </div>
          <CardAction>
            <Button type="button" variant="outline" onClick={() => setEditingBicycle(null)}>
              New bicycle
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {!canManageBicycles && (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>Approved manufacturer profile required</AlertTitle>
              <AlertDescription>Complete manufacturer moderation before creating bicycles.</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Bicycle updated</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not update bicycle</AlertTitle>
              <AlertDescription>{formatRequestError(mutationError)}</AlertDescription>
            </Alert>
          )}

          <BicycleForm
            key={editingBicycle?.id ?? 'new-bike'}
            disabled={!canManageBicycles || saveBicycle.isPending}
            mode={editingBicycle ? 'edit' : 'create'}
            initialValues={editingBicycle ? bicycleToForm(editingBicycle) : emptyBicycleForm}
            onSubmit={(values) => {
              setNotice(null)
              saveBicycle.mutate({ bicycle: editingBicycle, values })
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <h2 className="text-xl font-semibold">Your bicycles</h2>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {bicyclesQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading bicycles...
            </div>
          )}

          {bicyclesQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load bicycles</AlertTitle>
              <AlertDescription>{formatRequestError(bicyclesQuery.error)}</AlertDescription>
            </Alert>
          )}

          {bicyclesData && bicyclesData.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BikeIcon />
                </EmptyMedia>
                <EmptyTitle>No bicycles yet.</EmptyTitle>
                <EmptyDescription>Create the first draft to start catalog moderation.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {bicyclesData && bicyclesData.items.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bicycle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="w-[220px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bicyclesData.items.map((bicycle) => (
                      <TableRow key={bicycle.id}>
                        <TableCell>
                          <div className="grid gap-1">
                            <span className="font-medium">{bicycle.title}</span>
                            {bicycle.moderationComment && (
                              <span className="text-sm text-muted-foreground">{bicycle.moderationComment}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <BicycleStatusBadge status={bicycle.status} />
                            <BicycleSizeBadge size={bicycle.size} />
                          </div>
                        </TableCell>
                        <TableCell>{formatMoney(bicycle.pricePerDayKopecks)}</TableCell>
                        <TableCell>{bicycle.city}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                !canManageBicycles ||
                                saveBicycle.isPending ||
                                !canManufacturerEditBicycle(bicycle.status)
                              }
                              onClick={() => setEditingBicycle(bicycle)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                !canManageBicycles ||
                                submitBicycle.isPending ||
                                !canManufacturerSubmitBicycle(bicycle.status)
                              }
                              onClick={() => {
                                setNotice(null)
                                submitBicycle.mutate(bicycle.id)
                              }}
                            >
                              Submit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || bicyclesQuery.isFetching}
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
                      disabled={page >= totalPages || bicyclesQuery.isFetching}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                      <ChevronRightIcon data-icon="inline-end" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminBicyclesPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<BicycleStatus | 'all'>('moderation')
  const [notice, setNotice] = useState<string | null>(null)
  const queryKey = adminBicyclesQueryKey(page, status)

  const bicyclesQuery = useQuery({
    queryKey,
    enabled: auth.user?.role === 'admin',
    queryFn: () =>
      auth.api.adminBicycles({
        page,
        pageSize: bicyclesPageSize,
        ...(status === 'all' ? {} : { status }),
      }),
  })

  const moderateBicycle = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof auth.api.moderateAdminBicycle>[1] }) =>
      auth.api.moderateAdminBicycle(id, input),
    onSuccess: async (response) => {
      setNotice(`${response.bicycle.title} updated`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof auth.api.updateAdminBicycleStatus>[1] }) =>
      auth.api.updateAdminBicycleStatus(id, input),
    onSuccess: async (response) => {
      setNotice(`${response.bicycle.title} updated`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Checking session..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Admin bicycles"
        title="Login required"
        description="Sign in with an administrator account to moderate bicycles."
        action={<Button asChild><Link to="/">Go to auth</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Admin bicycles"
        title="Access denied"
        description="Your account does not have permission to moderate bicycles."
      />
    )
  }

  const data = bicyclesQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / bicyclesPageSize))
  const mutationError = moderateBicycle.error ?? updateStatus.error

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Admin bicycles
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Bicycles</h1>
            <CardDescription>Review submitted bicycle cards and control catalog availability.</CardDescription>
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
          <NativeSelect
            aria-label="Bicycle status filter"
            className="w-full max-w-56"
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value as BicycleStatus | 'all')
            }}
          >
            <NativeSelectOption value="all">All statuses</NativeSelectOption>
            {bicycleStatuses.map((nextStatus) => (
              <NativeSelectOption key={nextStatus} value={nextStatus}>
                {nextStatus}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          {bicyclesQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading bicycles...
            </div>
          )}

          {bicyclesQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not load bicycles</AlertTitle>
              <AlertDescription>{formatRequestError(bicyclesQuery.error)}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Bicycle updated</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Could not update bicycle</AlertTitle>
              <AlertDescription>{formatRequestError(mutationError)}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BikeIcon />
                </EmptyMedia>
                <EmptyTitle>No bicycles found.</EmptyTitle>
                <EmptyDescription>The current status filter did not return any bicycles.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Bicycle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[32%]">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((bicycle) => (
                    <AdminBicycleRow
                      key={bicycle.id}
                      bicycle={bicycle}
                      disabled={moderateBicycle.isPending || updateStatus.isPending}
                      onModerate={(input) => {
                        setNotice(null)
                        moderateBicycle.mutate({ id: bicycle.id, input })
                      }}
                      onStatusChange={(input) => {
                        setNotice(null)
                        updateStatus.mutate({ id: bicycle.id, input })
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
              disabled={page <= 1 || bicyclesQuery.isFetching}
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
              disabled={page >= totalPages || bicyclesQuery.isFetching}
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
