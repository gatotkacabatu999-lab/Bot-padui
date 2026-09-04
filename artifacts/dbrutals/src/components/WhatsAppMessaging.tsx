import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, ContactRound, FileAudio, FileText, Image, ListChecks, LoaderCircle, MapPin, MessageCircleMore, Mic, Music2, Pencil, Phone, Plus, Search, Send, Smartphone, Smile, Trash2, Upload, UserRound, Video, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertDialogContentRoot, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface WhatsAppMessagingProps {
  page: string
}

const pageConfig: Record<string, { title: string; description: string; icon: typeof MessageCircleMore }> = {
  "bot-send-chat": {
    title: "Send Chat",
    description: "Hantar mesej kepada individu atau group WhatsApp.",
    icon: MessageCircleMore,
  },
  "bot-schedule-chat": {
    title: "Schedule Chat",
    description: "Plan and manage scheduled WhatsApp conversations.",
    icon: CalendarClock,
  },
  "bot-delete-message": {
    title: "Delete Massage",
    description: "Semak semula mesej, media, dan perbualan yang dipadam supaya anda boleh lihat kembali kandungannya.",
    icon: Trash2,
  },
  "bot-contact": {
    title: "Contact",
    description: "Manage WhatsApp contacts and related details.",
    icon: ContactRound,
  },
}

function getMediaType(file: File): 'image' | 'video' | 'audio' | 'document' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'document'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function WhatsAppMessaging({ page }: WhatsAppMessagingProps) {
  const config = pageConfig[page] ?? pageConfig["bot-send-chat"]
  const Icon = config.icon

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-emerald-500" />
          <h1 className="text-lg md:text-xl font-bold">{config.title}</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{config.description}</p>
      </div>

      {page === "bot-send-chat" ? <SendChat /> : page === "bot-delete-message" ? <DeletedMessages /> : page === "bot-contact" ? <ContactManager /> : (
        <div className="rounded-lg border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Fungsi ini akan tersedia pada halaman seterusnya.</p>
        </div>
      )}
    </div>
  )
}

function useDashboardToken() {
  return useMemo(() => new URLSearchParams(window.location.search).get('token')?.trim() || '', [])
}

export type InteractiveButtonType = 'cta_url' | 'pdf_url' | 'cta_copy' | 'quick_reply' | 'button_call' | 'send_whatsapp' | 'single_select'

export const INTERACTIVE_BUTTON_TYPES: { value: InteractiveButtonType; label: string; helper: string }[] = [
  { value: 'cta_url', label: 'CTA URL', helper: 'Buka link website.' },
  { value: 'pdf_url', label: 'PDF URL', helper: 'Buka fail PDF.' },
  { value: 'cta_copy', label: 'Copy', helper: 'Salin teks.' },
  { value: 'quick_reply', label: 'Quick Reply', helper: 'Isi command / payload.' },
  { value: 'button_call', label: 'Call', helper: 'Nombor telefon.' },
  { value: 'send_whatsapp', label: 'WhatsApp', helper: 'Link WhatsApp.' },
  { value: 'single_select', label: 'Single Select', helper: 'Isi pilihan command.' },
]

export function getDefaultButtonValueHint(type: InteractiveButtonType): string {
  switch (type) {
    case 'cta_url':
      return 'https://example.com'
    case 'pdf_url':
      return 'https://example.com/file.pdf'
    case 'cta_copy':
      return 'PROMO2026'
    case 'quick_reply':
      return 'command_key'
    case 'button_call':
      return '+60123456789'
    case 'send_whatsapp':
      return '60123456789'
    case 'single_select':
      return 'option_key'
    default:
      return ''
  }
}

type InteractiveButton = {
  id: string
  type: InteractiveButtonType
  label: string
  value: string
}

function createInteractiveButton(type: InteractiveButtonType = 'quick_reply'): InteractiveButton {
  return {
    id: `button_${Math.random().toString(36).slice(2, 8)}`,
    type,
    label: '',
    value: '',
  }
}

function SendChat() {
  const token = useDashboardToken()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [recipientType, setRecipientType] = useState<'personal' | 'group'>('personal')
  const [recipient, setRecipient] = useState('')
  const [text, setText] = useState('')
  const [interactiveButtons, setInteractiveButtons] = useState<InteractiveButton[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [voiceNote, setVoiceNote] = useState(false)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const addInteractiveButton = useCallback(() => {
    setInteractiveButtons((prev) => {
      if (prev.length >= 3) return prev
      return [...prev, createInteractiveButton('quick_reply')]
    })
  }, [])

  const updateInteractiveButton = useCallback((buttonId: string, patch: Partial<InteractiveButton>) => {
    setInteractiveButtons((prev) => prev.map((button) => (button.id === buttonId ? { ...button, ...patch } : button)))
  }, [])

  const getButtonValueHintText = useCallback((button: InteractiveButton) => {
    return `Contoh: ${getDefaultButtonValueHint(button.type) || 'nilai untuk jenis button ini'}`
  }, [])

  const removeInteractiveButton = useCallback((buttonId: string) => {
    setInteractiveButtons((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((button) => button.id !== buttonId)
    })
  }, [])

  const sendMessage = useCallback(async () => {
    if (!recipient.trim()) return setFeedback('Sila isi penerima.')
    if (!text.trim() && !file) return setFeedback('Sila isi teks atau pilih fail.')
    if (file && file.size > 7 * 1024 * 1024) return setFeedback('Saiz fail maksimum ialah 7MB.')
    try {
      setSending(true)
      setFeedback(null)
      const media = file ? await new Promise<{ data: string; type: string; mimetype: string; fileName: string; ptt: boolean }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ data: String(reader.result), type: getMediaType(file), mimetype: file.type, fileName: file.name, ptt: voiceNote })
        reader.onerror = () => reject(new Error('Gagal baca fail'))
        reader.readAsDataURL(file)
      }) : undefined
      const buttons = interactiveButtons
        .filter((button) => button.label.trim() && button.value.trim())
        .map((button) => ({
          type: button.type,
          label: button.label.trim(),
          value: button.value.trim(),
        }))
      const response = await fetch(token ? `/api/bot/messages?token=${encodeURIComponent(token)}` : '/api/bot/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-bot-dashboard-token': token } : {}) },
        body: JSON.stringify({ recipient, recipientType, text, media, buttons }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Gagal hantar mesej')
      setFeedback('Mesej berjaya dihantar.')
      setText('')
      setInteractiveButtons([])
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Gagal hantar mesej')
    } finally {
      setSending(false)
    }
  }, [file, interactiveButtons, recipient, recipientType, text, token, voiceNote])

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
    <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm md:p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="recipient-type">Jenis penerima</Label><Select value={recipientType} onValueChange={(value) => setRecipientType(value as 'personal' | 'group')}><SelectTrigger id="recipient-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="personal">Personal</SelectItem><SelectItem value="group">Group</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="recipient">{recipientType === 'group' ? 'Group ID' : 'Nombor telefon'}</Label><Input id="recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={recipientType === 'group' ? '1234567890-123456789@g.us' : '60123456789'} /></div>
      </div>
      <div className="mt-4 space-y-1.5"><Label htmlFor="message-text">Mesej</Label><Textarea id="message-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Tulis mesej anda" className="min-h-32" /></div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Butang interaktif</Label>
          <Button type="button" variant="outline" size="sm" onClick={addInteractiveButton} disabled={interactiveButtons.length >= 3} className="gap-1.5">
            <Plus className="size-3.5" /> Tambah button
          </Button>
        </div>

        {interactiveButtons.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Tiada button. Klik “Tambah button” jika mahu tambah interaksi.</p>
        ) : null}

        <div className="space-y-3">
          {interactiveButtons.map((button, index) => (
            <div key={button.id} className="rounded-xl border border-border/70 bg-muted/25 p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Button {index + 1}</p>
                {interactiveButtons.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => removeInteractiveButton(button.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`button-type-${button.id}`}>Jenis button</Label>
                  <Select value={button.type} onValueChange={(value) => updateInteractiveButton(button.id, {
                    type: value as InteractiveButtonType,
                    value: '',
                  })}>
                    <SelectTrigger id={`button-type-${button.id}`}>
                      <SelectValue placeholder="Pilih jenis" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERACTIVE_BUTTON_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`button-label-${button.id}`}>Nama button</Label>
                  <Input id={`button-label-${button.id}`} value={button.label} onChange={(event) => updateInteractiveButton(button.id, { label: event.target.value })} placeholder="Contoh: Lihat Info" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`button-value-${button.id}`}>Isi data / command</Label>
                  <Input
                    id={`button-value-${button.id}`}
                    value={button.value}
                    onChange={(event) => updateInteractiveButton(button.id, { value: event.target.value })}
                    placeholder=""
                    className="placeholder:text-transparent"
                  />
                  <p className="text-[10px] text-muted-foreground/80">
                    {getButtonValueHintText(button)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {button.type === 'quick_reply' || button.type === 'single_select' ? 'Untuk quick reply / single select, isi command payload di field ketiga.' : INTERACTIVE_BUTTON_TYPES.find((item) => item.value === button.type)?.helper}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Input ref={fileInputRef} className="hidden" id="message-file" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" /> Pilih fail</Button>{file ? <span className="text-sm text-muted-foreground">{file.name} ({Math.ceil(file.size / 1024)} KB)</span> : <span className="text-sm text-muted-foreground">Imej, video, audio, voice note atau dokumen (maks. 7MB)</span>}{file && getMediaType(file) === 'audio' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={voiceNote} onChange={(event) => setVoiceNote(event.target.checked)} /> Voice note</label> : null}</div>
      {feedback ? <p className="mt-4 text-sm text-muted-foreground" role="status">{feedback}</p> : null}
      <div className="mt-5 flex justify-end"><Button type="button" onClick={() => void sendMessage()} disabled={sending}>{sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{sending ? 'Menghantar' : 'Hantar mesej'}</Button></div>
    </section>
    <aside className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground shadow-sm"><p className="font-medium text-foreground">Sasaran penghantaran</p><p className="mt-2">Personal menerima nombor dengan format antarabangsa, contohnya 60123456789.</p><p className="mt-3">Group memerlukan Group ID WhatsApp penuh yang berakhir dengan @g.us.</p><p className="mt-3">Untuk media, butang dihantar sebagai mesej interaktif selepas fail.</p></aside>
  </div>
}

type DeletedMessage = {
  eventId: string
  id: string
  chatJid: string
  chatName: string
  chatType: 'personal' | 'group' | 'status'
  senderJid: string
  senderName: string
  fromMe: boolean
  timestamp: string
  changedAt: string
  deletedAt: string
  eventType: 'deleted' | 'edited' | 'status'
  text: string
  originalText: string
  currentText: string | null
  mediaType: string | null
  fileName: string | null
  mimetype: string | null
  mediaPath: string | null
  contentType?: string | null
  isVoiceNote?: boolean
  isGif?: boolean
  details?: {
    location?: {
      latitude: number
      longitude: number
      name?: string
      address?: string
    }
    contact?: {
      displayName: string
    }
    poll?: {
      name: string
      options: string[]
    }
    reaction?: {
      text: string
    }
  } | null
  contentRecovered?: boolean
  contentSource?: 'captured' | 'fallback'
}

function getDeletedMediaPreviewUrl(message: DeletedMessage, token: string) {
  if (!message.mediaPath) return null
  return `${token ? `/api/bot/deleted-messages/media/${encodeURIComponent(message.mediaPath)}?token=${encodeURIComponent(token)}` : `/api/bot/deleted-messages/media/${encodeURIComponent(message.mediaPath)}`}`
}

function getDeletedMediaLabel(message: DeletedMessage) {
  if (!message.mediaType && !message.fileName) return 'Fail media'
  if (message.mediaType === 'audio') return message.isVoiceNote ? 'Voice note' : message.fileName ? message.fileName : 'Audio'
  if (message.mediaType === 'image') return message.fileName ? message.fileName : 'Image'
  if (message.mediaType === 'video') return message.isGif ? 'GIF' : message.fileName ? message.fileName : 'Video'
  if (message.mediaType === 'sticker') return 'Sticker'
  return message.fileName ? message.fileName : 'Document'
}

function getDeletedContentLabel(message: DeletedMessage) {
  if (message.mediaType === 'image') return 'Imej'
  if (message.mediaType === 'video') return message.isGif ? 'GIF' : 'Video'
  if (message.mediaType === 'audio') return message.isVoiceNote ? 'Voice note' : 'Audio'
  if (message.mediaType === 'document') return 'Fail'
  if (message.mediaType === 'sticker') return 'Sticker'

  switch (message.contentType) {
    case 'locationMessage':
      return 'Lokasi'
    case 'liveLocationMessage':
      return 'Live location'
    case 'contactMessage':
    case 'contactsArrayMessage':
      return 'Contact'
    case 'pollCreationMessage':
    case 'pollCreationMessageV3':
      return 'Poll'
    case 'reactionMessage':
      return 'Reaction'
    case 'buttonsResponseMessage':
    case 'listResponseMessage':
    case 'templateButtonReplyMessage':
      return 'Interactive reply'
    case 'extendedTextMessage':
      return 'Text / link'
    default:
      return message.contentType ? message.contentType.replace(/Message$/, '') : 'Mesej'
  }
}

function renderDeletedMessageDetails(message: DeletedMessage) {
  const details = message.details
  if (details?.location) {
    const { latitude, longitude, name, address } = details.location
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
    return (
      <div className="mt-3 rounded-xl border border-sky-200/70 bg-sky-50/70 p-3 dark:border-sky-800/60 dark:bg-sky-950/20">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="min-w-0 text-sm">
            <p className="font-medium">{name || 'Lokasi dikongsi'}</p>
            {address ? <p className="mt-0.5 text-xs text-muted-foreground">{address}</p> : null}
            <p className="mt-1 text-[11px] text-muted-foreground">{latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <MapPin className="size-3.5" /> Buka dalam Maps
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (details?.contact) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-violet-200/70 bg-violet-50/70 p-3 dark:border-violet-800/60 dark:bg-violet-950/20">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
          <ContactRound className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
          <p className="truncate text-sm font-medium">{details.contact.displayName}</p>
        </div>
      </div>
    )
  }

  if (details?.poll) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
        <div className="flex items-start gap-2">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Poll</p>
            <p className="text-sm font-medium">{details.poll.name}</p>
            {details.poll.options.length ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {details.poll.options.map((option, index) => <li key={`${option}-${index}`} className="rounded-md bg-background/70 px-2 py-1">{option}</li>)}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (details?.reaction) {
    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-pink-200/70 bg-pink-50/70 px-3 py-2 text-sm dark:border-pink-800/60 dark:bg-pink-950/20">
        <Smile className="size-4 text-pink-600 dark:text-pink-400" />
        <span>{details.reaction.text || 'Reaction'}</span>
      </div>
    )
  }

  return null
}

function renderDeletedMedia(message: DeletedMessage, url: string | null) {
  if (!url) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Image className="size-4" />
        {getDeletedMediaLabel(message)}
      </p>
    )
  }

  if (message.mediaType === 'image' || message.mediaType === 'sticker') {
    return <img src={url} alt={getDeletedMediaLabel(message)} className="mt-3 max-h-80 rounded-md border" />
  }

  if (message.mediaType === 'video') {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border bg-black/5">
        <video controls autoPlay={message.isGif} loop={message.isGif} muted={message.isGif} playsInline src={url} className="max-h-80 w-full object-contain" />
        {message.isGif ? <p className="flex items-center gap-1.5 border-t px-3 py-2 text-[11px] text-muted-foreground"><Video className="size-3.5" /> GIF</p> : null}
      </div>
    )
  }

  if (message.mediaType === 'audio') {
    return (
      <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-background/60 p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {message.isVoiceNote ? <Mic className="size-4 text-primary" /> : <Music2 className="size-4 text-primary" />}
          <span>{getDeletedMediaLabel(message)}</span>
        </div>
        <audio controls src={url} className="w-full" />
      </div>
    )
  }

  const fileName = (message.fileName || '').toLowerCase()
  const mimeType = (message.mimetype || '').toLowerCase()
  const isPdf = mimeType.includes('pdf') || fileName.endsWith('.pdf')
  const isTextLike = mimeType.startsWith('text/') || ['.txt', '.md', '.csv', '.json'].some((ext) => fileName.endsWith(ext))
  return (
    <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-background/60 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="size-4 text-primary" />
        <span>{getDeletedMediaLabel(message)}{isPdf ? ' · PDF' : isTextLike ? ' · Text' : ''}</span>
      </div>
      <a href={url} download={message.fileName || 'whatsapp-media'} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
        <Download className="size-4" />
        Muat turun fail
      </a>
    </div>
  )
}

function DeletedMessages() {
  const token = useDashboardToken()
  const [messages, setMessages] = useState<DeletedMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [botStatus, setBotStatus] = useState<string>('unknown')
  const [filter, setFilter] = useState<'deleted' | 'edited' | 'status'>('deleted')
  const [actioning, setActioning] = useState<string | null>(null)
  const [selectedChat, setSelectedChat] = useState<{ chatJid: string; title: string; messages: DeletedMessage[] } | null>(null)

  const loadMessages = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true)
      const response = await fetch(token ? `/api/bot/deleted-messages?token=${encodeURIComponent(token)}` : '/api/bot/deleted-messages', { headers: token ? { 'x-bot-dashboard-token': token } : undefined })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Gagal ambil rekod mesej')
      setMessages(Array.isArray(payload.data) ? payload.data : [])
      setBotStatus(payload?.bot?.status || 'unknown')
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Gagal ambil rekod mesej')
    } finally {
      setLoading(false)
    }
  }, [token])

  const deleteChatMessages = useCallback(async (chatJid: string) => {
    if (!chatJid) return
    const confirmed = window.confirm('Padam semua rekod mesej yang dipadam untuk chat ini?')
    if (!confirmed) return

    try {
      setActioning(chatJid)
      const response = await fetch(token ? `/api/bot/deleted-messages/chat/${encodeURIComponent(chatJid)}?token=${encodeURIComponent(token)}` : `/api/bot/deleted-messages/chat/${encodeURIComponent(chatJid)}`, {
        method: 'DELETE',
        headers: token ? { 'x-bot-dashboard-token': token } : undefined,
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Gagal padam rekod chat')
      setMessages(payload.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Gagal padam rekod chat')
    } finally {
      setActioning(null)
    }
  }, [token])

  const clearAllMessages = useCallback(async () => {
    const confirmed = window.confirm('Padam semua rekod mesej yang dipadam?')
    if (!confirmed) return

    try {
      setActioning('all')
      const response = await fetch(token ? `/api/bot/deleted-messages?token=${encodeURIComponent(token)}` : '/api/bot/deleted-messages', {
        method: 'DELETE',
        headers: token ? { 'x-bot-dashboard-token': token } : undefined,
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Gagal padam semua rekod')
      setMessages(payload.data)
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Gagal padam semua rekod')
    } finally {
      setActioning(null)
    }
  }, [token])

  useEffect(() => {
    void loadMessages(true)
    const timer = window.setInterval(() => { void loadMessages(false) }, 3000)
    return () => window.clearInterval(timer)
  }, [loadMessages])

  const mediaUrl = (message: DeletedMessage) => getDeletedMediaPreviewUrl(message, token)
  const filteredMessages = useMemo(
    () => messages.filter((message) => message.eventType === filter),
    [filter, messages],
  )
  const groupedMessages = useMemo(() => {
    const grouped = new Map<string, DeletedMessage[]>()
    for (const message of filteredMessages) {
      const key = message.chatJid || 'unknown'
      const list = grouped.get(key) ?? []
      list.push(message)
      grouped.set(key, list)
    }

    return Array.from(grouped.entries())
      .map(([chatJid, chatMessages]) => {
        const sorted = [...chatMessages].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
        const newest = sorted[sorted.length - 1]
        const title = newest?.chatName || newest?.senderName || chatJid
        const previewText = newest?.currentText || newest?.originalText || (newest?.mediaType ? `[${newest.mediaType}]` : '[Kandungan tidak sempat ditangkap]')
        return { chatJid, title, previewText, messages: sorted }
      })
      .sort((a, b) => new Date(b.messages[b.messages.length - 1].changedAt).getTime() - new Date(a.messages[a.messages.length - 1].changedAt).getTime())
  }, [filteredMessages])

  const openChat = (chatJid: string) => {
    const chat = groupedMessages.find((entry) => entry.chatJid === chatJid)
    if (!chat) return
    setSelectedChat({ chatJid: chat.chatJid, title: chat.title, messages: chat.messages })
  }

  const getInitials = (value: string) => {
    const cleaned = value.replace(/[@.]/g, ' ').trim()
    const parts = cleaned.split(/\s+/).filter(Boolean).slice(0, 2)
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
  }

  return (
    <div className="space-y-4">
      {botStatus !== 'connected' ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
          Bot belum disambungkan. Buka halaman Account dan lengkapkan QR atau pairing code. Hanya mesej yang diterima selepas bot tersambung boleh dipulihkan.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          Bot tersambung dan sedang menangkap mesej baharu untuk personal, group, dan Status.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {([
            ['deleted', 'Dipadam'],
            ['edited', 'Diedit'],
            ['status', 'Status'],
          ] as const).map(([value, label]) => {
            const count = messages.filter((message) => message.eventType === value).length
            return (
              <button key={value} type="button" onClick={() => { setFilter(value); setSelectedChat(null) }} className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {label} ({count})
              </button>
            )
          })}
        </div>
        <Button type="button" variant="destructive" size="sm" onClick={() => void clearAllMessages()} disabled={actioning !== null}>
          {actioning === 'all' ? 'Memadam...' : 'Padam semua rekod'}
        </Button>
      </div>

      {loading ? <div className="rounded-lg border border-border/70 bg-card p-5 text-sm text-muted-foreground">Memuatkan rekod...</div> : null}
      {error ? <div className="rounded-lg border border-destructive/40 bg-card p-5 text-sm text-destructive">{error}</div> : null}
      {!loading && !error && !filteredMessages.length ? (
        <div className="rounded-lg border border-border/70 bg-card p-5 text-sm text-muted-foreground">
          Tiada rekod {filter === 'deleted' ? 'mesej dipadam' : filter === 'edited' ? 'mesej diedit' : 'Status'} buat masa ini.
        </div>
      ) : null}

      {!loading && !error && filteredMessages.length ? <div className="space-y-3">
        {groupedMessages.map(({ chatJid, title, previewText, messages: chatMessages }) => (
          <article key={chatJid} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-colors hover:bg-accent/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(title)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{title}</p>
                  <p className="text-[11px] text-muted-foreground">{chatMessages.length} rekod · {chatMessages[0]?.chatType}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => openChat(chatJid)}>
                  View
                </Button>
                <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => void deleteChatMessages(chatJid)} disabled={actioning !== null}>
                  {actioning === chatJid ? 'Memadam...' : 'Padam rekod'}
                </Button>
              </div>
            </div>

            <p className="mt-3 truncate text-xs text-muted-foreground">
              {previewText.length > 90 ? `${previewText.slice(0, 90)}...` : previewText}
            </p>
          </article>
        ))}
      </div> : null}

      <Dialog open={Boolean(selectedChat)} onOpenChange={(open) => { if (!open) setSelectedChat(null) }}>
        <DialogContent className="max-w-3xl p-0">
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{selectedChat?.title ?? 'Rekod WhatsApp'}</p>
                <p className="text-[11px] text-muted-foreground">Kandungan yang sempat ditangkap sebelum perubahan</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedChat(null)}>Tutup</Button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto bg-muted/20 p-4">
              {selectedChat?.messages.map((message) => {
                const url = mediaUrl(message)
                const isOwn = message.fromMe

                  return (
                    <div key={message.eventId || `${message.chatJid}-${message.id}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl border p-3 shadow-sm ${isOwn ? 'border-primary/20 bg-primary/10 text-primary-foreground' : 'border-border bg-background text-foreground'}`}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                        <span>{message.senderName || message.senderJid || 'Pengirim tidak dikenali'} {isOwn ? '(akaun sendiri)' : ''}</span>
                        <div className="flex items-center gap-2">
                          <span>{formatDate(message.changedAt)}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5">{message.eventType === 'deleted' ? 'Dipadam' : message.eventType === 'edited' ? 'Diedit' : 'Status'}</span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${message.contentRecovered ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                            {message.contentRecovered ? 'Recovered' : 'Fallback'}
                          </span>
                        </div>
                      </div>

                      {message.eventType === 'edited' ? (
                        <div className="space-y-2">
                          <div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Asal</p><p className="whitespace-pre-wrap text-sm">{message.originalText || '[Tidak sempat ditangkap]'}</p></div>
                          <div className="border-t pt-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Terkini</p><p className="whitespace-pre-wrap text-sm">{message.currentText || '[Kosong]'}</p></div>
                        </div>
                      ) : message.originalText ? <p className="whitespace-pre-wrap text-sm">{message.originalText}</p> : <p className="text-sm italic text-muted-foreground">Kandungan asal tidak sempat ditangkap.</p>}
                      {renderDeletedMedia(message, url)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


type ContactCategory = "Customer" | "Supplier" | "Support" | "Other"

type ContactRecord = {
  id: string
  name: string
  phone: string
  category: ContactCategory
  note?: string
  avatar?: string | null
}

const CONTACT_STORAGE_KEY = "whatsapp_contact_list_v1"
const CONTACT_SYNC_ENDPOINT = "/api/bot/contacts"

const defaultContacts: ContactRecord[] = [
  { id: "c1", name: "Aisyah Rahman", phone: "+60123456789", category: "Customer", note: "Follow up on order status" },
  { id: "c2", name: "Syarikat Maju", phone: "+60182345678", category: "Supplier", note: "Main supplier for packaging" },
  { id: "c3", name: "Support Desk", phone: "+60388888888", category: "Support", note: "For technical issues" },
]

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'C'
}

type ContactManagerProps = {
  initialContacts?: ContactRecord[]
}

export function ContactManager({ initialContacts }: ContactManagerProps = {}) {
  const [contacts, setContacts] = useState<ContactRecord[]>(() => {
    if (initialContacts !== undefined) return initialContacts

    if (typeof window === "undefined") return defaultContacts
    try {
      const saved = window.localStorage.getItem(CONTACT_STORAGE_KEY)
      if (saved === null) return defaultContacts
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return defaultContacts
      return parsed as ContactRecord[]
    } catch {
      return defaultContacts
    }
  })
  const [search, setSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ContactRecord | null>(null)
  const [form, setForm] = useState({ name: "", phone: "", category: "Other" as ContactCategory, note: "", avatar: "" as string | null })
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let ignore = false

    async function loadRemoteContacts() {
      try {
        const response = await fetch(CONTACT_SYNC_ENDPOINT)
        if (!response.ok) return
        const payload = await response.json()
        const nextContacts = Array.isArray(payload?.data) ? payload.data as ContactRecord[] : null
        if (!ignore && nextContacts && nextContacts.length > 0) {
          setContacts(nextContacts)
          window.localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(nextContacts))
        }
      } catch {
        // Ignore remote sync failures and keep local data.
      } finally {
        if (!ignore) setHasLoadedRemote(true)
      }
    }

    void loadRemoteContacts()
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    if (!hasLoadedRemote || typeof window === "undefined") return

    try {
      window.localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(contacts))
    } catch {
      // localStorage may be unavailable in some environments.
    }

    void fetch(CONTACT_SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contacts),
    }).catch(() => {
      // Ignore sync failures; the bot will continue reading the last stored copy.
    })
  }, [contacts, hasLoadedRemote])

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return contacts
    return contacts.filter((contact) => {
      const haystack = `${contact.name} ${contact.phone} ${contact.category} ${contact.note ?? ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [contacts, search])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm({ name: "", phone: "", category: "Other", note: "", avatar: null })
    setError(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (contact: ContactRecord) => {
    setEditingId(contact.id)
    setForm({
      name: contact.name,
      phone: contact.phone,
      category: contact.category,
      note: contact.note ?? "",
      avatar: contact.avatar ?? null,
    })
    setError(null)
    setIsDialogOpen(true)
  }

  const handleAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar image must be smaller than 2MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setForm((previous) => ({ ...previous, avatar: typeof reader.result === "string" ? reader.result : null }))
      setError(null)
    }
    reader.readAsDataURL(file)

    if (avatarInputRef.current) avatarInputRef.current.value = ""
  }

  const handleSaveContact = () => {
    const normalizedName = form.name.trim()
    const normalizedPhone = form.phone.trim()

    if (!normalizedName) {
      setError("Please enter a contact name.")
      return
    }

    if (!normalizedPhone) {
      setError("Please enter a phone number.")
      return
    }

    const duplicate = contacts.some((contact) => {
      if (editingId && contact.id === editingId) return false
      return contact.phone.replace(/\s+/g, "").toLowerCase() === normalizedPhone.replace(/\s+/g, "").toLowerCase()
    })

    if (duplicate) {
      setError("This phone number already exists in your contact list.")
      return
    }

    if (editingId) {
      setContacts((previous) => previous.map((contact) => contact.id === editingId ? {
        ...contact,
        name: normalizedName,
        phone: normalizedPhone,
        category: form.category,
        note: form.note.trim(),
        avatar: form.avatar ?? null,
      } : contact))
    } else {
      const newContact: ContactRecord = {
        id: crypto.randomUUID?.() ?? `contact-${Date.now()}`,
        name: normalizedName,
        phone: normalizedPhone,
        category: form.category,
        note: form.note.trim(),
        avatar: form.avatar ?? null,
      }
      setContacts((previous) => [newContact, ...previous])
    }

    setIsDialogOpen(false)
    setEditingId(null)
    setForm({ name: "", phone: "", category: "Other", note: "", avatar: null })
    setError(null)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    setContacts((previous) => previous.filter((contact) => contact.id !== pendingDelete.id))
    setPendingDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ContactRound className="size-4 text-emerald-500" />
            <span>Saved contacts</span>
          </div>
          <Button type="button" size="sm" onClick={openCreateDialog} className="gap-2">
            <Plus className="size-4" /> Add Contact
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone or category"
            className="w-full border-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
        </div>
      </div>

      {filteredContacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/80 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-5 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No contacts found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try another keyword or add a new contact.</p>
          <Button
            type="button"
            size="sm"
            onClick={openCreateDialog}
            className="mt-4 gap-2"
            data-testid="empty-add-contact-button"
          >
            <Plus className="size-4" /> Add Contact
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredContacts.map((contact) => (
            <article key={contact.id} className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition-colors hover:border-primary/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {contact.avatar ? (
                    <img src={contact.avatar} alt={contact.name} className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-background shadow-sm" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-sm font-bold text-white shadow-sm">
                      {getInitials(contact.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{contact.name}</p>
                    <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {contact.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(contact)} aria-label={`Edit ${contact.name}`}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setPendingDelete(contact)} aria-label={`Delete ${contact.name}`}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Smartphone className="size-3.5" />
                  <span className="truncate">{contact.phone}</span>
                </div>
                {contact.note ? (
                  <p className="text-xs leading-5 text-muted-foreground">{contact.note}</p>
                ) : (
                  <p className="text-xs italic text-muted-foreground/80">No note added</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) {
          setEditingId(null)
          setForm({ name: "", phone: "", category: "Other", note: "", avatar: null })
          setError(null)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit contact" : "Add contact"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the selected contact information." : "Add a new WhatsApp contact to your list."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                  {form.avatar ? (
                    <img src={form.avatar} alt="Contact preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">{getInitials(form.name || "Contact")}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}>Upload</Button>
                  {form.avatar ? (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setForm((previous) => ({ ...previous, avatar: null }))}>Remove</Button>
                  ) : null}
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="e.g. Ali Ahmad" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone number</Label>
              <Input id="contact-phone" value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} placeholder="e.g. +60123456789" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-category">Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm((previous) => ({ ...previous, category: value as ContactCategory }))}>
                <SelectTrigger id="contact-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Customer">Customer</SelectItem>
                  <SelectItem value="Supplier">Supplier</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-note">Note</Label>
              <Textarea id="contact-note" value={form.note} onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Optional note" className="min-h-24" />
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSaveContact}>{editingId ? "Save changes" : "Add contact"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <AlertDialogContentRoot>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `This action will permanently remove ${pendingDelete.name} from your contact list.` : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentRoot>
      </AlertDialog>
    </div>
  )
}


