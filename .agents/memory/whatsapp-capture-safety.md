---
name: WhatsApp capture safety
description: Durable correctness and security constraints for captured WhatsApp messages and media.
---

Baileys emits edits and revocations through mutation-specific `messages.update` shapes, including a null-message revoke stub and an `editedMessage` wrapper. Normalize these shapes before generic message handling, and retain the first snapshot as the immutable original.

**Why:** Generic content normalization can unwrap edits into ordinary messages, while skipping null messages silently loses revoke events.

**How to apply:** Test against payload fixtures from the installed Baileys version, deduplicate by chat/message/event identity, and only derive delete/edit records from the preserved snapshot.

Captured media must be size-bounded while streaming. Active document formats must be served as downloads with `nosniff`, not rendered from the application origin. Runtime auth and capture directories must remain ignored by Git, and Baileys logging must not expose handshake data at INFO level.

**Why:** Incoming media is attacker-controlled; unbounded buffers cause memory pressure and same-origin document previews can execute active content. WhatsApp auth state is equivalent to a session credential.

**How to apply:** Keep media limits in the download stream, use safe attachment headers for documents, exclude runtime `.data`, and limit Baileys logs to warnings/errors.