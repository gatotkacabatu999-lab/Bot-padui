import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { botRootRouter } from "./routes/bot-router";
import { logger } from "./lib/logger";
import { initializeWhatsAppBot } from "./lib/whatsapp-service";

const app: Express = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow only the Dbrutals origin (or a configured override) with credentials.
// Falls back to the Replit dev domain when ALLOWED_ORIGIN is not set.
const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
const allowedOrigin = process.env.ALLOWED_ORIGIN
  ?? (replitDevDomain ? `https://${replitDevDomain}` : undefined);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (server-to-server, curl, Replit health checks).
      if (!origin) { cb(null, true); return; }
      if (!allowedOrigin) {
        // No origin configured — reject cross-origin browser requests.
        cb(null, false);
        return;
      }
      cb(null, origin === allowedOrigin);
    },
    credentials: true,
  }),
);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Session cookie signing ────────────────────────────────────────────────────
// When APP_PASSWORD is set, SESSION_SECRET must also be configured — a known
// fallback would let attackers forge signed cookies and bypass auth.
const sessionSecret = process.env.SESSION_SECRET;
if (process.env.APP_PASSWORD && !sessionSecret) {
  throw new Error(
    "SESSION_SECRET env var must be set when APP_PASSWORD is configured. " +
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}
app.use(cookieParser(sessionSecret ?? "dbrutals-unsigned-dev"));

// ── Body parsing ──────────────────────────────────────────────────────────────
// Raw body for upload endpoint (must come before json middleware).
app.all("/api/upload", express.raw({ type: "*/*", limit: "15mb" }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
// /bot/* — root-level bot endpoints (status, settings, reminders, dashboard).
// These are NOT under /api/ to match the original server layout the frontend
// expects (BotDashboard fetches /bot/status as its primary endpoint).
app.use("/bot", botRootRouter);

app.use("/api", router);

void initializeWhatsAppBot();

export default app;
