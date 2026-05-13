import * as React from "react"

import { cn } from "@/lib/utils"

type InputSize = "default" | "lg"

type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  size?: React.ComponentProps<"input">["size"] | InputSize
}

function Input({ className, size = "default", type, ...props }: InputProps) {
  const controlSize = typeof size === "number" ? "default" : size
  const nativeSize = typeof size === "number" ? size : undefined

  return (
    <input
      type={type}
      size={nativeSize}
      data-slot="input"
      data-size={controlSize}
      className={cn(
        "flex w-full min-w-0 rounded-base border-2 border-border bg-secondary-background px-3 py-2 text-base font-base text-foreground outline-none selection:bg-main selection:text-main-foreground file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-heading placeholder:text-foreground/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 md:text-sm",
        controlSize === "default" && "h-10",
        controlSize === "lg" && "h-11",
        className
      )}
      {...props}
    />
  )
}

export { Input }
