#!/usr/bin/env tsx
/**
 * Dev orchestrator with preflight health checks.
 *
 * Probes server (:PORT) and client (:5173), kills stale processes,
 * starts only what's missing, and logs URLs.
 *
 * Usage: npm run dev   (or:  tsx scripts/dev.ts)
 */

import { spawn, type ChildProcess } from "child_process";
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { probeHealth, getPortPid, killPid } from "./preflight.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Load .env for PORT
const envPath = join(root, ".env");
if (existsSync(envPath)) config({ path: envPath });
const SERVER_PORT = parseInt(process.env.PORT || "3000", 10);
const CLIENT_PORT = 5173;

const children: ChildProcess[] = [];

function log(msg: string) {
  console.log(`[dev] ${msg}`);
}

function spawnService(
  name: string,
  command: string,
  args: string[],
  cwd: string
): ChildProcess {
  log(`Starting ${name}...`);
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => {
    log(`${name} exited with code ${code}`);
  });
  children.push(child);
  return child;
}

function cleanup() {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // already dead
    }
  }
}

process.on("SIGINT", () => {
  log("Shutting down...");
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

async function main() {
  log("Running preflight checks...\n");

  // --- Server check ---
  const serverStatus = await probeHealth(SERVER_PORT, "/api/health");
  let serverNeeded = false;

  if (serverStatus === "healthy") {
    log(`Server  :${SERVER_PORT}  HEALTHY (already running)`);
  } else if (serverStatus === "stale") {
    const pid = getPortPid(SERVER_PORT);
    if (pid) {
      log(
        `Server  :${SERVER_PORT}  STALE (PID ${pid} is not our server) — killing`
      );
      killPid(pid);
      await new Promise((r) => setTimeout(r, 1000));
    }
    serverNeeded = true;
  } else {
    log(`Server  :${SERVER_PORT}  FREE`);
    serverNeeded = true;
  }

  // --- Client check ---
  const clientStatus = await probeHealth(CLIENT_PORT, "/");
  let clientNeeded = false;

  if (clientStatus === "healthy") {
    log(`Client  :${CLIENT_PORT}  HEALTHY (already running)`);
  } else if (clientStatus === "stale") {
    const pid = getPortPid(CLIENT_PORT);
    if (pid) {
      log(
        `Client  :${CLIENT_PORT}  STALE (PID ${pid} is not Vite) — killing`
      );
      killPid(pid);
      await new Promise((r) => setTimeout(r, 1000));
    }
    clientNeeded = true;
  } else {
    log(`Client  :${CLIENT_PORT}  FREE`);
    clientNeeded = true;
  }

  console.log();

  // --- Decide what to start ---
  if (!serverNeeded && !clientNeeded) {
    log("Everything is already running!\n");
    log(`  Server:  http://localhost:${SERVER_PORT}`);
    log(`  Client:  http://localhost:${CLIENT_PORT}\n`);
    process.exit(0);
  }

  if (serverNeeded) {
    spawnService("server", "npx", ["tsx", "src/index.ts"], join(root, "server"));
  }
  if (clientNeeded) {
    spawnService("client", "npm", ["run", "dev"], join(root, "client"));
  }

  // Give services a moment to start, then print URLs
  await new Promise((r) => setTimeout(r, 4000));
  console.log();
  log("Services:");
  log(`  Server:  http://localhost:${SERVER_PORT}`);
  log(`  Client:  http://localhost:${CLIENT_PORT}`);
  console.log();
}

main().catch((err) => {
  console.error("[dev] Fatal error:", err);
  cleanup();
  process.exit(1);
});
