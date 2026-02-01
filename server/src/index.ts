import express from "express";
import cors from "cors";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PORT } from "./config/env.js";
import { bookingRouter } from "./routes/booking.js";
import { settingsRouter } from "./routes/settings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
