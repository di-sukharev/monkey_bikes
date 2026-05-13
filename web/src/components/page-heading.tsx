import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type PageHeadingProps = {
  description?: ReactNode
  eyebrow?: ReactNode
  eyebrowTone?: 'outline' | 'secondary'
  level?: 1 | 2 | 3
  size?: 'hero' | 'page' | 'compact'
  title: ReactNode
}

const titleClassBySize = {
  hero: 'max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl',
  page: 'text-3xl font-semibold tracking-tight text-balance sm:text-5xl',
  compact: 'text-3xl font-semibold tracking-tight',
} as const

const descriptionClassBySize = {
  hero: 'max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg',
  page: 'text-base text-muted-foreground [&_strong]:text-foreground',
  compact: 'max-w-3xl text-sm text-muted-foreground',
} as const

export function PageHeading({
  description,
  eyebrow,
  eyebrowTone = 'outline',
  level = 1,
  size = 'compact',
  title,
}: PageHeadingProps) {
  const TitleTag = `h${level}` as const

  return (
    <div className={cn('grid', size === 'hero' ? 'gap-5' : 'gap-2')}>
      {eyebrow && <Badge variant={eyebrowTone}>{eyebrow}</Badge>}
      <TitleTag className={titleClassBySize[size]}>{title}</TitleTag>
      {description && <p className={descriptionClassBySize[size]}>{description}</p>}
    </div>
  )
}
