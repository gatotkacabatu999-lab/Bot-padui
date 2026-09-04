import assert from "node:assert/strict";
import test from "node:test";
import { WAMessageStubType } from "@whiskeysockets/baileys";
import { normalizeBaileysMessageUpdate } from "./whatsapp-event-normalizer.js";

test("normalizes the Baileys null-message revoke update shape", () => {
  assert.deepEqual(
    normalizeBaileysMessageUpdate(
      { remoteJid: "60111111111@s.whatsapp.net", id: "deleted-id" },
      { message: null, messageStubType: WAMessageStubType.REVOKE },
    ),
    {
      eventType: "deleted",
      chatJid: "60111111111@s.whatsapp.net",
      id: "deleted-id",
    },
  );
});

test("normalizes the Baileys editedMessage wrapper shape", () => {
  assert.deepEqual(
    normalizeBaileysMessageUpdate(
      { remoteJid: "120363000@g.us", id: "edited-id" },
      {
        message: {
          editedMessage: {
            message: {
              extendedTextMessage: { text: "Teks baharu" },
            },
          },
        },
      },
    ),
    {
      eventType: "edited",
      chatJid: "120363000@g.us",
      id: "edited-id",
      currentText: "Teks baharu",
    },
  );
});