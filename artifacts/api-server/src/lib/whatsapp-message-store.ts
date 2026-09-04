import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type CapturedChatType = "personal" | "group" | "status";
export type CaptureEventType = "deleted" | "edited" | "status";

export type CapturedMessageDetails = {
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contact?: {
    displayName: string;
  };
  poll?: {
    name: string;
    options: string[];
  };
  reaction?: {
    text: string;
  };
};

export interface OriginalMessageSnapshot {
  id: string;
  chatJid: string;
  chatName: string;
  chatType: CapturedChatType;
  senderJid: string;
  senderName: string;
  fromMe: boolean;
  timestamp: string;
  text: string;
  mediaType: string | null;
  fileName: string | null;
  mimetype: string | null;
  mediaPath: string | null;
  contentType?: string | null;
  isVoiceNote?: boolean;
  isGif?: boolean;
  details?: CapturedMessageDetails | null;
}

export interface CapturedMessageEvent extends OriginalMessageSnapshot {
  eventId: string;
  eventType: CaptureEventType;
  changedAt: string;
  deletedAt: string;
  originalText: string;
  currentText: string | null;
  contentRecovered: boolean;
  contentSource: "captured" | "fallback";
}

type PersistedCaptureData = {
  version: 1;
  snapshots: OriginalMessageSnapshot[];
  events: CapturedMessageEvent[];
};

const EMPTY_DATA: PersistedCaptureData = {
  version: 1,
  snapshots: [],
  events: [],
};

function messageKey(chatJid: string, id: string): string {
  return `${chatJid}\u0000${id}`;
}

function safeMediaName(value: string): string {
  return path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export class WhatsAppMessageStore {
  readonly directory: string;
  readonly mediaDirectory: string;
  readonly dataFile: string;
  private snapshots = new Map<string, OriginalMessageSnapshot>();
  private events: CapturedMessageEvent[] = [];

  constructor(directory: string) {
    this.directory = directory;
    this.mediaDirectory = path.join(directory, "media");
    this.dataFile = path.join(directory, "messages.json");
    fs.mkdirSync(this.mediaDirectory, { recursive: true });
    this.load();
  }

  private load(): void {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.dataFile, "utf8")) as Partial<PersistedCaptureData>;
      for (const snapshot of Array.isArray(parsed.snapshots) ? parsed.snapshots : []) {
        if (snapshot?.chatJid && snapshot?.id) {
          this.snapshots.set(messageKey(snapshot.chatJid, snapshot.id), snapshot);
        }
      }
      this.events = Array.isArray(parsed.events) ? parsed.events : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private persist(): void {
    fs.mkdirSync(this.directory, { recursive: true });
    const next: PersistedCaptureData = {
      version: 1,
      snapshots: [...this.snapshots.values()].slice(-10_000),
      events: this.events.slice(-5_000),
    };
    const temporary = `${this.dataFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2), "utf8");
    fs.renameSync(temporary, this.dataFile);
  }

  capture(snapshot: OriginalMessageSnapshot): boolean {
    const key = messageKey(snapshot.chatJid, snapshot.id);
    if (this.snapshots.has(key)) return false;
    this.snapshots.set(key, snapshot);
    this.reconcileEvents(snapshot);
    if (this.snapshots.size > 10_000) {
      const oldest = this.snapshots.keys().next().value;
      if (oldest) this.snapshots.delete(oldest);
    }
    if (snapshot.chatType === "status") {
      this.appendEvent("status", snapshot, snapshot.timestamp, snapshot.text);
    } else {
      this.persist();
    }
    return true;
  }

  enrichSnapshot(
    chatJid: string,
    id: string,
    patch: Partial<Pick<OriginalMessageSnapshot, "chatName" | "senderName" | "mediaType" | "fileName" | "mimetype" | "mediaPath">>,
  ): OriginalMessageSnapshot | null {
    const key = messageKey(chatJid, id);
    const existing = this.snapshots.get(key);
    if (!existing) return null;
    const enriched = { ...existing, ...patch };
    this.snapshots.set(key, enriched);
    this.reconcileEvents(enriched);
    this.persist();
    return enriched;
  }

  private reconcileEvents(snapshot: OriginalMessageSnapshot): void {
    this.events = this.events.map((event) => {
      if (event.chatJid !== snapshot.chatJid || event.id !== snapshot.id) return event;
      return {
        ...event,
        ...snapshot,
        originalText: snapshot.text,
        contentRecovered: true,
        contentSource: "captured" as const,
      };
    });
  }

  recordDeletion(chatJid: string, id: string, changedAt = new Date().toISOString()): CapturedMessageEvent {
    const snapshot = this.snapshots.get(messageKey(chatJid, id));
    const fallback = this.makeFallback(chatJid, id, changedAt);
    return this.appendEvent("deleted", snapshot ?? fallback, changedAt, null);
  }

  recordEdit(chatJid: string, id: string, currentText: string, changedAt = new Date().toISOString()): CapturedMessageEvent {
    const snapshot = this.snapshots.get(messageKey(chatJid, id));
    const fallback = this.makeFallback(chatJid, id, changedAt);
    return this.appendEvent("edited", snapshot ?? fallback, changedAt, currentText);
  }

  private makeFallback(chatJid: string, id: string, timestamp: string): OriginalMessageSnapshot {
    return {
      id,
      chatJid,
      chatName: chatJid,
      chatType: chatJid === "status@broadcast" ? "status" : chatJid.endsWith("@g.us") ? "group" : "personal",
      senderJid: "",
      senderName: "",
      fromMe: false,
      timestamp,
      text: "",
      mediaType: null,
      fileName: null,
      mimetype: null,
      mediaPath: null,
    };
  }

  private appendEvent(
    eventType: CaptureEventType,
    snapshot: OriginalMessageSnapshot,
    changedAt: string,
    currentText: string | null,
  ): CapturedMessageEvent {
    const existing = this.events.find(
      (event) =>
        event.eventType === eventType &&
        event.chatJid === snapshot.chatJid &&
        event.id === snapshot.id &&
        (eventType !== "edited" || event.currentText === currentText),
    );
    if (existing) return existing;

    const event: CapturedMessageEvent = {
      ...snapshot,
      eventId: randomUUID(),
      eventType,
      changedAt,
      deletedAt: changedAt,
      originalText: snapshot.text,
      currentText,
      contentRecovered: this.snapshots.has(messageKey(snapshot.chatJid, snapshot.id)),
      contentSource: this.snapshots.has(messageKey(snapshot.chatJid, snapshot.id)) ? "captured" : "fallback",
    };
    this.events = [...this.events, event].slice(-5_000);
    this.persist();
    return event;
  }

  listEvents(): CapturedMessageEvent[] {
    return [...this.events].sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );
  }

  clearAll(): void {
    this.events = [];
    this.snapshots.clear();
    fs.rmSync(this.mediaDirectory, { recursive: true, force: true });
    fs.mkdirSync(this.mediaDirectory, { recursive: true });
    this.persist();
  }

  removeByChatId(chatJid: string): number {
    const before = this.events.length;
    const removedPaths = new Set<string>();
    for (const event of this.events) {
      if (event.chatJid === chatJid && event.mediaPath) removedPaths.add(event.mediaPath);
    }
    this.events = this.events.filter((event) => event.chatJid !== chatJid);
    for (const [key, snapshot] of this.snapshots) {
      if (snapshot.chatJid === chatJid) {
        if (snapshot.mediaPath) removedPaths.add(snapshot.mediaPath);
        this.snapshots.delete(key);
      }
    }
    for (const mediaPath of removedPaths) {
      fs.rmSync(this.resolveMediaPath(mediaPath), { force: true });
    }
    this.persist();
    return before - this.events.length;
  }

  saveMedia(data: Buffer, extension: string): string {
    const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
    const fileName = `${randomUUID()}.${safeExtension}`;
    fs.writeFileSync(path.join(this.mediaDirectory, fileName), data);
    return fileName;
  }

  resolveMediaPath(mediaPath: string): string {
    return path.join(this.mediaDirectory, safeMediaName(mediaPath));
  }

  mediaExists(mediaPath: string): boolean {
    return fs.existsSync(this.resolveMediaPath(mediaPath));
  }

  mediaMetadata(mediaPath: string): Pick<CapturedMessageEvent, "mediaType" | "mimetype" | "fileName"> | null {
    const event = this.events.find((candidate) => candidate.mediaPath === safeMediaName(mediaPath));
    if (!event) return null;
    return {
      mediaType: event.mediaType,
      mimetype: event.mimetype,
      fileName: event.fileName,
    };
  }
}

const captureDirectory =
  process.env.WHATSAPP_CAPTURE_DIR ??
  path.resolve(process.cwd(), ".data", "whatsapp-capture");

export const whatsappMessageStore = new WhatsAppMessageStore(captureDirectory);