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

There is no plain-HTTP frontend; port 80 just returns a banner pointing at the HTTPS URL. Caddy uses an internal CA (`tls internal`), so the first time you visit on a new device you need to accept / install Caddy's root certificate.

DNS for `*.local.home` is resolved by the router (ASUS GT-BE98) forwarding to CoreDNS on this PC. If `recycling.local.home` stops resolving — usually after a router reboot — the service re-applies the fix automatically on its next startup (see [Router DNS auto-fix](#router-dns-auto-fix) below). For the manual procedure, see [router-dns-setup.md](router-dns-setup.md).

## Router DNS auto-fix

On startup, the Node service checks whether the router resolves `recycling.local.home` to the expected IP. If the lookup fails or returns the wrong address, it SSHes into the router and idempotently re-applies the `server=/local.home/...` line in `/etc/dnsmasq.conf`, then restarts dnsmasq. The check is non-fatal: if SSH fails, it logs and continues.

Implemented in [server/src/routerDns.ts](../server/src/routerDns.ts), called once from [server/src/index.ts](../server/src/index.ts) right after `app.listen`.

Environment variables (all in production `.env`):

| Var | Production value | Purpose |
|-----|------------------|---------|
| `ROUTER_DNS_AUTOFIX` | `true` | Master switch (default `false` so dev runs don't SSH anywhere) |
| `ROUTER_HOST` | `192.168.50.1` | Router IP, used both as DNS server for the check and SSH target |
| `ROUTER_SSH_PORT` | `1025` | Router's SSH port |
| `ROUTER_SSH_USER` | `admin` | SSH user |
| `ROUTER_SSH_KEY` | `C:\Users\thoma\.ssh\id_ed25519` | Absolute path to the private key |
| `LOCAL_HOSTNAME` | `recycling.local.home` | Hostname to verify |
| `LOCAL_HOST_IP` | `192.168.50.94` | Expected resolved address |

### SSH key trade-off

The current setup reuses the user's key at `C:\Users\thoma\.ssh\id_ed25519`. The recycling-booker service runs as `LocalSystem`, which can read any file on disk, so this works. The corresponding public key is registered with the router via the web UI (Administration → System → Authorized Keys), which persists in nvram across router reboots.

The downside: if the `thoma` Windows profile is ever removed or its `.ssh` folder ACL is tightened, auto-fix breaks. To switch to a dedicated service-owned key later, generate a new keypair under `C:\services\recycling-booker\.ssh\`, register the new pubkey in the router web UI, and point `ROUTER_SSH_KEY` at it.

### Log lines

Look for the `[router-dns]` prefix in `service-stdout.log`:

- `[router-dns] OK: recycling.local.home -> 192.168.50.94` — already correct, no action taken.
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
- **Phone can't reach `recycling.local.home`.** Almost always router DNS — see [router-dns-setup.md](router-dns-setup.md). Quick test: `nslookup recycling.local.home 192.168.50.1` from the PC.
- **NSSM env edits don't take effect.** `nssm set ... AppEnvironmentExtra ...` requires a service restart (`Restart-Service recycling-booker`) before new env vars are visible to the Node process.
- **`.env` `PORT=3000` is ignored in production.** That's intentional; the NSSM `AppEnvironmentExtra` overrides it to 3100 to match the Caddy upstream. Don't "fix" the `.env`.
