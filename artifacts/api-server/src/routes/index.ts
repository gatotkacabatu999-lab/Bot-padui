import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import { botApiRouter, botStatusHandler, handleBotSettingsGet, handleBotSettingsPost, handleRemindersGet, handleRemindersPost, handleReminderPut, handleReminderDelete } from "./bot-router";
import { apiHandler } from "./api-handler";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// Health check — always public.
router.use(healthRouter);

// Auth endpoints — public (login/logout/status don't require auth themselves).
router.use("/auth", authRouter);

// All remaining API routes require authentication.
router.use(requireAuth);

// ── Bot routes ─────────────────────────────────────────────────────────────────
// /api/bot/pairing, /api/bot/messages, /api/bot/contacts, /api/bot/deleted-messages
router.use("/bot", botApiRouter);
// /api/bot-status  (fallback path the frontend also tries)
router.get("/bot-status", botStatusHandler);
// /api/bot-settings
router.get("/bot-settings", handleBotSettingsGet);
router.post("/bot-settings", handleBotSettingsPost);
// /api/bot-reminders
router.get("/bot-reminders", handleRemindersGet);
router.post("/bot-reminders", handleRemindersPost);
router.put("/bot-reminders/:id", handleReminderPut);
router.delete("/bot-reminders/:id", handleReminderDelete);

// Mount the ported API handler for all remaining /api/* routes.
// Express 5: use /{*path} wildcard syntax.
router.all("/{*path}", (req, res) => {
  return apiHandler(req, res);
});

export default router;
