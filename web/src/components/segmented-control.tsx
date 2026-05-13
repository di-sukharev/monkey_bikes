import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { cn } from '@/lib/utils'

type SegmentedControlOption<TValue extends string> = {
  label: string
  value: TValue
}

type SegmentedControlProps<TValue extends string> = {
  'aria-label': string
  options: ReadonlyArray<SegmentedControlOption<TValue>>
  value: TValue
  onValueChange: (value: TValue) => void
}

const columnClassByCount = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
} as const

export function SegmentedControl<TValue extends string>({
  'aria-label': ariaLabel,
  options,
  value,
  onValueChange,
}: SegmentedControlProps<TValue>) {
  const columnClass = options.length === 3 ? columnClassByCount[3] : columnClassByCount[2]

  return (
    <ButtonGroup
      aria-label={ariaLabel}
      className={cn('grid w-full rounded-lg bg-muted p-1', columnClass)}
    >
      {options.map((option) => {
        const isSelected = value === option.value

        return (
          <Button
            key={option.value}
            type="button"
            variant={isSelected ? 'outline' : 'ghost'}
            className={cn('h-10 bg-transparent', isSelected && 'bg-background shadow-sm')}
            aria-pressed={isSelected}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </Button>
        )
      })}
    </ButtonGroup>
  )
}
