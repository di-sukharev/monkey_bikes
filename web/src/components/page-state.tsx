import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export function LoadingState({ message }: { message: string }) {
  return (
    <section
      data-testid="loading-state"
      className={cn(
        'mx-auto w-full max-w-6xl px-4 sm:px-6',
        'grid min-h-[100svh] place-items-center',
      )}
    >
      <Card data-testid="loading-state-card" className="w-full max-w-sm">
        <CardContent className="flex items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
          <Spinner className="size-5" />
          {message}
        </CardContent>
      </Card>
    </section>
  )
}

export function LoadingBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      <Spinner />
      {message}
    </div>
  )
}

export function GateCard({
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
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
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

export function FactCard({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
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
