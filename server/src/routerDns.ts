import { execFile } from "child_process";
import { Resolver } from "dns";
import {
  ROUTER_DNS_AUTOFIX,
  ROUTER_DNS_CHECK_INTERVAL_MS,
  ROUTER_HOST,
  ROUTER_SSH_PORT,
  ROUTER_SSH_USER,
  ROUTER_SSH_KEY,
  LOCAL_HOSTNAME,
  LOCAL_HOST_IP,
} from "./config/env.js";

const TAG = "[router-dns]";
const RESOLVE_TIMEOUT_MS = 3000;
const SSH_TIMEOUT_MS = 15_000;

let checkInProgress = false;
let lastCheckOk: boolean | null = null;

/**
 * Start the router DNS watchdog: check immediately on startup, then
 * re-check every ROUTER_DNS_CHECK_INTERVAL_MS (default 5 min, 0 disables
 * the periodic re-check). A router reboot wipes the dnsmasq forwarder
 * line, and the service may run for months without restarting, so a
 * startup-only check is not enough.
 */
export function startRouterDnsWatchdog(): void {
  if (!ROUTER_DNS_AUTOFIX) {
    console.log(`${TAG} disabled (set ROUTER_DNS_AUTOFIX=true to enable)`);
    return;
  }

  const runCheck = () => {
    if (checkInProgress) return;
    checkInProgress = true;
    ensureRouterDns()
      .catch((err) => console.error(`${TAG} unexpected error:`, err))
      .finally(() => {
        checkInProgress = false;
      });
  };

  runCheck();

  if (ROUTER_DNS_CHECK_INTERVAL_MS > 0) {
    const timer = setInterval(runCheck, ROUTER_DNS_CHECK_INTERVAL_MS);
    timer.unref();
    console.log(
      `${TAG} periodic check every ${Math.round(ROUTER_DNS_CHECK_INTERVAL_MS / 1000)}s`,
    );
  }
}

/**
 * Verify that the router resolves LOCAL_HOSTNAME to LOCAL_HOST_IP.
 * If not, SSH to the router and apply the dnsmasq forwarder fix.
 *
 * Non-fatal: any error is logged and swallowed so the server still comes up.
 * See docs/router-dns-setup.md for the manual procedure this automates.
 */
export async function ensureRouterDns(): Promise<void> {
  try {
    const addrs = await resolveViaRouter(LOCAL_HOSTNAME);
    if (addrs.includes(LOCAL_HOST_IP)) {
      // Only log OK on the first check or on recovery, to avoid spamming
      // the log every interval.
      if (lastCheckOk !== true) {
        console.log(`${TAG} OK: ${LOCAL_HOSTNAME} -> ${addrs.join(", ")}`);
      }
      lastCheckOk = true;
      return;
    }
    console.warn(
      `${TAG} resolved ${LOCAL_HOSTNAME} to ${addrs.join(", ")}, expected ${LOCAL_HOST_IP}; applying fix`,
    );
  } catch (err) {
    console.warn(
      `${TAG} initial lookup of ${LOCAL_HOSTNAME} failed (${(err as Error).message}); applying fix`,
    );
  }
  lastCheckOk = false;

  try {
    await applyRouterFix();
  } catch (err) {
    console.error(`${TAG} fix command failed:`, err);
    return;
  }

  try {
    const addrs = await resolveViaRouter(LOCAL_HOSTNAME);
    if (addrs.includes(LOCAL_HOST_IP)) {
      console.log(`${TAG} fix applied successfully: ${LOCAL_HOSTNAME} -> ${addrs.join(", ")}`);
    } else {
      console.warn(`${TAG} fix ran but lookup still returns ${addrs.join(", ")}`);
    }
  } catch (err) {
    console.warn(`${TAG} verification lookup failed:`, (err as Error).message);
  }
}

function resolveViaRouter(hostname: string): Promise<string[]> {
  const resolver = new Resolver({ timeout: RESOLVE_TIMEOUT_MS, tries: 1 });
  resolver.setServers([ROUTER_HOST]);
  return new Promise((resolve, reject) => {
    resolver.resolve4(hostname, (err, addrs) => {
      if (err) reject(err);
      else resolve(addrs);
    });
  });
}

function applyRouterFix(): Promise<void> {
  // Idempotent: append the server= line only if not already present, then
  // restart dnsmasq. Stock AsusWRT regenerates /etc/dnsmasq.conf from nvram
  // on reboot, so this re-applies the line each time it's needed.
  const remoteCmd = [
    `grep -q "server=/local.home/${LOCAL_HOST_IP}" /etc/dnsmasq.conf`,
    `echo "server=/local.home/${LOCAL_HOST_IP}" >> /etc/dnsmasq.conf`,
  ].join(" || ") + "; killall dnsmasq; dnsmasq --log-async";

  const args = [
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=5",
    "-p", String(ROUTER_SSH_PORT),
  ];
  if (ROUTER_SSH_KEY) args.push("-i", ROUTER_SSH_KEY);
  args.push(`${ROUTER_SSH_USER}@${ROUTER_HOST}`, remoteCmd);

  console.log(`${TAG} ssh ${ROUTER_SSH_USER}@${ROUTER_HOST}:${ROUTER_SSH_PORT} (key=${ROUTER_SSH_KEY || "default"})`);

  return new Promise<void>((resolve, reject) => {
    const child = execFile(
      "ssh",
      args,
      { timeout: SSH_TIMEOUT_MS, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const detail = [stdout, stderr].filter(Boolean).join("\n").trim();
          reject(new Error(`${err.message}${detail ? `\n${detail}` : ""}`));
          return;
        }
        if (stdout.trim()) console.log(`${TAG} stdout: ${stdout.trim()}`);
        if (stderr.trim()) console.log(`${TAG} stderr: ${stderr.trim()}`);
        resolve();
      },
    );
    child.on("error", reject);
  });
}
