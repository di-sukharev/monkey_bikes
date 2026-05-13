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
  manufacturerStatusLabel,
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
      setNotice('Профиль сохранен как черновик')
      await queryClient.invalidateQueries({ queryKey: profileQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bicycles'] })
    },
  })

  const submitProfile = useMutation({
    mutationFn: () => auth.api.submitManufacturerProfile(),
    onSuccess: async () => {
      setNotice('Профиль отправлен на модерацию')
      await queryClient.invalidateQueries({ queryKey: profileQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bicycles'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Профиль производителя"
        title="Нужен вход"
        description="Войдите под производителем, чтобы редактировать публичный профиль."
        action={
          <Button asChild>
            <Link to="/">К авторизации</Link>
          </Button>
        }
      />
    )
  }

  if (auth.user.role !== 'manufacturer') {
    return (
      <GateCard
        eyebrow="Профиль производителя"
        title="Доступ запрещен"
        description="Ваш аккаунт не зарегистрирован как производитель."
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
              Профиль производителя
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Профиль</h1>
            <CardDescription>
              Поддерживайте публичные данные производителя готовыми к модерации администратором.
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
              Загружаем профиль...
            </div>
          )}

          {profileQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить профиль</AlertTitle>
              <AlertDescription>{formatRequestError(profileQuery.error)}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Профиль производителя</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось обновить профиль</AlertTitle>
              <AlertDescription>{formatRequestError(mutationError)}</AlertDescription>
            </Alert>
          )}

          {profile?.moderationComment && (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>Комментарий модерации</AlertTitle>
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
              Отправить на модерацию
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
      setNotice(`${response.profile.publicName}: профиль обновлен`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'manufacturers'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bicycles'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'bicycles'] })
    },
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Производители"
        title="Нужен вход"
        description="Войдите под администратором, чтобы модерировать профили производителей."
        action={
          <Button asChild>
            <Link to="/">К авторизации</Link>
          </Button>
        }
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Производители"
        title="Доступ запрещен"
        description="У аккаунта нет прав на модерацию профилей производителей."
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
              Производители администратора
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Производители</h1>
            <CardDescription>Проверяйте отправленные профили производителей перед работой с каталогом.</CardDescription>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <NativeSelect
              aria-label="Фильтр статуса производителя"
              className="w-full max-w-56"
              value={status}
              onChange={(event) => {
                setPage(1)
                setStatus(event.target.value as AdminManufacturerStatusFilter)
              }}
            >
              <NativeSelectOption value="all">Все статусы</NativeSelectOption>
              {manufacturerStatuses.map((nextStatus) => (
                <NativeSelectOption key={nextStatus} value={nextStatus}>
                  {manufacturerStatusLabel(nextStatus)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {manufacturersQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Загружаем производителей...
            </div>
          )}

          {manufacturersQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить производителей</AlertTitle>
              <AlertDescription>{formatRequestError(manufacturersQuery.error)}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert>
              <CircleCheckIcon />
              <AlertTitle>Производитель обновлен</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {mutationError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось обновить производителя</AlertTitle>
              <AlertDescription>{mutationError}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <StoreIcon />
                </EmptyMedia>
                <EmptyTitle>Профили производителей не найдены.</EmptyTitle>
                <EmptyDescription>Текущий фильтр статуса не вернул профили.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Производитель</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Город</TableHead>
                    <TableHead>Отправлен</TableHead>
                    <TableHead className="w-[32%]">Решение</TableHead>
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
              Назад
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
              Далее
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </section>
  )
}
