"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps {
  id?: string
  size?: "sm" | "default"
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

/**
 * Lightweight toggle switch — replaces the primereact/inputswitch dependency
 * which is not available in PrimeReact v11's package structure.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ id, size = "default", checked = false, onCheckedChange, disabled, className }, ref) => {
    const isSmall = size === "sm"
    return (
      <button
        ref={ref}
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
          "transition-colors duration-200 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-input",
          isSmall ? "h-4 w-7" : "h-6 w-11",
          className,
        )}
      >
        <span
          className={cn(
            "pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out",
            isSmall ? "h-3 w-3" : "h-5 w-5",
            isSmall
              ? checked ? "translate-x-3" : "translate-x-0"
              : checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    )
  },
)
Switch.displayName = "Switch"

export { Switch }
