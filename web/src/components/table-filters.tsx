import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { cn } from "@/lib/utils"

function TableFilters({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-filters"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
        className
      )}
      {...props}
    />
  )
}

function TableFilterControl({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-filter-control"
      className={cn("w-full min-w-0 sm:w-56", className)}
      {...props}
    />
  )
}

function TableFilterInline({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-filter-inline"
      className={cn("min-w-0 overflow-x-auto", className)}
      {...props}
    />
  )
}

type TableFilterSelectProps = Omit<React.ComponentProps<typeof NativeSelect>, "fullWidth"> & {
  controlClassName?: string
}

function TableFilterSelect({
  className,
  controlClassName,
  ...props
}: TableFilterSelectProps) {
  return (
    <TableFilterControl className={controlClassName}>
      <NativeSelect fullWidth className={className} {...props} />
    </TableFilterControl>
  )
}

type TableFilterInputProps = React.ComponentProps<typeof Input> & {
  controlClassName?: string
  label?: React.ReactNode
}

function TableFilterInput({
  className,
  controlClassName,
  id,
  label,
  size = "lg",
  ...props
}: TableFilterInputProps) {
  if (label) {
    return (
      <TableFilterControl className={cn("grid gap-1", controlClassName)}>
        <label className="text-sm font-medium leading-snug" htmlFor={id}>{label}</label>
        <Input id={id} className={className} size={size} {...props} />
      </TableFilterControl>
    )
  }

  return (
    <TableFilterControl className={controlClassName}>
      <Input id={id} className={className} size={size} {...props} />
    </TableFilterControl>
  )
}

type TableFilterCheckboxOption<Value extends string> = {
  label: React.ReactNode
  value: Value
}

type TableFilterCheckboxGroupProps<Value extends string> =
  Omit<React.ComponentProps<"fieldset">, "onChange"> & {
    controlClassName?: string
    disabled?: boolean
    legend: React.ReactNode
    onValuesChange: (values: Value[]) => void
    options: readonly TableFilterCheckboxOption<Value>[]
    values: readonly Value[]
  }

function TableFilterCheckboxGroup<Value extends string>({
  className,
  controlClassName,
  disabled = false,
  legend,
  onValuesChange,
  options,
  values,
  ...props
}: TableFilterCheckboxGroupProps<Value>) {
  const selectedValues = new Set(values)

  return (
    <TableFilterControl className={cn("sm:w-auto", controlClassName)}>
      <fieldset
        data-slot="table-filter-checkbox-group"
        className={cn("grid gap-1", className)}
        disabled={disabled}
        {...props}
      >
        <legend className="text-sm font-medium leading-snug">{legend}</legend>
        <div className="flex min-h-11 flex-wrap items-center gap-2">
          {options.map((option) => {
            const checked = selectedValues.has(option.value)

            return (
              <label
                key={option.value}
                className={cn(
                  "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-base border-2 border-border bg-secondary-background px-3 text-sm font-base whitespace-nowrap transition-colors",
                  checked && "bg-main text-main-foreground",
                  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  className="size-4"
                  onCheckedChange={(nextChecked) => {
                    const nextValues = nextChecked === true
                      ? options
                          .map((nextOption) => nextOption.value)
                          .filter((nextValue) => nextValue === option.value || selectedValues.has(nextValue))
                      : values.filter((nextValue) => nextValue !== option.value)

                    onValuesChange(nextValues)
                  }}
                />
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </TableFilterControl>
  )
}

export {
  TableFilterCheckboxGroup,
  TableFilterControl,
  TableFilterInline,
  TableFilterInput,
  TableFilters,
  TableFilterSelect,
}
