import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, ClipboardCheckIcon } from 'lucide-react'

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
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import { pageShellClass } from '@/lib/page-layout'
import { formatRequestError } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'
import {
  AdminChecklistsFilters,
  AdminChecklistsTable,
  AdminQuickFilters,
  AdminSectionLinks,
} from './admin-panels'
import {
  adminChecklistsQueryKey,
  parseAdminChecklistTypeFilter,
  type AdminChecklistTypeFilter,
} from './model'
import { todayDateOnly } from '../orders/model'

const adminChecklistsPageSize = 20

export function AdminDashboardPage() {
  const auth = useAuth()
  const today = todayDateOnly()

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Админка"
        title="Нужен вход"
        description="Войдите под администратором, чтобы открыть рабочую область."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Админка"
        title="Доступ запрещен"
        description="У аккаунта нет прав на рабочую область администратора."
      />
    )
  }

  return (
    <section className={cn(pageShellClass, 'grid gap-6')}>
      <div className="grid gap-2">
        <Badge variant="outline" className="w-fit">
          Рабочая область администратора
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Операции</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Пользователи, очереди модерации, заказы аренды, платежи и история чеклистов.
        </p>
      </div>
      <AdminQuickFilters today={today} />
      <AdminSectionLinks />
    </section>
  )
}

export function AdminChecklistsPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    bicycleId?: string
    orderId?: string
    page?: number
    type?: string
  }
  const page = search.page ?? 1
  const type = parseAdminChecklistTypeFilter(search.type)
  const orderId = search.orderId ?? ''
  const bicycleId = search.bicycleId ?? ''

  const checklistsQuery = useQuery({
    queryKey: adminChecklistsQueryKey(page, type, orderId.trim(), bicycleId.trim()),
    enabled: auth.user?.role === 'admin',
    queryFn: () =>
      auth.api.adminChecklists({
        page,
        pageSize: adminChecklistsPageSize,
        ...(type === 'all' ? {} : { type }),
        ...(orderId.trim() ? { orderId: orderId.trim() } : {}),
        ...(bicycleId.trim() ? { bicycleId: bicycleId.trim() } : {}),
      }),
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Чеклисты"
        title="Нужен вход"
        description="Войдите под администратором, чтобы смотреть историю чеклистов."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Чеклисты"
        title="Доступ запрещен"
        description="У аккаунта нет прав на просмотр истории чеклистов."
      />
    )
  }

  const data = checklistsQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / adminChecklistsPageSize))

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              Чеклисты администратора
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Чеклисты</h1>
            <CardDescription>История проверок при выдаче и возврате по заказам аренды.</CardDescription>
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
          <AdminChecklistsFilters
            bicycleId={bicycleId}
            disabled={checklistsQuery.isFetching}
            orderId={orderId}
            type={type}
            onBicycleIdChange={(value) => {
              void navigate({
                to: '/admin/checklists',
                search: adminChecklistsSearch(type, orderId, value),
              })
            }}
            onOrderIdChange={(value) => {
              void navigate({
                to: '/admin/checklists',
                search: adminChecklistsSearch(type, value, bicycleId),
              })
            }}
            onTypeChange={(value) => {
              void navigate({
                to: '/admin/checklists',
                search: adminChecklistsSearch(value, orderId, bicycleId),
              })
            }}
          />

          {checklistsQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Spinner />
              Загружаем чеклисты...
            </div>
          )}

          {checklistsQuery.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Не удалось загрузить чеклисты</AlertTitle>
              <AlertDescription>{formatRequestError(checklistsQuery.error)}</AlertDescription>
            </Alert>
          )}

          {data && data.items.length === 0 && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardCheckIcon />
                </EmptyMedia>
                <EmptyTitle>Чеклисты не найдены.</EmptyTitle>
                <EmptyDescription>Текущие фильтры не вернули записи выдачи или возврата.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {data && data.items.length > 0 && <AdminChecklistsTable checklists={data.items} />}
        </CardContent>
      </Card>

      <Pagination className="justify-end">
        <PaginationContent>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || checklistsQuery.isFetching}
              onClick={() => {
                void navigate({
                  to: '/admin/checklists',
                  search: adminChecklistsSearch(type, orderId, bicycleId, Math.max(1, page - 1)),
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
              disabled={page >= totalPages || checklistsQuery.isFetching}
              onClick={() => {
                void navigate({
                  to: '/admin/checklists',
                  search: adminChecklistsSearch(type, orderId, bicycleId, page + 1),
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

function adminChecklistsSearch(
  type: AdminChecklistTypeFilter,
  orderId: string,
  bicycleId: string,
  page?: number,
) {
  return {
    ...(page && page > 1 ? { page } : {}),
    ...(type === 'all' ? {} : { type }),
    ...(orderId.trim() ? { orderId: orderId.trim() } : {}),
    ...(bicycleId.trim() ? { bicycleId: bicycleId.trim() } : {}),
  }
}
