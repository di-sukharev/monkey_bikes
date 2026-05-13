import type { PublicBicycleDto } from '@web-app-demo/contracts'
import { Link } from '@tanstack/react-router'
import { MapPinIcon, TruckIcon } from 'lucide-react'

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
import { formatMoney } from './model'
import { BicycleSizeBadge } from './status-badge'

export function PublicBicycleCard({
  bicycle,
  selected = false,
  onSelectedChange,
}: {
  bicycle: PublicBicycleDto
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
}) {
  const imageUrl = bicycle.photoUrls[0]

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="grid gap-2">
          {onSelectedChange && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelectedChange(checked === true)}
              />
              Выбрать для заявки
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <BicycleSizeBadge size={bicycle.size} />
            <Badge variant="secondary">{formatMoney(bicycle.pricePerDayKopecks)} / день</Badge>
          </div>
          <h2 className="text-lg font-semibold leading-tight">{bicycle.title}</h2>
          <CardDescription>{bicycle.manufacturer.publicName}</CardDescription>
        </div>
        <CardAction>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/bicycles/$id"
              params={{ id: bicycle.id }}
              aria-label={`Детали велосипеда ${bicycle.title}`}
            >
              Детали
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 py-4">
        {imageUrl && (
          <div className="aspect-video overflow-hidden rounded-md border bg-muted">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <p className="line-clamp-3 text-sm text-muted-foreground">{bicycle.description}</p>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="size-4" />
            {bicycle.city}
          </span>
          {bicycle.deliveryAvailable && (
            <span className="inline-flex items-center gap-1">
              <TruckIcon className="size-4" />
              Доставка
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
