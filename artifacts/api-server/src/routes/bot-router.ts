/**
 * Bot route handlers — mirrors the /bot/* and /api/bot* endpoints from the
 * original server/index.ts. The Baileys WhatsApp connection lives in Task #4;
 * these handlers manage in-memory state so the dashboard UI works now.
 *
 * Mount twice:
 *   app.use('/bot', botRootRouter)        → /bot/status, /bot/settings, …
 *   router.use('/bot', botApiRouter)       → /api/bot/pairing, /api/bot/messages, …
 *   router.get('/bot-status', …)          → /api/bot-status
 *   router.all('/bot-settings', …)        → /api/bot-settings
 *   router.all('/bot-reminders/:id?', …)  → /api/bot-reminders
 */

import { Router, type Request, type Response } from 'express';
import {
  botState,
  buildBotStatusResponse,
  readBotContacts,
  saveBotContacts,
  getBotMessageBehaviorSettings,
  setBotMessageBehaviorSettings,
  getBotReminders,
  createBotReminder,
  updateBotReminder,
  deleteBotReminder,
} from '../lib/bot-state.js';
import {
  requestPhonePairingCode,
  startQrPairing,
} from '../lib/whatsapp-service.js';
import { whatsappMessageStore } from '../lib/whatsapp-message-store.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseMessageBehaviorPayload(req: Request) {
  const raw =
    req.body?.messageBehavior && typeof req.body.messageBehavior === 'object'
      ? req.body.messageBehavior
      : req.body && typeof req.body === 'object'
        ? req.body
        : {};
  return {
    respondInGroup: raw.respondInGroup,
    respondInPrivate: raw.respondInPrivate,
    respondForAnyone: raw.respondForAnyone,
    respondOnlySelectedGroups: raw.respondOnlySelectedGroups,
    allowedNumbers: raw.allowedNumbers,
    allowedGroups: raw.allowedGroups,
    autoRespondUnknownCommand: raw.autoRespondUnknownCommand,
    unknownCommandInPrivate: raw.unknownCommandInPrivate,
    unknownCommandInGroup: raw.unknownCommandInGroup,
  };
}

function parseReminderPayload(req: Request) {
  const raw = req.body && typeof req.body === 'object' ? req.body : {};
  return {
    name: raw.name,
    date: raw.date,
    time: raw.time,
    earlyDays: raw.earlyDays,
    targetChats: raw.targetChats,
  };
}

// ── /bot/status ────────────────────────────────────────────────────────────────

function handleBotStatus(_req: Request, res: Response) {
  res.status(200).json(buildBotStatusResponse());
}

// ── /bot/settings ─────────────────────────────────────────────────────────────

function handleBotSettingsGet(_req: Request, res: Response) {
  res.status(200).json({ success: true, data: { messageBehavior: getBotMessageBehaviorSettings() } });
}

function handleBotSettingsPost(req: Request, res: Response) {
  const updated = setBotMessageBehaviorSettings(parseMessageBehaviorPayload(req));
  res.status(200).json({ success: true, data: { messageBehavior: updated } });
}

// ── /bot/reminders ────────────────────────────────────────────────────────────

function handleRemindersGet(_req: Request, res: Response) {
  res.status(200).json({ success: true, data: getBotReminders() });
}

function handleRemindersPost(req: Request, res: Response) {
  const created = createBotReminder(parseReminderPayload(req));
  if (!created) {
    res.status(400).json({ success: false, error: 'Invalid reminder payload' });
    return;
  }
  res.status(200).json({ success: true, data: created });
}

function handleReminderPut(req: Request, res: Response) {
  const id = String(req.params.id || '');
  const updated = updateBotReminder(id, parseReminderPayload(req));
  if (!updated) {
    res.status(400).json({ success: false, error: 'Failed to update reminder' });
    return;
  }
  res.status(200).json({ success: true, data: updated });
}

function handleReminderDelete(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!deleteBotReminder(id)) {
    res.status(404).json({ success: false, error: 'Reminder not found' });
    return;
  }
  res.status(200).json({ success: true });
}

// ── /api/bot/pairing ─────────────────────────────────────────────────────────

async function handleBotPairing(req: Request, res: Response) {
  try {
    const raw = req.body && typeof req.body === 'object' ? req.body : {};
    const method = String(raw?.pairingMethod || '').trim().toLowerCase();
    const pairingMethod: 'qr' | 'phone' = method === 'phone' ? 'phone' : 'qr';

    if (pairingMethod === 'phone') {
      const pairingCode = await requestPhonePairingCode(raw?.phoneNumber);
      res.status(200).json({
        success: true,
        data: {
          ...buildBotStatusResponse().data,
          pairingCode,
        },
      });
      return;
    }

    await startQrPairing();
    res.status(202).json({
      success: true,
      data: buildBotStatusResponse().data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update pairing selection';
    const isInputError =
      message.includes('nombor') ||
      message.includes('digit') ||
      message.includes('kod negara') ||
      message.includes('simbol +');
    res.status(isInputError ? 400 : 502).json({ success: false, error: message });
  }
}

// ── /api/bot/messages ─────────────────────────────────────────────────────────

function handleBotMessages(_req: Request, res: Response) {
  const enableBot = String(process.env.ENABLE_WHATSAPP_BOT || 'false').toLowerCase() === 'true';
  if (!enableBot || botState.status !== 'connected') {
    res.status(503).json({ success: false, error: 'Bot is not connected' });
    return;
  }
  res.status(501).json({ success: false, error: 'Bot message sending not yet implemented (Task #4)' });
}

// ── /api/bot/deleted-messages ─────────────────────────────────────────────────

function handleDeletedMessagesGet(_req: Request, res: Response) {
  res.status(200).json({
    success: true,
    data: whatsappMessageStore.listEvents(),
    bot: buildBotStatusResponse().data,
  });
}

function handleDeletedMessagesClear(_req: Request, res: Response) {
  whatsappMessageStore.clearAll();
  res.status(200).json({ success: true, data: [] });
}

function handleDeletedMessagesByChatDelete(req: Request, res: Response) {
  const chatJid = String(req.params.chatJid || '');
  const removed = whatsappMessageStore.removeByChatId(chatJid);
  res.status(200).json({ success: true, removed, data: whatsappMessageStore.listEvents() });
}

function handleDeletedMessageMedia(req: Request, res: Response) {
  const mediaPath = String(req.params.mediaPath || '');
  if (!mediaPath || !whatsappMessageStore.mediaExists(mediaPath)) {
    res.status(404).json({ success: false, error: 'Media not found' });
    return;
  }
  const metadata = whatsappMessageStore.mediaMetadata(mediaPath);
  const safeInlineType = metadata?.mediaType === 'image' || metadata?.mediaType === 'video' || metadata?.mediaType === 'audio' || metadata?.mediaType === 'sticker';
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=300');
  if (safeInlineType && metadata?.mimetype) {
    res.type(metadata.mimetype);
  } else {
    const downloadName = String(metadata?.fileName || 'whatsapp-media.bin').replace(/[\r\n"]/g, '_');
    res.type('application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  }
  res.sendFile(whatsappMessageStore.resolveMediaPath(mediaPath));
}

// ── /api/bot/contacts ─────────────────────────────────────────────────────────

function handleContactsGet(_req: Request, res: Response) {
  res.status(200).json({ success: true, data: readBotContacts() });
}

function handleContactsPost(req: Request, res: Response) {
  try {
    const raw = req.body && typeof req.body === 'object' ? req.body : {};
    const next = Array.isArray(raw) ? raw : Array.isArray(raw.contacts) ? raw.contacts : [];
    const saved = saveBotContacts(next);
    res.status(200).json({ success: true, data: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save bot contacts';
    res.status(500).json({ success: false, error: message });
  }
}

// ── Routers ───────────────────────────────────────────────────────────────────

/** Mounted at /bot → handles /bot/status, /bot/settings, /bot/reminders */
export const botRootRouter = Router();
botRootRouter.get('/status', handleBotStatus);
botRootRouter.get('/settings', handleBotSettingsGet);
botRootRouter.post('/settings', handleBotSettingsPost);
botRootRouter.get('/reminders', handleRemindersGet);
botRootRouter.post('/reminders', handleRemindersPost);
botRootRouter.put('/reminders/:id', handleReminderPut);
botRootRouter.delete('/reminders/:id', handleReminderDelete);

/** Mounted at /api/bot → handles /api/bot/pairing, /api/bot/messages, etc. */
export const botApiRouter = Router();
botApiRouter.post('/pairing', handleBotPairing);
botApiRouter.post('/messages', handleBotMessages);
botApiRouter.get('/contacts', handleContactsGet);
botApiRouter.post('/contacts', handleContactsPost);
botApiRouter.get('/deleted-messages', handleDeletedMessagesGet);
botApiRouter.delete('/deleted-messages', handleDeletedMessagesClear);
botApiRouter.delete('/deleted-messages/chat/:chatJid', handleDeletedMessagesByChatDelete);
botApiRouter.get('/deleted-messages/media/:mediaPath', handleDeletedMessageMedia);

/** Standalone handlers used directly in the api router */
export {
  handleBotStatus as botStatusHandler,
  handleBotSettingsGet,
  handleBotSettingsPost,
  handleRemindersGet,
  handleRemindersPost,
  handleReminderPut,
  handleReminderDelete,
};
