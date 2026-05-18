# Router DNS Setup for recycling.local.home

> **The recycling-booker service applies these steps automatically on startup**
> via [server/src/routerDns.ts](../server/src/routerDns.ts) (when
> `ROUTER_DNS_AUTOFIX=true`). See the
> [Router DNS auto-fix section in deployment.md](deployment.md#router-dns-auto-fix).
> The manual procedure below is the fallback for when auto-fix is disabled,
> the service is down, or SSH key auth is broken.

## Overview

The ASUS GT-BE98 router runs dnsmasq. We add a `server=` directive to forward
`*.local.home` DNS queries to CoreDNS on the desktop PC (192.168.50.94).
Phone WireGuard DNS is set to `192.168.50.1, 1.1.1.1, 8.8.8.8` so the router
handles local.home resolution while public fallbacks work when the PC is off.

## Manual Restore Steps

If DNS for `recycling.local.home` stops working (e.g. after a router reboot),
SSH into the router and re-apply:

```sh
ssh -p 1025 admin@192.168.50.1
```

Then run:

```sh
echo "server=/local.home/192.168.50.94" >> /etc/dnsmasq.conf
killall dnsmasq
dnsmasq --log-async
```

Verify it works:

```sh
nslookup recycling.local.home 127.0.0.1
```

Expected output should show `Address 1: 192.168.50.94`.

Type `exit` to disconnect.

## Why `service restart_dnsmasq` doesn't work

Stock AsusWRT firmware regenerates `/etc/dnsmasq.conf` from nvram on every
`service restart_dnsmasq` call, wiping any manual additions. The manual
kill/restart approach avoids this.

## Current persistence attempts (not yet working)

- `/jffs/configs/dnsmasq.conf.add` — not supported by stock firmware (Merlin only)
- `nvram set dnsmasq_custom=...` — not supported by stock firmware
- `/jffs/scripts/dnsmasq.postconf` — not called by stock firmware
- JFFS is enabled (`nvram get jffs2_on` = 1) and scripts enabled
  (`nvram get jffs2_scripts` = 1)

## Things to try for persistence

1. **`/jffs/scripts/services-start`** — runs after all services start on boot.
   Script would sleep briefly, append the server line, then restart dnsmasq
   manually. Untested.

2. **`/jffs/scripts/wan-start`** — runs when WAN connection comes up (after
   dnsmasq is configured). Same approach as services-start.

3. **Merlin firmware** — Asuswrt-Merlin for GT-BE98 would natively support
   `dnsmasq.conf.add` and `dnsmasq_custom` nvram. Most reliable long-term fix.

4. **Cron job** — Add a periodic check that verifies the server= line exists
   in /etc/dnsmasq.conf and re-adds it if missing:
   ```sh
   cru a dnsfix "*/5 * * * * grep -q local.home /etc/dnsmasq.conf || (echo 'server=/local.home/192.168.50.94' >> /etc/dnsmasq.conf && killall dnsmasq && dnsmasq --log-async)"
   ```

5. **Move DNS to router entirely** — Skip CoreDNS and add a static address
   record directly in dnsmasq: `address=/recycling.local.home/192.168.50.94`.
   Same persistence problem, but removes the dependency on the PC for DNS
   (only needs the PC for the actual app).
