/**
 * Unit tests for the preflight dev orchestrator utilities.
 *
 * Each test spins up temporary HTTP servers or child processes on
 * random ports so there are no conflicts with the real dev services.
 */

import { describe, it, expect, afterEach } from "vitest";
import http from "http";
import { spawn, type ChildProcess } from "child_process";
import { probeHealth, getPortPid, killPid } from "../preflight.js";

// --- Helpers ---

function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("Could not get random port"));
      }
    });
  });
}

function createServer(
  port: number,
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<http.Server> {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

function closeServer(srv: http.Server): Promise<void> {
  return new Promise((resolve) => srv.close(() => resolve()));
}

// --- probeHealth ---

describe("probeHealth", () => {
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server) {
      await closeServer(server);
      server = null;
    }
  });

  it('should return "healthy" for a server returning {"status":"ok"}', async () => {
    const port = await getRandomPort();
    server = await createServer(port, (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    });

    const result = await probeHealth(port, "/api/health");
    expect(result).toBe("healthy");
  });

  it('should return "stale" for a server returning 404', async () => {
    const port = await getRandomPort();
    server = await createServer(port, (_req, res) => {
      res.writeHead(404);
      res.end("Not Found");
    });

    const result = await probeHealth(port, "/api/health");
    expect(result).toBe("stale");
  });

  it('should return "stale" for a server returning invalid JSON on health path', async () => {
    const port = await getRandomPort();
    server = await createServer(port, (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html>hello</html>");
    });

    const result = await probeHealth(port, "/api/health");
    expect(result).toBe("stale");
  });

  it('should return "healthy" for a non-health path returning 200', async () => {
    const port = await getRandomPort();
    server = await createServer(port, (_req, res) => {
      res.writeHead(200);
      res.end("OK");
    });

    const result = await probeHealth(port, "/");
    expect(result).toBe("healthy");
  });

  it('should return "free" when nothing is listening', async () => {
    const port = await getRandomPort();
    const result = await probeHealth(port, "/api/health");
    expect(result).toBe("free");
  });

  it('should return "free" when the server never responds (timeout)', async () => {
    const port = await getRandomPort();
    server = await createServer(port, () => {
      // intentionally never respond
    });

    const result = await probeHealth(port, "/api/health", 500);
    expect(result).toBe("free");
  });
});

// --- getPortPid ---

describe("getPortPid", () => {
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server) {
      await closeServer(server);
      server = null;
    }
  });

  it("should return a PID for a port with a listener", async () => {
    const port = await getRandomPort();
    server = await createServer(port, (_req, res) => {
      res.writeHead(200);
      res.end();
    });

    const pid = getPortPid(port);
    expect(pid).toBeTypeOf("number");
    expect(pid).toBeGreaterThan(0);
  });

  it("should return null for a port with no listener", async () => {
    const port = await getRandomPort();
    const pid = getPortPid(port);
    expect(pid).toBeNull();
  });
});

// --- killPid ---

describe("killPid", () => {
  it("should kill a running child process", async () => {
    const child: ChildProcess = spawn(
      "node",
      ["-e", "setTimeout(()=>{},60000)"],
      { stdio: "ignore" }
    );
    const pid = child.pid!;

    // Verify it's running
    expect(pid).toBeGreaterThan(0);

    killPid(pid);
    await new Promise((r) => setTimeout(r, 1000));

    // Verify it's dead — sending signal 0 checks existence
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    expect(alive).toBe(false);
  });

  it("should not throw for a non-existent PID", () => {
    expect(() => killPid(99999)).not.toThrow();
  });
});
