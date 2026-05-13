import * as React from "react"

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
}

function TableFilterInput({
  className,
  controlClassName,
  size = "lg",
  ...props
}: TableFilterInputProps) {
  return (
    <TableFilterControl className={controlClassName}>
      <Input className={className} size={size} {...props} />
    </TableFilterControl>
  )
}

export {
  TableFilterControl,
  TableFilterInline,
  TableFilterInput,
  TableFilters,
  TableFilterSelect,
}
