---
name: Baileys pairing lifecycle
description: Non-obvious lifecycle constraints for QR and phone-number pairing with Baileys.
---

Phone-number pairing must wait until the Baileys WebSocket is open before requesting a code. A pending QR connection must not lock the user out of switching to phone-number pairing, and entering a number must never be treated as proof that the account is connected.

**Why:** Baileys sends the pairing request through the live socket. Requesting too early fails, while UI state based only on the submitted number can falsely report a connected account.

**How to apply:** Allow the selected pairing method to replace a pending alternate method, request the code only after socket readiness, and set connected account details only from the confirmed connection-open event.