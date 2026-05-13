import * as React from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom border-2 border-border bg-secondary-background text-sm font-base",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b-2 [&_tr]:border-border [&_tr]:bg-main [&_tr]:text-main-foreground", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t-2 border-border bg-main font-heading text-main-foreground [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b-2 border-border bg-secondary-background text-foreground transition-colors hover:bg-main/20 has-aria-expanded:bg-main/20 data-[state=selected]:bg-main data-[state=selected]:text-main-foreground",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-12 px-4 text-left align-middle font-heading whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-4 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm font-base text-foreground", className)}
      {...props}
    />
  )
}

const tableSkeletonWidths = [
  "w-[72%]",
  "w-[48%]",
  "w-[56%]",
  "w-[42%]",
  "w-[64%]",
  "w-[52%]",
  "w-[36%]",
]

const tableSkeletonHeaderWidths = [
  "w-28",
  "w-20",
  "w-24",
  "w-16",
  "w-32",
  "w-24",
  "w-20",
]

type TableSkeletonProps = Omit<React.ComponentProps<"div">, "children"> & {
  actionColumn?: boolean
  columns: number
  label?: string
  rows?: number
  tableClassName?: string
}

function TableSkeleton({
  actionColumn = true,
  className,
  columns,
  label = "Загружаем таблицу...",
  rows = 5,
  tableClassName,
  ...props
}: TableSkeletonProps) {
  const columnIndexes = Array.from({ length: Math.max(1, columns) }, (_, index) => index)
  const rowIndexes = Array.from({ length: Math.max(1, rows) }, (_, index) => index)
  const lastColumnIndex = columnIndexes.length - 1

  return (
    <div
      aria-busy="true"
      aria-label={label}
      aria-live="polite"
      data-slot="table-skeleton"
      role="status"
      className={cn("overflow-x-auto rounded-lg border", className)}
      {...props}
    >
      <Table aria-hidden="true" className={tableClassName}>
        <TableHeader>
          <TableRow className="hover:bg-secondary-background">
            {columnIndexes.map((columnIndex) => (
              <TableHead key={columnIndex}>
                <Skeleton
                  className={cn(
                    "h-4",
                    tableSkeletonHeaderWidths[columnIndex % tableSkeletonHeaderWidths.length],
                  )}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowIndexes.map((rowIndex) => (
            <TableRow key={rowIndex} className="hover:bg-secondary-background">
              {columnIndexes.map((columnIndex) => {
                const isActionColumn = actionColumn && columnIndex === lastColumnIndex

                return (
                  <TableCell key={columnIndex}>
                    {columnIndex === 0 ? (
                      <div className="grid min-w-36 gap-2">
                        <Skeleton
                          className={cn(
                            "h-4",
                            tableSkeletonWidths[rowIndex % tableSkeletonWidths.length],
                          )}
                        />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ) : (
                      <Skeleton
                        className={cn(
                          isActionColumn ? "h-8 w-24" : "h-4",
                          !isActionColumn &&
                            tableSkeletonWidths[(rowIndex + columnIndex) % tableSkeletonWidths.length],
                        )}
                      />
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableSkeleton,
}
