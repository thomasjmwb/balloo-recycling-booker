# Deployment & Production

How the recycling booker runs as a Windows service, how to reach it, and how to debug it.

## Topology

```
Phone / Desktop browser
        |
        |  https://recycling.local.home
        v
  Caddy (Windows service, ports 80/443)
        |
        |  reverse_proxy 127.0.0.1:3100
        v
  recycling-booker (NSSM Node service, port 3100)
        |
        |  Puppeteer
        v
  Council booking site
```

Two Windows services run on this machine:

1. **`recycling-booker`** — Node/Express app (the booker itself), managed by NSSM.
2. **`caddy`** — Caddy web server, terminates TLS and reverse-proxies to the booker.

Both have `StartType: Automatic`, so they come up on boot.

## Access URLs

| Where | URL |
|-------|-----|
| This computer | `https://recycling.local.home` |
| Phone (same Wi-Fi or via WireGuard) | `https://recycling.local.home` |

There is no plain-HTTP frontend; port 80 just returns a banner pointing at the HTTPS URL. Caddy uses an internal CA (`tls internal`), so each new device must install Caddy's root certificate once (valid until 2036). For the CA topology, device install steps, and how to distinguish real cert problems from DNS problems, see [tls-certificates.md](tls-certificates.md).

DNS for `*.local.home` is resolved by the router (ASUS GT-BE98) forwarding to CoreDNS on this PC. If `recycling.local.home` stops resolving — usually after a router reboot — the service re-applies the fix automatically on its next startup (see [Router DNS auto-fix](#router-dns-auto-fix) below). For the manual procedure, see [router-dns-setup.md](router-dns-setup.md).

## Router DNS auto-fix

The Node service checks whether the router resolves `recycling.local.home` to the expected IP — once at startup and then every `ROUTER_DNS_CHECK_INTERVAL_MS` (default 5 minutes). If the lookup fails or returns the wrong address, it SSHes into the router and idempotently re-applies the `server=/local.home/...` line in `/etc/dnsmasq.conf`, then restarts dnsmasq. The check is non-fatal: if SSH fails, it logs and continues.

The periodic re-check matters because a router reboot wipes the dnsmasq line while the service keeps running; a startup-only check would leave DNS broken until the next service restart (this happened in June 2026 — phones were broken for a week while the desktop kept working via its `hosts` entry, see gotchas below).

Implemented in [server/src/routerDns.ts](../server/src/routerDns.ts) (`startRouterDnsWatchdog`), called from [server/src/index.ts](../server/src/index.ts) right after `app.listen`.

Environment variables (all in production `.env`):

| Var | Production value | Purpose |
|-----|------------------|---------|
| `ROUTER_DNS_AUTOFIX` | `true` | Master switch (default `false` so dev runs don't SSH anywhere) |
| `ROUTER_HOST` | `192.168.50.1` | Router IP, used both as DNS server for the check and SSH target |
| `ROUTER_SSH_PORT` | `1025` | Router's SSH port |
| `ROUTER_SSH_USER` | `admin` | SSH user |
| `ROUTER_SSH_KEY` | `C:\services\recycling-booker\.ssh\id_ed25519` | Absolute path to the private key |
| `LOCAL_HOSTNAME` | `recycling.local.home` | Hostname to verify |
| `LOCAL_HOST_IP` | `192.168.50.94` | Expected resolved address |
| `ROUTER_DNS_CHECK_INTERVAL_MS` | `300000` (default) | Re-check interval; `0` = startup check only |

### SSH key: why the service has its own copy

The key at `C:\services\recycling-booker\.ssh\id_ed25519` is a copy of the user key `C:\Users\thoma\.ssh\id_ed25519` (same public key, already registered with the router via the web UI: Administration → System → Authorized Keys, persisted in nvram across reboots).

The service **cannot** use the user's key directly. It runs as `LocalSystem`, and Windows OpenSSH refuses any private key whose ACL grants access to a principal other than the current user — it fails with `WARNING: UNPROTECTED PRIVATE KEY FILE! ... bad permissions` and then `Permission denied (publickey)`. (`LocalSystem` being able to *read* the file is not enough; the permission check is about who *else* can read it.) This silently broke the auto-fix for a week in June 2026.

The service copy therefore needs **two** changes, both required (learned the hard way — the ACL alone still fails with the same `bad permissions` error because OpenSSH also checks the file *owner*):

```powershell
# 1. Restrict the ACL to SYSTEM and Administrators (admin shell)
icacls C:\services\recycling-booker\.ssh\id_ed25519 /inheritance:r /grant "SYSTEM:F" /grant "Administrators:F"

# 2. Change the owner from the user to SYSTEM (admin shell)
$acl = Get-Acl C:\services\recycling-booker\.ssh\id_ed25519
$acl.SetOwner([Security.Principal.NTAccount]'NT AUTHORITY\SYSTEM')
Set-Acl C:\services\recycling-booker\.ssh\id_ed25519 $acl
```

After this, the `thoma` account can no longer read the file (expected — `Get-Acl` from a non-admin shell returns "unauthorized operation"). Verify the result end-to-end, not just by inspection: delete the dnsmasq line on the router and confirm the service logs `fix applied successfully` within one check interval (this drill was run successfully on 2026-06-10).

If the key is ever rotated, re-copy it and re-apply **both** steps, or generate a dedicated keypair and register its pubkey in the router web UI.

### Log lines

Look for the `[router-dns]` prefix in `service-stdout.log`:

- `[router-dns] periodic check every 300s` — watchdog started (logged once at startup).
- `[router-dns] OK: recycling.local.home -> 192.168.50.94` — resolution correct. Logged on the first check and on recovery only, not every interval.
- `[router-dns] resolved ... expected 192.168.50.94; applying fix` — wrong IP, fixing.
- `[router-dns] initial lookup of ... failed (...); applying fix` — NXDOMAIN or timeout, fixing.
- `[router-dns] fix applied successfully: ...` — recovery worked.
- `[router-dns] fix command failed: ...` — SSH failed; falls back to the manual procedure in [router-dns-setup.md](router-dns-setup.md).
- `[router-dns] disabled (set ROUTER_DNS_AUTOFIX=true to enable)` — feature off.

## NSSM service: `recycling-booker`

| Field | Value |
|-------|-------|
| Application | `C:\Program Files\nodejs\node.exe` |
| Arguments | `C:\services\recycling-booker\server\dist\index.js` |
| Working dir | `C:\services\recycling-booker` |
| Stdout log | `C:\services\recycling-booker\data\service-stdout.log` |
| Stderr log | `C:\services\recycling-booker\data\service-stderr.log` |
| Env overrides (`AppEnvironmentExtra`) | `NODE_ENV=production`, `PORT=3100`, `PUPPETEER_CACHE_DIR=C:\services\recycling-booker\.cache\puppeteer` |

The service reads `C:\services\recycling-booker\.env` for everything else (booking URL, postcode, vehicle info, etc.). NSSM env vars take precedence, which is why `PORT=3000` in `.env` is ignored in production.

`PUPPETEER_CACHE_DIR` is overridden because by default Puppeteer would look under the SYSTEM profile (`C:\windows\system32\config\systemprofile\.cache\puppeteer`), which is awkward to populate. Keeping the cache inside the service directory means `npx puppeteer browsers install chrome` can be run from there.

### Common service operations (PowerShell, run as admin)

```powershell
# Status
Get-Service recycling-booker | Format-List Name, Status, StartType

# Restart
Restart-Service recycling-booker

# Stop / start
Stop-Service recycling-booker
Start-Service recycling-booker

# View NSSM config
nssm get recycling-booker AppEnvironmentExtra
nssm get recycling-booker Application
nssm get recycling-booker AppParameters

# Edit NSSM config interactively
nssm edit recycling-booker
```

### Redeploying after a code change

1. `npm run build` in the dev workspace.
2. Copy `server/dist/`, `server/package.json`, `server/node_modules/` (or run `npm ci --omit=dev` in `C:\services\recycling-booker\server`), and `client/dist/` to the corresponding paths under `C:\services\recycling-booker\`.
3. `Restart-Service recycling-booker`.
4. Sanity check: `(New-Object Net.WebClient).DownloadString("http://127.0.0.1:3100/api/health")` should return `{"status":"ok",...}`.

## Caddy service

| Field | Value |
|-------|-------|
| Binary | `C:\caddy\caddy.exe` |
| Args | `run --config C:\caddy\Caddyfile` |
| Caddyfile | `C:\caddy\Caddyfile` |

Caddyfile contents:

```
{
    admin off
}

:80 {
    respond "Proxy is running. Use https://recycling.local.home to reach services." 200
}

recycling.local.home {
    tls internal
    reverse_proxy 127.0.0.1:3100 {
        health_uri /api/health
        health_interval 10s
        health_timeout 3s
    }
    handle_errors {
        respond "503 - recycling-booker is currently down." 503
    }
}
```

Caddy polls `/api/health` every 10 seconds; that's the source of the constant `GET /api/health 200` lines in the stdout log.

```powershell
# Restart Caddy after editing the Caddyfile
Restart-Service caddy

# Validate the Caddyfile before restarting
C:\caddy\caddy.exe validate --config C:\caddy\Caddyfile
```

## Debugging

### Log locations

- `C:\services\recycling-booker\data\service-stdout.log` — all `console.log` output, including JSON request logs (rotated at 1 MB by NSSM)
- `C:\services\recycling-booker\data\service-stderr.log` — all `console.error` output (rotated at 1 MB)
- `C:\services\recycling-booker\data\logs\requests.log` — dedicated request log file
- `C:\services\recycling-booker\data\logs\error-*.html` / `error-*.png` — Puppeteer HTML snapshots and screenshots on errors
- `C:\services\recycling-booker\data\logs\confirmation.png` — screenshot on successful booking
- `C:\services\recycling-booker\data\logs\slots-debug.json` — raw slot API request/response data

### Tail the live log

```powershell
Get-Content -Wait C:\services\recycling-booker\data\service-stdout.log
```

### Filter for errors (status >= 400)

```powershell
Get-Content C:\services\recycling-booker\data\service-stdout.log |
  Where-Object { $_ -match '^\{' } |
  ConvertFrom-Json |
  Where-Object { $_.status -ge 400 }
```

### Find slow requests (> 5 seconds)

```powershell
Get-Content C:\services\recycling-booker\data\logs\requests.log |
  ConvertFrom-Json |
  Where-Object { $_.ms -gt 5000 } |
  Format-Table ts, method, url, ms
```

### Filter by endpoint

```powershell
Get-Content C:\services\recycling-booker\data\logs\requests.log |
  ConvertFrom-Json |
  Where-Object { $_.url -like '*/booking/*' } |
  Format-Table ts, method, url, status, ms
```

### Is anything actually listening?

NSSM will report a service as `Running` even if the Node process has crashed and is being restart-looped, so don't trust `Get-Service` alone. Confirm the port is bound:

```powershell
netstat -ano | Select-String "LISTENING" | Select-String ":3100"
(New-Object Net.WebClient).DownloadString("http://127.0.0.1:3100/api/health")
```

Then confirm Caddy is fronting it:

```powershell
(New-Object Net.WebClient).DownloadString("http://127.0.0.1:80/api/health")
# -> "Proxy is running. Use https://recycling.local.home to reach services."

# Full path through Caddy (skips cert verification for tls internal)
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
(New-Object Net.WebClient).DownloadString("https://recycling.local.home/api/health")
```

## Known issues / gotchas

- **Chrome not found on first boot after a Puppeteer upgrade.** Puppeteer pins a specific Chrome version. After updating `puppeteer` in `package.json`, run `npx puppeteer browsers install chrome` from `C:\services\recycling-booker\server` (so it lands in the configured `PUPPETEER_CACHE_DIR`) before restarting the service. Symptom in stderr: `Could not find Chrome (ver. X). ...`.
- **Phone can't reach `recycling.local.home` (including "certificate error" symptoms).** Almost always router DNS — see [router-dns-setup.md](router-dns-setup.md). Quick test: `nslookup recycling.local.home 192.168.50.1` from the PC. Note that a DNS failure can surface on phones as a *certificate* error (e.g. an upstream resolver hijacking NXDOMAIN to a server with a mismatched cert), so don't assume the TLS layer is at fault.
- **Phones broken but this PC works.** Not evidence that DNS is fine: this PC has `127.0.0.1 recycling.local.home` in `C:\Windows\System32\drivers\etc\hosts`, so it never consults router DNS. Always test with `nslookup recycling.local.home 192.168.50.1` explicitly.
- **Auto-fix logs `Permission denied (publickey)` / `UNPROTECTED PRIVATE KEY FILE`.** The key at `ROUTER_SSH_KEY` has too-open ACLs **or the wrong owner** for OpenSSH running as `LocalSystem`. Re-apply both the `icacls` lockdown and the `SetOwner` step shown in the SSH key section above — the ACL alone is not sufficient.
- **NSSM env edits don't take effect.** `nssm set ... AppEnvironmentExtra ...` requires a service restart (`Restart-Service recycling-booker`) before new env vars are visible to the Node process.
- **`.env` `PORT=3000` is ignored in production.** That's intentional; the NSSM `AppEnvironmentExtra` overrides it to 3100 to match the Caddy upstream. Don't "fix" the `.env`.
