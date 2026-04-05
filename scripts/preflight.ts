/**
 * Preflight utilities for the dev orchestrator.
 *
 * Exports pure functions for port probing, PID lookup, and process killing.
 * Cross-platform: Windows (netstat/taskkill) and Unix (lsof/kill).
 */

import http from "http";
import { execSync } from "child_process";
import os from "os";

export type PortStatus = "healthy" | "stale" | "free";

const isWindows = os.platform() === "win32";

/**
 * Probes a port with an HTTP GET request.
 *
 * - "healthy" if the response is 200 and (when path is /api/health) body contains {"status":"ok"}
 * - "stale"   if something is listening but doesn't pass the health check
 * - "free"    if nothing is listening or the connection times out
 */
export function probeHealth(
  port: number,
  path = "/",
  timeout = 3000
): Promise<PortStatus> {
  // Try localhost first (resolves to ::1 or 127.0.0.1 depending on OS),
  // then fall back to 127.0.0.1 if that fails with a connection error.
  return probeHost("localhost", port, path, timeout).then((result) =>
    result === "free"
      ? probeHost("127.0.0.1", port, path, timeout)
      : result
  );
}

function probeHost(
  hostname: string,
  port: number,
  path: string,
  timeout: number
): Promise<PortStatus> {
  return new Promise((resolve) => {
    const req = http.get({ hostname, port, path, timeout }, (res) => {
      if (path === "/api/health" || path.includes("health")) {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.status === "ok" ? "healthy" : "stale");
          } catch {
            resolve("stale");
          }
        });
        res.on("error", () => resolve("stale"));
      } else {
        res.resume();
        resolve(res.statusCode === 200 ? "healthy" : "stale");
      }
    });

    req.on("error", () => resolve("free"));
    req.on("timeout", () => {
      req.destroy();
      resolve("free");
    });
  });
}

/**
 * Returns the PID of the process listening on the given port, or null.
 */
export function getPortPid(port: number): number | null {
  try {
    if (isWindows) {
      const output = execSync(
        `netstat -ano | findstr "LISTENING" | findstr ":${port} "`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      );
      for (const line of output.trim().split("\n")) {
        const match = line.trim().match(/\s(\d+)\s*$/);
        if (match) return parseInt(match[1], 10);
      }
    } else {
      const output = execSync(`lsof -ti :${port}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      const pid = parseInt(output.trim().split("\n")[0], 10);
      if (!isNaN(pid)) return pid;
    }
  } catch {
    // Command failed = nothing on that port
  }
  return null;
}

/**
 * Kills a process by PID. No-op if the process doesn't exist.
 */
export function killPid(pid: number): void {
  try {
    if (isWindows) {
      execSync(`taskkill /PID ${pid} /F /T`, {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else {
      execSync(`kill -9 ${pid}`, {
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
  } catch {
    // Process already gone or permission denied
  }
}
