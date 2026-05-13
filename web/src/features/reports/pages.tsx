import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BikeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  StoreIcon,
} from 'lucide-react'

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
  CardTitle,
} from '@/components/ui/card'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import { TableSkeleton } from '@/components/ui/table'
import { pageShellClass } from '@/lib/page-layout'
import { formatRequestError } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'
import {
  AdminReportsPeriodControls,
  BicycleUtilizationTable,
  ManufacturerReportTable,
  MostRentedSizesPanel,
  ReportsSummaryCards,
} from './reports-panels'
import {
  adminBicycleUtilizationReportQueryKey,
  adminManufacturerReportQueryKey,
  adminReportSummaryQueryKey,
  adminReportsSearch,
  defaultReportsPeriod,
  normalizeAdminReportsSearch,
} from './model'

const reportListPageSize = 10

export function AdminReportsPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>
  const search = normalizeAdminReportsSearch(rawSearch)

  const summaryQuery = useQuery({
    queryKey: adminReportSummaryQueryKey(search.startsOn, search.endsOn),
    enabled: auth.user?.role === 'admin',
    queryFn: () =>
      auth.api.adminReportSummary({
        startsOn: search.startsOn,
        endsOn: search.endsOn,
      }),
  })
  const utilizationQuery = useQuery({
    queryKey: adminBicycleUtilizationReportQueryKey(
      search.startsOn,
      search.endsOn,
      search.bicyclePage,
    ),
    enabled: auth.user?.role === 'admin',
    queryFn: () =>
      auth.api.adminBicycleUtilizationReport({
        startsOn: search.startsOn,
        endsOn: search.endsOn,
        page: search.bicyclePage,
        pageSize: reportListPageSize,
      }),
  })
  const manufacturerQuery = useQuery({
    queryKey: adminManufacturerReportQueryKey(
      search.startsOn,
      search.endsOn,
      search.manufacturerPage,
    ),
    enabled: auth.user?.role === 'admin',
    queryFn: () =>
      auth.api.adminManufacturerReport({
        startsOn: search.startsOn,
        endsOn: search.endsOn,
        page: search.manufacturerPage,
        pageSize: reportListPageSize,
      }),
  })

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />
  }

  if (!auth.user) {
    return (
      <GateCard
        eyebrow="Отчеты"
        title="Нужен вход"
        description="Войдите под администратором, чтобы открыть отчеты."
        action={<Button asChild><Link to="/">К авторизации</Link></Button>}
      />
    )
  }

  if (auth.user.role !== 'admin') {
    return (
      <GateCard
        eyebrow="Отчеты"
        title="Доступ запрещен"
        description="У аккаунта нет прав на просмотр отчетов."
      />
    )
  }

  const utilization = utilizationQuery.data
  const manufacturers = manufacturerQuery.data
  const utilizationTotalPages = Math.max(1, Math.ceil((utilization?.total ?? 0) / reportListPageSize))
  const manufacturerTotalPages = Math.max(1, Math.ceil((manufacturers?.total ?? 0) / reportListPageSize))
  const isFetching = summaryQuery.isFetching || utilizationQuery.isFetching || manufacturerQuery.isFetching

  const navigateToReports = (
    startsOn: string,
    endsOn: string,
    bicyclePage = 1,
    manufacturerPage = 1,
  ) => {
    void navigate({
      to: '/admin/reports',
      search: adminReportsSearch(startsOn, endsOn, bicyclePage, manufacturerPage),
    })
  }

  return (
    <section className={cn(pageShellClass, 'grid gap-4')}>
      <div className="grid gap-2">
        <Badge variant="outline" className="w-fit">
          Отчеты администратора
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Отчеты</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Начальная статистика по платежам, арендной активности, загрузке велосипедов и производителям.
        </p>
      </div>

      <AdminReportsPeriodControls
        disabled={isFetching}
        startsOn={search.startsOn}
        endsOn={search.endsOn}
        onPeriodChange={(startsOn, endsOn) => navigateToReports(startsOn, endsOn)}
        onReset={() => {
          const period = defaultReportsPeriod()
          navigateToReports(period.startsOn, period.endsOn)
        }}
      />

      {summaryQuery.isLoading && <ReportLoading message="Загружаем сводку..." />}
      {summaryQuery.isError && (
        <ReportError title="Не удалось загрузить сводку отчета" error={summaryQuery.error} />
      )}
      {summaryQuery.data && (
        <>
          <ReportsSummaryCards summary={summaryQuery.data} />
          <MostRentedSizesPanel summary={summaryQuery.data} />
        </>
      )}

      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              <BikeIcon data-icon="inline-start" />
              Велосипеды
            </Badge>
            <CardTitle>Загрузка велосипедов</CardTitle>
            <CardDescription>Дни аренды и учтенная сумма аренды по велосипедам.</CardDescription>
          </div>
          {utilization && (
            <CardAction>
              <Badge variant="secondary">
                Всего: {utilization.total}, страница {utilization.page} из {utilizationTotalPages}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {utilizationQuery.isLoading && (
            <TableSkeleton
              actionColumn={false}
              columns={5}
              label="Загружаем загрузку велосипедов..."
              tableClassName="min-w-[980px]"
            />
          )}
          {utilizationQuery.isError && (
            <ReportError title="Не удалось загрузить загрузку велосипедов" error={utilizationQuery.error} />
          )}
          {utilization && (
            <BicycleUtilizationTable
              items={utilization.items}
              periodDays={utilization.period.days}
            />
          )}
        </CardContent>
      </Card>
      <ReportPagination
        disabled={utilizationQuery.isFetching}
        page={search.bicyclePage}
        totalPages={utilizationTotalPages}
        onPageChange={(page) =>
          navigateToReports(search.startsOn, search.endsOn, page, search.manufacturerPage)}
      />

      <Card>
        <CardHeader className="border-b">
          <div className="grid gap-2">
            <Badge variant="outline" className="w-fit">
              <StoreIcon data-icon="inline-start" />
              Производители
            </Badge>
            <CardTitle>Статистика производителей</CardTitle>
            <CardDescription>Активность, сумма залогов и количество отмен по производителям.</CardDescription>
          </div>
          {manufacturers && (
            <CardAction>
              <Badge variant="secondary">
                Всего: {manufacturers.total}, страница {manufacturers.page} из {manufacturerTotalPages}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
          {manufacturerQuery.isLoading && (
            <TableSkeleton
              actionColumn={false}
              columns={7}
              label="Загружаем статистику производителей..."
              tableClassName="min-w-[1040px]"
            />
          )}
          {manufacturerQuery.isError && (
            <ReportError title="Не удалось загрузить статистику производителей" error={manufacturerQuery.error} />
          )}
          {manufacturers && <ManufacturerReportTable items={manufacturers.items} />}
        </CardContent>
      </Card>
      <ReportPagination
        disabled={manufacturerQuery.isFetching}
        page={search.manufacturerPage}
        totalPages={manufacturerTotalPages}
        onPageChange={(page) =>
          navigateToReports(search.startsOn, search.endsOn, search.bicyclePage, page)}
      />
    </section>
  )
}

function ReportLoading({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      <Spinner />
      {message}
    </div>
  )
}

function ReportError({ error, title }: { error: unknown; title: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{formatRequestError(error)}</AlertDescription>
    </Alert>
  )
}

function ReportPagination({
  disabled,
  page,
  totalPages,
  onPageChange,
}: {
  disabled: boolean
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  return (
    <Pagination className="justify-end">
      <PaginationContent>
        <PaginationItem>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || disabled}
            onClick={() => onPageChange(Math.max(1, page - 1))}
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
            disabled={page >= totalPages || disabled}
            onClick={() => onPageChange(page + 1)}
          >
            Далее
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
