/**
 * Lightweight theme provider — replaces next-themes ThemeProvider.
 * The app applies color-mode via the IIFE in main.tsx before React mounts,
 * so this shim only needs to supply the ThemeProviderProps interface for
 * downstream code that wraps children with it.
 */
import { createContext, useContext, type ReactNode } from "react"

interface ThemeContextValue {
  theme: string
  setTheme: (theme: string) => void
  resolvedTheme: string
  systemTheme: "light" | "dark"
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
  systemTheme: "light",
})

export function useThemeContext() {
  return useContext(ThemeContext)
}

export type ThemeProviderProps = {
  children: ReactNode
  attribute?: string
  defaultTheme?: string
  enableSystem?: boolean
  storageKey?: string
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const getResolved = () => {
    try {
      const stored = localStorage.getItem("colorMode")
      if (stored === "dark") return "dark"
      if (stored === "light") return "light"
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    } catch {
      return "light"
    }
  }

  const resolved = getResolved()

  const value: ThemeContextValue = {
    theme: (() => {
      try {
        return localStorage.getItem("colorMode") ?? "system"
      } catch {
        return "system"
      }
    })(),
    setTheme: (next: string) => {
      try {
        localStorage.setItem("colorMode", next)
        document.documentElement.classList.toggle("dark", next === "dark")
      } catch {
        // ignore
      }
    },
    resolvedTheme: resolved,
    systemTheme: window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
