import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, readdirSync, unlinkSync, appendFileSync, mkdirSync } from "fs";
import { bookingRouter } from "./routes/booking.js";
import { settingsRouter } from "./routes/settings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const app = express();

// Delete existing logs on server start
const logsDir = join(__dirname, "../../data/logs");
if (existsSync(logsDir)) {
  for (const file of readdirSync(logsDir)) {
    try {
      unlinkSync(join(logsDir, file));
    } catch {
      // Ignore errors
    }
  }
}

const LOG_REQUESTS = (process.env.LOG_REQUESTS ?? "true").toLowerCase() === "true";
const requestLogPath = join(__dirname, "../../data/logs/requests.log");

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const entry = {
      ts: new Date().toISOString(),
      method,
      url: originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
      size: parseInt(res.getHeader("content-length") as string) || 0,
    };
    const line = JSON.stringify(entry);
    console.log(line);

    if (LOG_REQUESTS) {
      try {
        mkdirSync(join(__dirname, "../../data/logs"), { recursive: true });
        appendFileSync(requestLogPath, line + "\n");
      } catch {
        // Don't crash on log write failure
      }
    }
  });

  next();
}

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// API routes
app.use("/api/booking", bookingRouter);
app.use("/api/settings", settingsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  const clientPath = join(__dirname, "../../client/dist");
  app.use(express.static(clientPath));

  // Fallback for SPA routing
  app.get("*", (_req, res) => {
    res.sendFile(join(clientPath, "index.html"));
  });
}
