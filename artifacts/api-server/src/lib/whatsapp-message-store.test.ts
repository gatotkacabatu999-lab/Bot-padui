import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  WhatsAppMessageStore,
  type OriginalMessageSnapshot,
} from "./whatsapp-message-store.js";

function snapshot(
  overrides: Partial<OriginalMessageSnapshot> = {},
): OriginalMessageSnapshot {
  return {
    id: "message-1",
    chatJid: "60111111111@s.whatsapp.net",
    chatName: "Ali",
    chatType: "personal",
    senderJid: "60111111111@s.whatsapp.net",
    senderName: "Ali",
    fromMe: false,
    timestamp: "2026-09-01T10:00:00.000Z",
    text: "Mesej asal",
    mediaType: null,
    fileName: null,
    mimetype: null,
    mediaPath: null,
    ...overrides,
  };
}

function temporaryStore(): { directory: string; store: WhatsAppMessageStore } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wa-capture-"));
  return { directory, store: new WhatsAppMessageStore(directory) };
}

test("deduplicates snapshots and revoke events while preserving original text", () => {
  const { directory, store } = temporaryStore();
  try {
    assert.equal(store.capture(snapshot()), true);
    assert.equal(store.capture(snapshot({ text: "duplicate" })), false);
    const first = store.recordDeletion(
      "60111111111@s.whatsapp.net",
      "message-1",
      "2026-09-01T10:05:00.000Z",
    );
    const duplicate = store.recordDeletion(
      "60111111111@s.whatsapp.net",
      "message-1",
      "2026-09-01T10:06:00.000Z",
    );
    assert.equal(first.eventId, duplicate.eventId);
    assert.equal(store.listEvents().length, 1);
    assert.equal(first.originalText, "Mesej asal");
    assert.equal(first.contentRecovered, true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("reconciles a fallback mutation when the original snapshot arrives later", () => {
  const { directory, store } = temporaryStore();
  try {
    const earlyDeletion = store.recordDeletion(
      "60111111111@s.whatsapp.net",
      "message-1",
      "2026-09-01T10:05:00.000Z",
    );
    assert.equal(earlyDeletion.contentRecovered, false);

    store.capture(snapshot());
    const reconciled = store.listEvents()[0];
    assert.equal(reconciled.contentRecovered, true);
    assert.equal(reconciled.contentSource, "captured");
    assert.equal(reconciled.originalText, "Mesej asal");

    store.enrichSnapshot(
      "60111111111@s.whatsapp.net",
      "message-1",
      { chatName: "Nama Dipulihkan", mediaPath: "captured.jpg" },
    );
    const enriched = store.listEvents()[0];
    assert.equal(enriched.chatName, "Nama Dipulihkan");
    assert.equal(enriched.mediaPath, "captured.jpg");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("records edited content, group identity, status, and persists over restart", () => {
  const { directory, store } = temporaryStore();
  try {
    store.capture(snapshot({
      id: "group-message",
      chatJid: "120363000@g.us",
      chatName: "Group Operasi",
      chatType: "group",
    }));
    store.recordEdit("120363000@g.us", "group-message", "Mesej terkini");
    store.capture(snapshot({
      id: "status-message",
      chatJid: "status@broadcast",
      chatName: "WhatsApp Status",
      chatType: "status",
      text: "Status hari ini",
    }));

    const restored = new WhatsAppMessageStore(directory);
    const events = restored.listEvents();
    assert.equal(events.length, 2);
    assert.equal(events.find((event) => event.eventType === "edited")?.currentText, "Mesej terkini");
    assert.equal(events.find((event) => event.eventType === "edited")?.chatName, "Group Operasi");
    assert.equal(events.find((event) => event.eventType === "status")?.originalText, "Status hari ini");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("stores media safely and removes records by chat or globally", () => {
  const { directory, store } = temporaryStore();
  try {
    const mediaPath = store.saveMedia(Buffer.from("media"), "jpg/../../bad");
    assert.equal(mediaPath.includes("/"), false);
    assert.equal(store.mediaExists(mediaPath), true);
    store.capture(snapshot({ mediaPath, mediaType: "image", mimetype: "image/jpeg" }));
    store.recordDeletion("60111111111@s.whatsapp.net", "message-1");
    assert.equal(store.removeByChatId("60111111111@s.whatsapp.net"), 1);
    assert.equal(store.listEvents().length, 0);
    assert.equal(store.mediaExists(mediaPath), false);

    const snapshotOnlyMedia = store.saveMedia(Buffer.from("snapshot"), "png");
    store.capture(snapshot({ id: "snapshot-only", mediaPath: snapshotOnlyMedia, mediaType: "image" }));
    assert.equal(store.removeByChatId("60111111111@s.whatsapp.net"), 0);
    assert.equal(store.mediaExists(snapshotOnlyMedia), false);

    store.capture(snapshot({ id: "second" }));
    store.recordDeletion("60111111111@s.whatsapp.net", "second");
    store.clearAll();
    assert.equal(store.listEvents().length, 0);
    assert.equal(new WhatsAppMessageStore(directory).listEvents().length, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});