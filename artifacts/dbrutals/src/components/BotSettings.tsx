import { useCallback, useEffect, useMemo, useState } from "react"
import { Cog, ShieldCheck, Link2, MessageSquareText, Users, UserRound, HelpCircle, ListFilter, Loader2, CheckCircle2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

type MessageBehaviorSettings = {
  respondInGroup: boolean
  respondInPrivate: boolean
  respondForAnyone: boolean
  respondOnlySelectedGroups: boolean
  groupAllowlistEnabled?: boolean
  allowedNumbers: string
  allowedGroups: string[]
  autoRespondUnknownCommand: boolean
  unknownCommandInPrivate: boolean
  unknownCommandInGroup: boolean
}

type MessageBehaviorToggleKey =
  | "respondInGroup"
  | "respondInPrivate"
  | "respondForAnyone"
  | "respondOnlySelectedGroups"
  | "autoRespondUnknownCommand"
  | "unknownCommandInPrivate"
  | "unknownCommandInGroup"

const DEFAULT_SETTINGS: MessageBehaviorSettings = {
  respondInGroup: true,
  respondInPrivate: true,
  respondForAnyone: true,
  respondOnlySelectedGroups: false,
  allowedNumbers: "",
  allowedGroups: [],
  autoRespondUnknownCommand: true,
  unknownCommandInPrivate: true,
  unknownCommandInGroup: true,
}

export function BotSettings() {
  const [settings, setSettings] = useState<MessageBehaviorSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<keyof MessageBehaviorSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const token = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("token")
    return value?.trim() || ""
  }, [])

  const normalizeGroupList = useCallback((value: string | string[] | null | undefined) => {
    const rawItems = Array.isArray(value)
      ? value
      : String(value ?? "")
          .split(/[\n,]/)
          .map((item) => item.trim())

    return Array.from(new Set(rawItems
      .flatMap((item) => String(item).split(/[\n,]/))
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => item.endsWith("@g.us"))))
  }, [])

  const requestWithFallback = useCallback(async (method: "GET" | "POST", payload?: MessageBehaviorSettings) => {
    const endpoints = ["/bot/settings", "/api/bot-settings"]
    let lastError = "Failed to update bot settings"

    for (const endpoint of endpoints) {
      const target = token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint
      try {
        const response = await fetch(target, {
          method,
          headers: {
            ...(token ? { "x-bot-dashboard-token": token } : {}),
            ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
          },
          body: method === "POST" ? JSON.stringify({ messageBehavior: payload }) : undefined,
        })

        const contentType = response.headers.get("content-type") || ""
        const data = contentType.includes("application/json")
          ? await response.json()
          : { success: false, error: await response.text() }

        if (!response.ok || !data?.success || !data?.data?.messageBehavior) {
          lastError = data?.error || `Server returned ${response.status}`
          continue
        }

        return data.data.messageBehavior as MessageBehaviorSettings
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Failed to update bot settings"
      }
    }

    throw new Error(lastError)
  }, [token])

  const fetchSettings = useCallback(async () => {
    try {
      setError(null)
      const loaded = await requestWithFallback("GET")
      setSettings({
        respondInGroup: loaded.respondInGroup !== false,
        respondInPrivate: loaded.respondInPrivate !== false,
        respondForAnyone: loaded.respondForAnyone !== false,
        respondOnlySelectedGroups: loaded.respondOnlySelectedGroups === true || loaded.groupAllowlistEnabled === true,
        allowedNumbers: String(loaded.allowedNumbers ?? "").trim(),
        allowedGroups: normalizeGroupList(loaded.allowedGroups ?? []),
        autoRespondUnknownCommand: loaded.autoRespondUnknownCommand !== false,
        unknownCommandInPrivate: loaded.unknownCommandInPrivate !== false,
        unknownCommandInGroup: loaded.unknownCommandInGroup !== false,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal dapatkan bot settings")
    } finally {
      setLoading(false)
    }
  }, [requestWithFallback])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const updateSetting = useCallback(async (key: keyof MessageBehaviorSettings, checked: boolean) => {
    const previous = settings
    const next = { ...settings, [key]: checked }
    setSettings(next)
    setSavingKey(key)
    setError(null)

    try {
      const saved = await requestWithFallback("POST", next)
      setSettings({
        respondInGroup: saved.respondInGroup !== false,
        respondInPrivate: saved.respondInPrivate !== false,
        respondForAnyone: saved.respondForAnyone !== false,
        respondOnlySelectedGroups: saved.respondOnlySelectedGroups === true || saved.groupAllowlistEnabled === true,
        allowedNumbers: String(saved.allowedNumbers ?? "").trim(),
        allowedGroups: normalizeGroupList(saved.allowedGroups ?? []),
        autoRespondUnknownCommand: saved.autoRespondUnknownCommand !== false,
        unknownCommandInPrivate: saved.unknownCommandInPrivate !== false,
        unknownCommandInGroup: saved.unknownCommandInGroup !== false,
      })
      setSavedAt(Date.now())
    } catch (err) {
      setSettings(previous)
      setError(err instanceof Error ? err.message : "Gagal simpan bot settings")
    } finally {
      setSavingKey(null)
    }
  }, [requestWithFallback, settings])

  const settingRows: Array<{ key: MessageBehaviorToggleKey; title: string; desc: string; icon: typeof Users }> = [
    {
      key: "respondInGroup",
      title: "Bot respond di group",
      desc: "ON: bot boleh balas mesej dalam group WhatsApp.",
      icon: Users,
    },
    {
      key: "respondInPrivate",
      title: "Bot respond di private chat",
      desc: "ON: bot balas mesej direct/personal chat.",
      icon: UserRound,
    },
    {
      key: "respondForAnyone",
      title: "Bot respond for anyone",
      desc: "OFF: hanya nombor dalam ALLOWED_NUMBERS boleh trigger bot.",
      icon: MessageSquareText,
    },
    {
      key: "autoRespondUnknownCommand",
      title: "Auto respond unknown command",
      desc: "ON: bot balas 'command not found'. OFF: bot diam untuk command tak wujud.",
      icon: HelpCircle,
    },
  ]

  const handleAllowedNumbersChange = useCallback(async (nextValue: string) => {
    const next = { ...settings, allowedNumbers: nextValue }
    setSettings(next)
    setError(null)

    try {
      const saved = await requestWithFallback("POST", next)
      setSettings({
        respondInGroup: saved.respondInGroup !== false,
        respondInPrivate: saved.respondInPrivate !== false,
        respondForAnyone: saved.respondForAnyone !== false,
        respondOnlySelectedGroups: saved.respondOnlySelectedGroups === true || saved.groupAllowlistEnabled === true,
        allowedNumbers: String(saved.allowedNumbers ?? "").trim(),
        allowedGroups: normalizeGroupList(saved.allowedGroups ?? []),
        autoRespondUnknownCommand: saved.autoRespondUnknownCommand !== false,
        unknownCommandInPrivate: saved.unknownCommandInPrivate !== false,
        unknownCommandInGroup: saved.unknownCommandInGroup !== false,
      })
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal simpan Allowed_Numbers")
    }
  }, [normalizeGroupList, requestWithFallback, settings])

  const handleAllowedGroupsChange = useCallback(async (nextGroups: string[]) => {
    const next = { ...settings, allowedGroups: nextGroups }
    setSettings(next)
    setError(null)

    try {
      const saved = await requestWithFallback("POST", next)
      setSettings({
        respondInGroup: saved.respondInGroup !== false,
        respondInPrivate: saved.respondInPrivate !== false,
        respondForAnyone: saved.respondForAnyone !== false,
        respondOnlySelectedGroups: saved.respondOnlySelectedGroups === true || saved.groupAllowlistEnabled === true,
        allowedNumbers: String(saved.allowedNumbers ?? "").trim(),
        allowedGroups: normalizeGroupList(saved.allowedGroups ?? []),
        autoRespondUnknownCommand: saved.autoRespondUnknownCommand !== false,
        unknownCommandInPrivate: saved.unknownCommandInPrivate !== false,
        unknownCommandInGroup: saved.unknownCommandInGroup !== false,
      })
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal simpan group allowlist")
    }
  }, [normalizeGroupList, requestWithFallback, settings])

  const disabled = loading || savingKey !== null
  const groupRow = settingRows.find((row) => row.key === "respondInGroup")!
  const privateRow = settingRows.find((row) => row.key === "respondInPrivate")!
  const anyoneRow = settingRows.find((row) => row.key === "respondForAnyone")!
  const unknownRow = settingRows.find((row) => row.key === "autoRespondUnknownCommand")!

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Cog className="size-5 text-primary" />
              Bot Settings
            </h1>
            <p className="mt-1 text-xs md:text-sm text-muted-foreground">
              Manage WhatsApp bot behavior with simple ON/OFF switches.
            </p>
          </div>

          {loading ? (
            <Badge variant="outline" className="gap-1.5 self-start text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading
            </Badge>
          ) : savingKey ? (
            <Badge variant="outline" className="gap-1.5 self-start text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Saving
            </Badge>
          ) : savedAt ? (
            <Badge variant="outline" className="gap-1.5 self-start border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Saved
            </Badge>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary/80" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Chat Access</p>
        </div>

        <div className="mt-3 divide-y divide-border/60 rounded-xl border border-border/60 bg-background/60">
          <div className="px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <groupRow.icon className="size-4 text-primary/80 shrink-0" />
                  {groupRow.title}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{groupRow.desc}</p>
              </div>
              <Switch
                size="sm"
                checked={settings.respondInGroup}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  void updateSetting("respondInGroup", checked)
                }}
              />
            </div>

            {settings.respondInGroup ? (
              <div className="mt-3 ml-6 rounded-lg border border-l-2 border-l-primary/50 border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground">
                    <ListFilter className="size-3.5" />
                    Hanya group terpilih
                  </p>
                  <Switch
                    size="sm"
                    checked={settings.respondOnlySelectedGroups}
                    disabled={disabled}
                    onCheckedChange={(checked) => {
                      void updateSetting("respondOnlySelectedGroups", checked)
                    }}
                  />
                </div>

                {settings.respondOnlySelectedGroups ? (
                  <div className="mt-3 space-y-3">
                    <Textarea
                      value={settings.allowedGroups.join(",\n")}
                      rows={3}
                      disabled={disabled}
                      placeholder="123456789012345@g.us, 987654321098765@g.us"
                      className="min-h-20 resize-y text-xs"
                      onChange={(event) => {
                        void handleAllowedGroupsChange(normalizeGroupList(event.target.value))
                      }}
                    />

                    {settings.allowedGroups.length ? (
                      <div className="space-y-2">
                        {settings.allowedGroups.map((groupId, index) => (
                          <div key={`${groupId}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-background/80 px-2 py-1.5">
                            <span className="truncate text-[10px] text-muted-foreground">{groupId}</span>
                            <Switch
                              size="sm"
                              checked
                              disabled={disabled}
                              onCheckedChange={() => {
                                const nextGroups = settings.allowedGroups.filter((_, groupIndex) => groupIndex !== index)
                                void handleAllowedGroupsChange(nextGroups)
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-start justify-between gap-3 px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold flex items-center gap-2">
                <privateRow.icon className="size-4 text-primary/80 shrink-0" />
                {privateRow.title}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{privateRow.desc}</p>
            </div>
            <Switch
              size="sm"
              checked={settings.respondInPrivate}
              disabled={disabled}
              onCheckedChange={(checked) => {
                void updateSetting("respondInPrivate", checked)
              }}
            />
          </div>

          <div className="px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <anyoneRow.icon className="size-4 text-primary/80 shrink-0" />
                  {anyoneRow.title}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{anyoneRow.desc}</p>
              </div>
              <Switch
                size="sm"
                checked={settings.respondForAnyone}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  void updateSetting("respondForAnyone", checked)
                }}
              />
            </div>

            {!settings.respondForAnyone ? (
              <div className="mt-3 ml-6 rounded-lg border border-l-2 border-l-primary/50 border-border/60 bg-muted/20 p-3">
                <label className="block text-[11px] font-medium text-muted-foreground">Allowed_Numbers</label>
                <Textarea
                  value={settings.allowedNumbers}
                  rows={2}
                  disabled={disabled}
                  placeholder="60123456789,6281234567890"
                  className="mt-2 min-h-20 resize-y text-xs"
                  onChange={(event) => {
                    void handleAllowedNumbersChange(event.target.value)
                  }}
                />
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Pisahkan nombor dengan koma. Nombor yang tidak masuk senarai tidak boleh trigger bot.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4 text-primary/80" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Unknown Command Handling</p>
        </div>

        <div className="mt-3 rounded-xl border border-border/60 bg-background/60 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold flex items-center gap-2">
                <unknownRow.icon className="size-4 text-primary/80 shrink-0" />
                {unknownRow.title}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{unknownRow.desc}</p>
            </div>
            <Switch
              size="sm"
              checked={settings.autoRespondUnknownCommand}
              disabled={disabled}
              onCheckedChange={(checked) => {
                void updateSetting("autoRespondUnknownCommand", checked)
              }}
            />
          </div>

          {settings.autoRespondUnknownCommand ? (
            <div className="mt-3 ml-6 space-y-2 rounded-lg border border-l-2 border-l-primary/50 border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground">
                  <UserRound className="size-3.5" />
                  Personal chat
                </p>
                <Switch
                  size="sm"
                  checked={settings.unknownCommandInPrivate}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    void updateSetting("unknownCommandInPrivate", checked)
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Users className="size-3.5" />
                  Group
                </p>
                <Switch
                  size="sm"
                  checked={settings.unknownCommandInGroup}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    void updateSetting("unknownCommandInGroup", checked)
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Connection</p>
          <p className="mt-2 text-sm font-semibold flex items-center gap-2">
            <Link2 className="size-4 text-primary/80" />
            Base URL and token
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ensure APP_BASE_URL, dashboard token, and BOT_PAIRING_METHOD are valid before pairing devices.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Security</p>
          <p className="mt-2 text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary/80" />
            Session persistence
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep AUTH_DIR persisted and rotate tokens when moving environments.
          </p>
        </div>
      </div>
    </div>
  )
}
