/**
 * In-memory bot state, contacts, reminders, and behavior settings.
 *
 * The actual WhatsApp bot (Baileys) is a separate service (Task #4).
 * These in-memory stores let the UI display properly and accept pairing
 * selections now. State resets on server restart until the bot is connected.
 */

import { randomUUID } from 'node:crypto';

// ── Bot runtime state ─────────────────────────────────────────────────────────

export type BotStatus =
  | 'disabled'
  | 'starting'
  | 'qr'
  | 'pairing-phone'
  | 'pairing-code'
  | 'connected'
  | 'closed'
  | 'reconnecting'
  | 'logged-out'
  | 'error';

export interface BotRuntimeState {
  enabled: boolean;
  status: BotStatus;
  qr: string | null;
  pairingMethod: 'qr' | 'phone' | null;
  pairingPhoneNumber: string | null;
  connectedPhoneNumber: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  pairingCode: string | null;
  updatedAt: string | null;
  lastError: string | null;
}

export const botState: BotRuntimeState = {
  enabled: false,
  status: 'disabled',
  qr: null,
  pairingMethod: null,
  pairingPhoneNumber: null,
  connectedPhoneNumber: null,
  displayName: null,
  profileImageUrl: null,
  pairingCode: null,
  updatedAt: null,
  lastError: null,
};

export function buildBotStatusResponse() {
  return {
    success: true,
    data: {
      ...botState,
      qr: botState.status === 'qr' ? botState.qr : null,
      pairingCode: botState.status === 'pairing-code' ? botState.pairingCode : null,
    },
  };
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export type BotContact = Record<string, unknown>;

let contacts: BotContact[] = [];

export function readBotContacts(): BotContact[] {
  return contacts;
}

export function saveBotContacts(nextContacts: BotContact[]): BotContact[] {
  contacts = Array.isArray(nextContacts) ? nextContacts : [];
  return contacts;
}

// ── Message behavior settings ─────────────────────────────────────────────────

export interface MessageBehaviorSettings {
  respondInGroup: boolean;
  respondInPrivate: boolean;
  respondForAnyone: boolean;
  respondOnlySelectedGroups: boolean;
  allowedNumbers: string[];
  allowedGroups: string[];
  autoRespondUnknownCommand: boolean;
  unknownCommandInPrivate: string;
  unknownCommandInGroup: string;
}

let messageBehavior: MessageBehaviorSettings = {
  respondInGroup: false,
  respondInPrivate: true,
  respondForAnyone: false,
  respondOnlySelectedGroups: false,
  allowedNumbers: [],
  allowedGroups: [],
  autoRespondUnknownCommand: false,
  unknownCommandInPrivate: '',
  unknownCommandInGroup: '',
};

export function getBotMessageBehaviorSettings(): MessageBehaviorSettings {
  return { ...messageBehavior };
}

export function setBotMessageBehaviorSettings(
  patch: Partial<MessageBehaviorSettings>,
): MessageBehaviorSettings {
  messageBehavior = {
    ...messageBehavior,
    ...(patch && typeof patch === 'object' ? patch : {}),
  };
  return { ...messageBehavior };
}

// ── Reminders ─────────────────────────────────────────────────────────────────

export interface BotReminder {
  id: string;
  name: string;
  date: string | null;
  time: string | null;
  earlyDays: number | null;
  targetChats: string[];
  createdAt: string;
  updatedAt: string;
}

let reminders: BotReminder[] = [];

export function getBotReminders(): BotReminder[] {
  return reminders;
}

export function createBotReminder(
  payload: Partial<BotReminder>,
): BotReminder | null {
  if (!payload?.name) return null;
  const now = new Date().toISOString();
  const reminder: BotReminder = {
    id: randomUUID(),
    name: String(payload.name),
    date: payload.date ? String(payload.date) : null,
    time: payload.time ? String(payload.time) : null,
    earlyDays: typeof payload.earlyDays === 'number' ? payload.earlyDays : null,
    targetChats: Array.isArray(payload.targetChats) ? payload.targetChats : [],
    createdAt: now,
    updatedAt: now,
  };
  reminders = [...reminders, reminder];
  return reminder;
}

export function updateBotReminder(
  id: string,
  payload: Partial<BotReminder>,
): BotReminder | null {
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated: BotReminder = {
    ...reminders[idx],
    ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
    ...(payload.date !== undefined ? { date: payload.date ? String(payload.date) : null } : {}),
    ...(payload.time !== undefined ? { time: payload.time ? String(payload.time) : null } : {}),
    ...(payload.earlyDays !== undefined ? { earlyDays: typeof payload.earlyDays === 'number' ? payload.earlyDays : null } : {}),
    ...(Array.isArray(payload.targetChats) ? { targetChats: payload.targetChats } : {}),
    updatedAt: new Date().toISOString(),
  };
  reminders = [...reminders.slice(0, idx), updated, ...reminders.slice(idx + 1)];
  return updated;
}

export function deleteBotReminder(id: string): boolean {
  const before = reminders.length;
  reminders = reminders.filter((r) => r.id !== id);
  return reminders.length < before;
}

