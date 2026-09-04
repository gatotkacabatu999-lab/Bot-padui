import { useState, type FormEvent } from "react"
import { login } from "@/lib/auth"

interface LoginScreenProps {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await login(password)
    setLoading(false)
    if (result.ok) {
      onSuccess()
    } else {
      setError(result.error ?? "Invalid password")
      setPassword("")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "var(--background, #f4f7fb)" }}
    >
      {/* Logo area */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <img
          src="/FamilyMart.png"
          alt="FamilyMart"
          className="h-14 w-14 rounded-xl object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
        />
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight">DBRUTALS</p>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Vending Machine Operations
          </p>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl border shadow-sm p-8"
        style={{ background: "var(--card, white)" }}
      >
        <h2 className="mb-1 text-center text-base font-semibold">Sign in</h2>
        <p className="mb-6 text-center text-xs text-muted-foreground">
          Enter your access password to continue
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            disabled={loading}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">POWERED BY DBRUTALS · V1.0.0</p>
    </div>
  )
}
