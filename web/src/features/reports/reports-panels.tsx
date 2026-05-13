import type {
  AdminBicycleUtilizationReportItem,
  AdminManufacturerReportItem,
  AdminReportSummaryResponse,
} from '@web-app-demo/contracts'
import {
  BikeIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  RotateCcwIcon,
  RulerIcon,
  StoreIcon,
  XCircleIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney } from '../orders/model'
import { formatUtilizationRate } from './model'

type PeriodControlsProps = {
  disabled: boolean
  endsOn: string
  startsOn: string
  onPeriodChange: (startsOn: string, endsOn: string) => void
  onReset: () => void
}

export function AdminReportsPeriodControls({
  disabled,
  endsOn,
  startsOn,
  onPeriodChange,
  onReset,
}: PeriodControlsProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="grid gap-2">
          <Badge variant="outline" className="w-fit">
            Период
          </Badge>
          <CardTitle>Период отчета</CardTitle>
          <CardDescription>
            Даты аренды включительно для загрузки и даты завершения платежей по всемирному координированному времени.
          </CardDescription>
        </div>
        <CardAction>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onReset}>
            <RotateCcwIcon data-icon="inline-start" />
            Сбросить
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 py-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="reports-starts-on">Дата начала</label>
          <Input
            id="reports-starts-on"
            aria-label="Дата начала отчета"
            disabled={disabled}
            type="date"
            value={startsOn}
            onChange={(event) => {
              const nextStartsOn = event.target.value
              if (!nextStartsOn) return
              onPeriodChange(nextStartsOn, nextStartsOn > endsOn ? nextStartsOn : endsOn)
            }}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="reports-ends-on">Дата окончания</label>
          <Input
            id="reports-ends-on"
            aria-label="Дата окончания отчета"
            disabled={disabled}
            type="date"
            value={endsOn}
            onChange={(event) => {
              const nextEndsOn = event.target.value
              if (!nextEndsOn) return
              onPeriodChange(nextEndsOn < startsOn ? nextEndsOn : startsOn, nextEndsOn)
            }}
          />
        </div>
        <Badge variant="secondary" className="h-9 justify-center px-3">
          {startsOn} - {endsOn}
        </Badge>
      </CardContent>
    </Card>
  )
}

export function ReportsSummaryCards({ summary }: { summary: AdminReportSummaryResponse }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <ReportMetricCard
        icon={<CalendarDaysIcon />}
        title="Активные аренды"
        value={summary.orders.activeRentalOrderCount}
        description={`Позиций велосипедов: ${summary.orders.activeRentalItemCount} за ${summary.period.days} дн.`}
      />
      <ReportMetricCard
        icon={<CreditCardIcon />}
        title="Успешная аренда"
        value={formatMoney(summary.successfulPayments.rent.amountKopecks)}
        description={`Успешных платежей аренды: ${summary.successfulPayments.rent.count}`}
      />
      <ReportMetricCard
        icon={<CreditCardIcon />}
        title="Успешный залог"
        value={formatMoney(summary.successfulPayments.deposit.amountKopecks)}
        description={`Успешных платежей залога: ${summary.successfulPayments.deposit.count}`}
      />
      <ReportMetricCard
        icon={<XCircleIcon />}
        title="Отмененные заказы"
        value={summary.orders.cancelledOrderCount}
        description="Заказы, отмененные за выбранный период"
      />
    </div>
  )
}

export function MostRentedSizesPanel({ summary }: { summary: AdminReportSummaryResponse }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="grid gap-2">
          <Badge variant="outline" className="w-fit">
            Размеры
          </Badge>
          <CardTitle>Самые арендуемые размеры</CardTitle>
          <CardDescription>Рейтинг размеров по учтенным дням аренды внутри периода.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="py-4">
        {summary.mostRentedSizes.length === 0 ? (
          <ReportEmpty
            icon={<RulerIcon />}
            title="В этом периоде нет арендованных размеров."
            description="Подтвержденные, выданные или возвращенные заказы не пересекались с выбранными датами."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Размер</TableHead>
                  <TableHead>Позиции</TableHead>
                  <TableHead>Дни аренды</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.mostRentedSizes.map((size) => (
                  <TableRow key={size.size}>
                    <TableCell>
                      <Badge variant="secondary">{size.size}</Badge>
                    </TableCell>
                    <TableCell>{size.rentalItemCount}</TableCell>
                    <TableCell>{size.rentedDays}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function BicycleUtilizationTable({
  items,
  periodDays,
}: {
  items: AdminBicycleUtilizationReportItem[]
  periodDays: number
}) {
  if (items.length === 0) {
    return (
      <ReportEmpty
        icon={<BikeIcon />}
        title="В этом периоде нет загрузки велосипедов."
        description="Подтвержденные, выданные или возвращенные заказы не пересекаются с выбранными датами."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Велосипед</TableHead>
            <TableHead>Производитель</TableHead>
            <TableHead>Дни</TableHead>
            <TableHead>Загрузка</TableHead>
            <TableHead>Сумма аренды</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.bicycleId}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{item.title}</span>
                  <span className="text-sm text-muted-foreground">Размер {item.size}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="grid gap-1">
                  <span>{item.manufacturer.publicName}</span>
                  <span className="text-sm text-muted-foreground">{item.manufacturer.city}</span>
                </div>
              </TableCell>
              <TableCell>{item.rentedDays} из {periodDays}</TableCell>
              <TableCell>
                <div className="grid min-w-36 gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>{formatUtilizationRate(item.utilizationRate)}</span>
                    <span className="text-sm text-muted-foreground">Позиций: {item.rentalItemCount}</span>
                  </div>
                  <Progress value={Math.min(100, Math.round(item.utilizationRate * 100))} />
                </div>
              </TableCell>
              <TableCell>{formatMoney(item.rentalAmountKopecks)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function ManufacturerReportTable({ items }: { items: AdminManufacturerReportItem[] }) {
  if (items.length === 0) {
    return (
      <ReportEmpty
        icon={<StoreIcon />}
        title="В этом периоде нет статистики производителей."
        description="По производителям не найдены арендная активность или отмены."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[1040px]">
        <TableHeader>
          <TableRow>
            <TableHead>Производитель</TableHead>
            <TableHead>Активные заказы</TableHead>
            <TableHead>Велосипеды</TableHead>
            <TableHead>Дни аренды</TableHead>
            <TableHead>Сумма аренды</TableHead>
            <TableHead>Сумма залогов</TableHead>
            <TableHead>Отменено</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.manufacturer.id}>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-medium">{item.manufacturer.publicName}</span>
                  <span className="text-sm text-muted-foreground">{item.manufacturer.city}</span>
                </div>
              </TableCell>
              <TableCell>{item.activeRentalOrderCount}</TableCell>
              <TableCell>{item.bicycleCount}</TableCell>
              <TableCell>{item.rentedDays}</TableCell>
              <TableCell>{formatMoney(item.rentalAmountKopecks)}</TableCell>
              <TableCell>{formatMoney(item.depositAmountKopecks)}</TableCell>
              <TableCell>{item.cancelledOrderCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ReportMetricCard({
  description,
  icon,
  title,
  value,
}: {
  description: string
  icon: ReactNode
  title: string
  value: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm">{title}</span>
        </div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function ReportEmpty({
  description,
  icon,
  title,
}: {
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
