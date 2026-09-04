import path from "node:path";
import {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  getContentType,
  makeWASocket,
  normalizeMessageContent,
  proto,
  useMultiFileAuthState,
  type WAMessage,
  type WAMessageContent,
} from "@whiskeysockets/baileys";
import { botState } from "./bot-state.js";
import { logger } from "./logger.js";
import {
  whatsappMessageStore,
  type CapturedChatType,
  type CapturedMessageDetails,
  type OriginalMessageSnapshot,
} from "./whatsapp-message-store.js";
import {
  messageText,
  normalizeBaileysMessageUpdate,
} from "./whatsapp-event-normalizer.js";

type WhatsAppSocket = ReturnType<typeof makeWASocket>;
type PairingMethod = "qr" | "phone";

const authDirectory =
  process.env.WHATSAPP_AUTH_DIR ??
  path.resolve(process.cwd(), ".data", "whatsapp-auth");

let socket: WhatsAppSocket | null = null;
let socketPairingMethod: PairingMethod | null = null;
let startPromise: Promise<WhatsAppSocket> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let intentionalSocketClose = false;
const groupNames = new Map<string, string>();
const MAX_CAPTURED_MEDIA_BYTES = 15 * 1024 * 1024;

function updateBotState(
  patch: Partial<typeof botState>,
): void {
  Object.assign(botState, patch, {
    updatedAt: new Date().toISOString(),
  });
}

function disconnectStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    output?: { statusCode?: number };
    statusCode?: number;
  };
  return candidate.output?.statusCode ?? candidate.statusCode;
}

function formatBaileysError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown WhatsApp connection error";
}

function connectedPhoneNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.split(":")[0]?.split("@")[0] ?? null;
}

function timestampIso(value: unknown): string {
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  if (typeof value === "string" && /^\d+$/.test(value)) return new Date(Number(value) * 1000).toISOString();
  if (value && typeof value === "object" && "toNumber" in value) {
    return new Date((value as { toNumber(): number }).toNumber() * 1000).toISOString();
  }
  return new Date().toISOString();
}

function extractText(content: WAMessageContent | null | undefined): string {
  return messageText(content);
}

function mediaDetails(content: WAMessageContent | null | undefined) {
  const message = normalizeMessageContent(content) as Record<string, any> | undefined;
  if (!message) return null;
  const types = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"] as const;
  const type = types.find((candidate) => message[candidate]);
  if (!type) return null;
  const media = message[type];
  return {
    mediaType: type.replace("Message", ""),
    mimetype: typeof media.mimetype === "string" ? media.mimetype : null,
    fileName: typeof media.fileName === "string" ? media.fileName : null,
    isVoiceNote: type === "audioMessage" && media.ptt === true,
    isGif: type === "videoMessage" && media.gifPlayback === true,
  };
}

function messageDetails(content: WAMessageContent | null | undefined): {
  contentType: string | null;
  details: CapturedMessageDetails | null;
} {
  const message = normalizeMessageContent(content) as Record<string, any> | undefined;
  if (!message) return { contentType: null, details: null };

  const contentType = getContentType(message as WAMessageContent) ?? null;
  const location = message.locationMessage ?? message.liveLocationMessage;
  if (
    location &&
    typeof location.degreesLatitude === "number" &&
    typeof location.degreesLongitude === "number"
  ) {
    return {
      contentType,
      details: {
        location: {
          latitude: location.degreesLatitude,
          longitude: location.degreesLongitude,
          ...(typeof location.name === "string" ? { name: location.name } : {}),
          ...(typeof location.address === "string" ? { address: location.address } : {}),
        },
      },
    };
  }

  const contact = message.contactMessage;
  if (contact && typeof contact.displayName === "string") {
    return {
      contentType,
      details: { contact: { displayName: contact.displayName } },
    };
  }

  const contacts = message.contactsArrayMessage;
  if (contacts && typeof contacts.displayName === "string") {
    return {
      contentType,
      details: { contact: { displayName: contacts.displayName } },
    };
  }

  const poll = message.pollCreationMessage;
  if (poll && typeof poll.name === "string") {
    const options = Array.isArray(poll.options)
      ? poll.options
          .map((option: unknown) =>
            typeof option === "string"
              ? option
              : option && typeof option === "object" && "optionName" in option
                ? String((option as { optionName: unknown }).optionName)
                : "",
          )
          .filter(Boolean)
      : [];
    return {
      contentType,
      details: { poll: { name: poll.name, options } },
    };
  }

  const reaction = message.reactionMessage;
  if (reaction && typeof reaction.text === "string") {
    return {
      contentType,
      details: { reaction: { text: reaction.text } },
    };
  }

  return { contentType, details: null };
}

function extensionForMedia(mimetype: string | null, mediaType: string): string {
  const subtype = mimetype?.split("/")[1]?.split(";")[0]?.split("+")[0];
  if (subtype && /^[a-z0-9]+$/i.test(subtype)) return subtype;
  return mediaType === "image" ? "jpg" : mediaType === "video" ? "mp4" : mediaType === "audio" ? "ogg" : "bin";
}

async function downloadBoundedMedia(socket: WhatsAppSocket, message: WAMessage): Promise<Buffer> {
  const stream = await downloadMediaMessage(message, "stream", {}, {
    logger: logger.child({ module: "baileys-media" }, { level: "warn" }),
    reuploadRequest: socket.updateMediaMessage,
  });
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_CAPTURED_MEDIA_BYTES) {
      stream.destroy(new Error("Captured WhatsApp media exceeds 15MB"));
      throw new Error("Captured WhatsApp media exceeds 15MB");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

async function chatNameFor(socket: WhatsAppSocket, chatJid: string, message: WAMessage): Promise<string> {
  if (chatJid === "status@broadcast") return "WhatsApp Status";
  if (!chatJid.endsWith("@g.us")) return message.pushName || connectedPhoneNumber(chatJid) || chatJid;
  const cached = groupNames.get(chatJid);
  if (cached) return cached;
  try {
    const metadata = await socket.groupMetadata(chatJid);
    const name = metadata.subject || chatJid;
    groupNames.set(chatJid, name);
    return name;
  } catch {
    return chatJid;
  }
}

async function captureIncomingMessage(socket: WhatsAppSocket, message: WAMessage): Promise<void> {
  const chatJid = message.key.remoteJid;
  const id = message.key.id;
  if (!chatJid || !id || !message.message) return;
  const normalized = normalizeMessageContent(message.message);
  const protocol = normalized?.protocolMessage;
  if (protocol) {
    const targetChat = protocol.key?.remoteJid || chatJid;
    const targetId = protocol.key?.id;
    if (!targetId) return;
    const changedAt = timestampIso(message.messageTimestamp);
    if (protocol.type === proto.Message.ProtocolMessage.Type.REVOKE) {
      whatsappMessageStore.recordDeletion(targetChat, targetId, changedAt);
    } else if (protocol.type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT) {
      whatsappMessageStore.recordEdit(targetChat, targetId, extractText(protocol.editedMessage), changedAt);
    }
    return;
  }

  const chatType: CapturedChatType =
    chatJid === "status@broadcast" ? "status" : chatJid.endsWith("@g.us") ? "group" : "personal";
  const senderJid = message.key.participant || (message.key.fromMe ? socket.user?.id : chatJid) || "";
  const media = mediaDetails(message.message);
  const content = messageDetails(message.message);
  const snapshot: OriginalMessageSnapshot = {
    id,
    chatJid,
    chatName: chatJid === "status@broadcast"
      ? "WhatsApp Status"
      : message.pushName || connectedPhoneNumber(chatJid) || chatJid,
    chatType,
    senderJid,
    senderName: message.pushName || connectedPhoneNumber(senderJid) || senderJid,
    fromMe: Boolean(message.key.fromMe),
    timestamp: timestampIso(message.messageTimestamp),
    text: extractText(message.message),
    mediaType: media?.mediaType ?? null,
    fileName: media?.fileName ?? null,
    mimetype: media?.mimetype ?? null,
    mediaPath: null,
    contentType: content.contentType,
    isVoiceNote: media?.isVoiceNote ?? false,
    isGif: media?.isGif ?? false,
    details: content.details,
  };
  const isNewSnapshot = whatsappMessageStore.capture(snapshot);
  if (!isNewSnapshot) return;

  const enrichment: Partial<Pick<OriginalMessageSnapshot, "chatName" | "mediaPath">> = {};
  if (chatType === "group") {
    enrichment.chatName = await chatNameFor(socket, chatJid, message);
  }
  let mediaPath: string | null = null;
  if (media) {
    try {
      const buffer = await downloadBoundedMedia(socket, message);
      mediaPath = whatsappMessageStore.saveMedia(
        buffer,
        extensionForMedia(media.mimetype, media.mediaType),
      );
    } catch (error) {
      logger.warn({ err: error, chatJid, messageId: id }, "Unable to capture WhatsApp media");
    }
  }
  if (mediaPath) enrichment.mediaPath = mediaPath;
  if (Object.keys(enrichment).length) {
    whatsappMessageStore.enrichSnapshot(chatJid, id, enrichment);
  }
}

function attachMessageCapture(socket: WhatsAppSocket): void {
  socket.ev.on("messages.upsert", ({ messages }) => {
    for (const message of messages) {
      void captureIncomingMessage(socket, message).catch((error) => {
        logger.error({ err: error }, "WhatsApp message capture failed");
      });
    }
  });
  socket.ev.on("messages.update", (updates) => {
    for (const { key, update } of updates) {
      const mutation = normalizeBaileysMessageUpdate(key, update);
      if (mutation?.eventType === "deleted") {
        whatsappMessageStore.recordDeletion(
          mutation.chatJid,
          mutation.id,
          timestampIso(update.messageTimestamp),
        );
        continue;
      }
      if (mutation?.eventType === "edited") {
        whatsappMessageStore.recordEdit(
          mutation.chatJid,
          mutation.id,
          mutation.currentText,
          timestampIso(update.messageTimestamp),
        );
        continue;
      }
      if (!update.message) continue;
      void captureIncomingMessage(socket, {
        key,
        message: update.message,
        messageTimestamp: Math.floor(Date.now() / 1000),
      } as WAMessage).catch((error) => {
        logger.error({ err: error }, "WhatsApp message update capture failed");
      });
    }
  });
  socket.ev.on("messages.delete", (deletion) => {
    const keys = "keys" in deletion ? deletion.keys : [];
    for (const key of keys) {
      if (key.remoteJid && key.id) {
        whatsappMessageStore.recordDeletion(key.remoteJid, key.id);
      }
    }
  });
}

export function isWhatsAppBotEnabled(): boolean {
  return String(process.env.ENABLE_WHATSAPP_BOT ?? "true").toLowerCase() !== "false";
}

export function normalizePairingPhoneNumber(input: unknown): string {
  const raw = String(input ?? "").trim();
  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    throw new Error("Masukkan nombor WhatsApp bersama kod negara, contoh 60123456789.");
  }
  if (raw.startsWith("+")) {
    throw new Error("Buang simbol +. Gunakan format digit sahaja, contoh 60123456789.");
  }
  if (digits.startsWith("0")) {
    throw new Error("Gunakan kod negara tanpa 0 di hadapan, contoh 60123456789.");
  }
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Nombor WhatsApp mesti 8 hingga 15 digit termasuk kod negara.");
  }

  return digits;
}

async function closeCurrentSocket(): Promise<void> {
  if (!socket) return;
  const current = socket;
  socket = null;
  socketPairingMethod = null;
  intentionalSocketClose = true;
  try {
    await current.end(undefined);
  } catch (error) {
    logger.debug({ err: error }, "WhatsApp socket was already closed");
  } finally {
    intentionalSocketClose = false;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer || !isWhatsAppBotEnabled()) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void startWhatsAppSocket(botState.pairingMethod ?? "qr").catch((error) => {
      updateBotState({
        status: "error",
        lastError: formatBaileysError(error),
      });
      logger.error({ err: error }, "WhatsApp reconnect failed");
    });
  }, 2_000);
}

async function createWhatsAppSocket(
  pairingMethod: PairingMethod,
): Promise<WhatsAppSocket> {
  const { state, saveCreds } = await useMultiFileAuthState(authDirectory);

  updateBotState({
    enabled: true,
    status: "starting",
    pairingMethod,
    qr: null,
    pairingCode: null,
    lastError: null,
  });

  const nextSocket = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu("DBRUTALS"),
    logger: logger.child({ module: "baileys" }, { level: "warn" }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  socket = nextSocket;
  socketPairingMethod = pairingMethod;

  nextSocket.ev.on("creds.update", saveCreds);
  attachMessageCapture(nextSocket);
  nextSocket.ev.on("connection.update", (update) => {
    if (socket !== nextSocket) return;

    if (update.qr && pairingMethod === "qr") {
      updateBotState({
        status: "qr",
        qr: update.qr,
        pairingCode: null,
      });
    }

    if (update.connection === "open") {
      const number = connectedPhoneNumber(nextSocket.user?.id);
      updateBotState({
        enabled: true,
        status: "connected",
        qr: null,
        pairingCode: null,
        pairingPhoneNumber: number ?? botState.pairingPhoneNumber,
        connectedPhoneNumber: number,
        displayName: nextSocket.user?.name ?? (number ? `WhatsApp ${number}` : null),
        lastError: null,
      });
      return;
    }

    if (update.connection !== "close") return;

    socket = null;
    socketPairingMethod = null;
    const code = disconnectStatusCode(update.lastDisconnect?.error);
    const loggedOut =
      code === DisconnectReason.loggedOut ||
      code === DisconnectReason.badSession ||
      code === DisconnectReason.forbidden;

    if (intentionalSocketClose) return;

    updateBotState({
      status: loggedOut ? "logged-out" : "reconnecting",
      qr: null,
      pairingCode: null,
      connectedPhoneNumber: loggedOut ? null : botState.connectedPhoneNumber,
      lastError: update.lastDisconnect?.error
        ? formatBaileysError(update.lastDisconnect.error)
        : null,
    });

    if (!loggedOut) scheduleReconnect();
  });

  return nextSocket;
}

async function startWhatsAppSocket(
  pairingMethod: PairingMethod,
  forceNew = false,
): Promise<WhatsAppSocket> {
  if (startPromise) {
    await startPromise;
  }
  if (
    !forceNew &&
    socket &&
    socketPairingMethod === pairingMethod
  ) {
    return socket;
  }

  startPromise = (async () => {
    if (forceNew || socket) await closeCurrentSocket();
    return createWhatsAppSocket(pairingMethod);
  })();

  try {
    return await startPromise;
  } finally {
    startPromise = null;
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export async function requestPhonePairingCode(
  rawPhoneNumber: unknown,
): Promise<string> {
  if (!isWhatsAppBotEnabled()) {
    throw new Error("WhatsApp bot dinyahaktifkan oleh ENABLE_WHATSAPP_BOT=false.");
  }

  const phoneNumber = normalizePairingPhoneNumber(rawPhoneNumber);
  updateBotState({
    enabled: true,
    status: "pairing-phone",
    pairingMethod: "phone",
    pairingPhoneNumber: phoneNumber,
    connectedPhoneNumber: null,
    displayName: null,
    qr: null,
    pairingCode: null,
    lastError: null,
  });

  try {
    const nextSocket = await startWhatsAppSocket("phone", true);
    if (nextSocket.authState.creds.registered) {
      throw new Error(
        "Akaun WhatsApp sudah dipasangkan. Log keluar sesi lama sebelum memasangkan nombor lain.",
      );
    }

    await withTimeout(
      nextSocket.waitForSocketOpen(),
      20_000,
      "Tidak dapat menyambung ke WhatsApp untuk menjana pairing code. Cuba semula.",
    );
    const code = await nextSocket.requestPairingCode(phoneNumber);

    updateBotState({
      enabled: true,
      status: "pairing-code",
      pairingMethod: "phone",
      pairingPhoneNumber: phoneNumber,
      pairingCode: code,
      qr: null,
      lastError: null,
    });
    return code;
  } catch (error) {
    updateBotState({
      status: "error",
      pairingCode: null,
      lastError: formatBaileysError(error),
    });
    throw error;
  }
}

export async function startQrPairing(): Promise<void> {
  if (!isWhatsAppBotEnabled()) {
    throw new Error("WhatsApp bot dinyahaktifkan oleh ENABLE_WHATSAPP_BOT=false.");
  }
  await startWhatsAppSocket("qr", true);
}

export async function initializeWhatsAppBot(): Promise<void> {
  if (!isWhatsAppBotEnabled()) {
    updateBotState({
      enabled: false,
      status: "disabled",
      lastError: null,
    });
    return;
  }

  try {
    await startWhatsAppSocket(botState.pairingMethod ?? "qr");
  } catch (error) {
    updateBotState({
      enabled: true,
      status: "error",
      lastError: formatBaileysError(error),
    });
    logger.error({ err: error }, "WhatsApp bot initialization failed");
  }
}