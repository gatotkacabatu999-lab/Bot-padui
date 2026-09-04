import {
  normalizeMessageContent,
  WAMessageStubType,
  type WAMessageContent,
  type WAMessageKey,
} from "@whiskeysockets/baileys";

export type NormalizedWhatsAppMutation =
  | { eventType: "deleted"; chatJid: string; id: string }
  | { eventType: "edited"; chatJid: string; id: string; currentText: string };

export function messageText(content: WAMessageContent | null | undefined): string {
  const message = normalizeMessageContent(content) as Record<string, any> | undefined;
  if (!message) return "";
  const location = message.locationMessage;
  const contact = message.contactMessage;
  const contacts = message.contactsArrayMessage;
  const poll = message.pollCreationMessage;
  const reaction = message.reactionMessage;
  return String(
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    location?.name ??
    location?.address ??
    contact?.displayName ??
    contacts?.displayName ??
    poll?.name ??
    reaction?.text ??
    message.buttonsResponseMessage?.selectedDisplayText ??
    message.listResponseMessage?.title ??
    message.templateButtonReplyMessage?.selectedDisplayText ??
    "",
  );
}

export function normalizeBaileysMessageUpdate(
  key: WAMessageKey,
  update: {
    message?: WAMessageContent | null;
    messageStubType?: number | null;
  },
): NormalizedWhatsAppMutation | null {
  if (!key.remoteJid || !key.id) return null;
  if (update.messageStubType === WAMessageStubType.REVOKE) {
    return {
      eventType: "deleted",
      chatJid: key.remoteJid,
      id: key.id,
    };
  }
  const editedContent = (update.message as any)?.editedMessage?.message as WAMessageContent | undefined;
  if (editedContent) {
    return {
      eventType: "edited",
      chatJid: key.remoteJid,
      id: key.id,
      currentText: messageText(editedContent),
    };
  }
  return null;
}