import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  TableFilterCheckboxGroup,
  TableFilterInput,
  TableFilters,
  TableFilterSelect,
} from '@/components/table-filters'
import { NativeSelectOption } from '@/components/ui/native-select'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
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
  bicycleStatusLabel,
  bicycleSizes,
  bicycleStatuses,
  bicycleToForm,
  canManufacturerEditBicycle,
  canManufacturerSubmitBicycle,
  emptyBicycleForm,
  formatMoney,
  manufacturerBicyclesQueryKey,
  manufacturerBicyclesRootQueryKey,
  parseAdminBicycleStatusFilter,
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
  const hasCompleteRentalPeriod = startsOn !== '' && endsOn !== ''

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
        ...(hasCompleteRentalPeriod ? { startsOn, endsOn } : {}),
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
              Каталог
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Велосипеды</h1>
            <CardDescription>Доступные промодерированные велосипеды для заявок на аренду.</CardDescription>
          </div>
          {data && (
            <CardAction>
              <Badge variant="secondary">
                Всего: {data.total}, страница {data.page} из {totalPages}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          <TableFilters className="sm:items-end">
            <TableFilterInput
              id="catalog-city"
              label="Город"
              value={city}
              onChange={(event) => {
                setPage(1)
                setCity(event.target.value)
              }}
            />
            <TableFilterInput
              id="catalog-min-price"
              label="Мин. цена, копейки"
              min={0}
              type="number"
              value={minPriceKopecks}
              onChange={(event) => {
                setPage(1)
                setMinPriceKopecks(event.target.value)
              }}
            />
            <TableFilterInput
              id="catalog-max-price"
              label="Макс. цена, копейки"
              min={0}
              type="number"
              value={maxPriceKopecks}
              onChange={(event) => {
                setPage(1)
                setMaxPriceKopecks(event.target.value)
              }}
            />
            <TableFilterInput
              id="catalog-starts-on"
              label="Дата начала"
              type="date"
              value={startsOn}
              onChange={(event) => {
                setPage(1)
                setStartsOn(event.target.value)
              }}
            />
            <TableFilterInput
              id="catalog-ends-on"
              label="Дата окончания"
              type="date"
              value={endsOn}
              onChange={(event) => {
                setPage(1)
                setEndsOn(event.target.value)
              }}
            />
            <TableFilterCheckboxGroup
              legend="Размеры"
              options={bicycleSizes.map((size) => ({ label: size, value: size }))}
              values={sizes}
              onValuesChange={(nextSizes) => {
                setPage(1)
                setSizes(nextSizes)
              }}
            />
          </TableFilters>

          {catalogQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Загружаем велосипеды...
            </div>
          )}

          {catalogQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить каталог</AlertTitle>
              <AlertDescription>{formatRequestError(catalogQuery.error)}</AlertDescription>
            </Alert>
          )}

          {selectedIds.length > 0 && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Выбрано велосипедов: {selectedIds.length}</AlertTitle>
              <AlertDescription className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link to="/orders/new" search={selectedSearch}>
                    Создать заявку на аренду
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIds([])}
                >
                  Очистить выбор
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
                <EmptyTitle>Велосипеды не найдены.</EmptyTitle>
                <EmptyDescription>Текущие фильтры не вернули доступные велосипеды.</EmptyDescription>
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
              Назад
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
              Далее
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
    return <LoadingState message="Загружаем велосипед..." />
  }

  if (bicycleQuery.isError) {
    return (
      <GateCard
        eyebrow="Велосипед"
        title="Велосипед недоступен"
        description={formatRequestError(bicycleQuery.error)}
        action={
          <Button asChild>
            <Link to="/bicycles">Назад в каталог</Link>
          </Button>
        }
      />
    )
  }

  const bicycle = bicycleQuery.data?.bicycle

  if (!bicycle) {
    return <LoadingState message="Загружаем велосипед..." />
  }

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <BicycleSizeBadge size={bicycle.size} />
              <Badge variant="secondary">{formatMoney(bicycle.pricePerDayKopecks)} / день</Badge>
              <Badge variant="outline">Залог {formatMoney(bicycle.depositKopecks)}</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{bicycle.title}</h1>
            <CardDescription>{bicycle.manufacturer.publicName}</CardDescription>
          </div>
          <CardAction>
            <Button asChild>
              <Link to="/orders/new" search={{ bicycleIds: bicycle.id }}>
                Запросить аренду
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
            <Fact label="Город" value={bicycle.city} />
            <Fact label="Макс. нагрузка" value={`${bicycle.maxLoadKg} кг`} />
            <Fact label="Высота сиденья" value={`${bicycle.seatHeightCm} см`} />
            <Fact label="Длина рамы" value={`${bicycle.frameLengthCm} см`} />
            <Fact label="Диаметр колеса" value={`${bicycle.wheelDiameterCm} см`} />
            <Fact label="Доставка" value={bicycle.deliveryAvailable ? 'Доступна' : 'Только самовывоз'} />
          </div>
          <Alert>
            <MapPinIcon />
            <AlertTitle>Самовывоз</AlertTitle>
            <AlertDescription>{bicycle.pickupAddress}</AlertDescription>
          </Alert>
          {bicycle.deliveryAvailable && (
            <Alert>
              <TruckIcon />
              <AlertTitle>Доставка</AlertTitle>
              <AlertDescription>Доставку можно запросить при создании заказа.</AlertDescription>
            </Alert>
          )}
          <Alert>
            <CircleAlertIcon />
            <AlertTitle>Примечания по безопасности</AlertTitle>
            <AlertDescription>{bicycle.safetyNotes}</AlertDescription>
          </Alert>
          <Alert>
            <CircleCheckIcon />
            <AlertTitle>Рекомендуемые габариты</AlertTitle>
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
      setNotice(`${response.bicycle.title}: черновик сохранен`)
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
      setNotice(`${response.bicycle.title}: отправлен на модерацию`)
      await queryClient.invalidateQueries({ queryKey: rootQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (auth.user.role !== 'manufacturer') {
    return (
      <GateCard
        eyebrow="Велосипеды производителя"
        title="Доступ запрещен"
        description="Ваш аккаунт не зарегистрирован как производитель."
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
              Велосипеды производителя
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Велосипеды</h1>
            <CardDescription>Создавайте черновики и отправляйте велосипеды на модерацию.</CardDescription>
          </div>
          <CardAction>
            <Button type="button" variant="outline" onClick={() => setEditingBicycle(null)}>
              Новый велосипед
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {!canManageBicycles && (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>Нужен одобренный профиль производителя</AlertTitle>
              <AlertDescription>Пройдите модерацию производителя перед созданием велосипедов.</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Велосипед обновлен</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось обновить велосипед</AlertTitle>
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
          <h2 className="text-xl font-semibold">Ваши велосипеды</h2>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {bicyclesQuery.isLoading && (
            <TableSkeleton
              columnClassNames={['', '', '', '', 'w-[220px]']}
              columns={5}
              label="Загружаем ваши велосипеды..."
              tableClassName="min-w-[860px]"
            />
          )}

          {bicyclesQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить велосипеды</AlertTitle>
              <AlertDescription>{formatRequestError(bicyclesQuery.error)}</AlertDescription>
            </Alert>
          )}

          {bicyclesData && bicyclesData.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BikeIcon />
                </EmptyMedia>
                <EmptyTitle>Велосипедов пока нет.</EmptyTitle>
                <EmptyDescription>Создайте первый черновик, чтобы начать модерацию каталога.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {bicyclesData && bicyclesData.items.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Велосипед</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Цена</TableHead>
                      <TableHead>Город</TableHead>
                      <TableHead className="w-[220px]">Действия</TableHead>
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
                              Редактировать
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
                              Отправить
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
                      Назад
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
                      Далее
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
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { page?: number; status?: string }
  const page = search.page ?? 1
  const status = parseAdminBicycleStatusFilter(search.status)
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
      setNotice(`${response.bicycle.title}: велосипед обновлен`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof auth.api.updateAdminBicycleStatus>[1] }) =>
      auth.api.updateAdminBicycleStatus(id, input),
    onSuccess: async (response) => {
      setNotice(`${response.bicycle.title}: велосипед обновлен`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Велосипеды"
        title="Доступ запрещен"
        description="У аккаунта нет прав на модерацию велосипедов."
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
              Велосипеды администратора
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Велосипеды</h1>
            <CardDescription>Проверяйте отправленные карточки и управляйте доступностью каталога.</CardDescription>
          </div>
          {data && (
            <CardAction>
              <Badge variant="secondary">
                Всего: {data.total}, страница {data.page} из {totalPages}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          <TableFilters>
            <TableFilterSelect
              aria-label="Фильтр статуса велосипеда"
              value={status}
              onChange={(event) => {
                void navigate({
                  to: '/admin/bicycles',
                  search: adminBicyclesSearch(event.target.value as BicycleStatus | 'all'),
                })
              }}
            >
              <NativeSelectOption value="all">Все статусы</NativeSelectOption>
              {bicycleStatuses.map((nextStatus) => (
                <NativeSelectOption key={nextStatus} value={nextStatus}>
                  {bicycleStatusLabel(nextStatus)}
                </NativeSelectOption>
              ))}
            </TableFilterSelect>
          </TableFilters>

          {bicyclesQuery.isLoading && (
            <TableSkeleton
              columnClassNames={['w-[28%]', '', '', '', 'w-[32%]']}
              columns={5}
              label="Загружаем велосипеды..."
              tableClassName="min-w-[980px]"
            />
          )}

          {bicyclesQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить велосипеды</AlertTitle>
              <AlertDescription>{formatRequestError(bicyclesQuery.error)}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Велосипед обновлен</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось обновить велосипед</AlertTitle>
              <AlertDescription>{formatRequestError(mutationError)}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BikeIcon />
                </EmptyMedia>
                <EmptyTitle>Велосипеды не найдены.</EmptyTitle>
                <EmptyDescription>Текущий фильтр статуса не вернул велосипеды.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Велосипед</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Город</TableHead>
                    <TableHead>Отправлен</TableHead>
                    <TableHead className="w-[32%]">Решение</TableHead>
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
              onClick={() => {
                void navigate({
                  to: '/admin/bicycles',
                  search: adminBicyclesSearch(status, Math.max(1, page - 1)),
                })
              }}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Назад
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || bicyclesQuery.isFetching}
              onClick={() => {
                void navigate({
                  to: '/admin/bicycles',
                  search: adminBicyclesSearch(status, page + 1),
                })
              }}
            >
              Далее
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </section>
  )
}

function adminBicyclesSearch(status: BicycleStatus | 'all', page?: number) {
  return {
    ...(page && page > 1 ? { page } : {}),
    status,
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
