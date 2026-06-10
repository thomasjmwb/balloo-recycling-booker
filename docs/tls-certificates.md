# TLS & Certificate Trust

How HTTPS for `recycling.local.home` works, what each device needs to trust,
and how to tell a real certificate problem from something else. Facts below
were established during the June 2026 "phone certificate error" investigation
(which turned out to be a DNS outage, not TLS — see the
[lessons section](#lesson-from-june-2026-cert-errors-that-werent)).

## How it works

Caddy terminates TLS with `tls internal`, meaning it runs its own private CA
("Caddy Local Authority") instead of a public one. Three tiers:

| Cert | Lifetime | Rotation | Devices care? |
|------|----------|----------|---------------|
| Root CA (`CN=Caddy Local Authority - 2026 ECC Root`) | ~10 years (expires **Feb 12, 2036**) | Never (reused from disk) | **Yes** — this is the one every device must trust |
| Intermediate | 7 days | Automatic | No |
| Leaf (served cert) | 12 hours | Automatic | No |

The short leaf/intermediate lifetimes are normal and invisible to clients;
only the root matters for trust.

## Current trust state (as of June 2026)

- Root CA generated **once**, on Caddy's first run (April 5, 2026, the day
  the services were installed — confirmed via Windows event log 7045).
  Thumbprint: `2BC7B3AF7BF137824CDB75669DDB0DE1D964E1F7`.
- **This PC**: Caddy auto-installs the root into the Windows trust stores on
  startup (present in both `Cert:\LocalMachine\Root` and
  `Cert:\CurrentUser\Root`). No manual action ever needed here.
- **Phones**: root installed manually on ~April 10, 2026 (the export used is
  still at `C:\Users\thoma\Downloads\caddy-root-ca.crt`). Valid until 2036.

## Where the CA lives (fragile — read this)

The Caddy service runs as `LocalSystem`, so its data dir is:

```
C:\Windows\System32\config\systemprofile\AppData\Roaming\Caddy\pki\authorities\local\
```

(`root.crt`, `root.key`, plus the intermediate.) Reading it requires an admin
shell.

The root is only regenerated if Caddy can't find these files. That happens if:

1. The data dir is deleted (Windows reinstall, profile cleanup, disk cleaner).
2. The Caddy **service account changes** — a different account means a
   different `AppData`, and Caddy will silently mint a fresh CA.

If a new root is ever minted, **this PC keeps working** (Caddy re-installs
trust locally) **but every phone breaks at once** — a uniquely confusing
failure signature. Mitigations (not yet applied, optional):

- Pin storage with a `storage file_system C:/caddy/data` global option in the
  Caddyfile (copy the existing `pki/` dir across first so the same root is
  reused).
- Back up `pki\authorities\local\` somewhere safe; restore it rather than
  letting Caddy regenerate.

## Diagnostics

### What cert is actually being served?

`curl.exe` (schannel) won't show the chain; use the openssl bundled with Git:

```powershell
'Q' | & 'C:\Program Files\Git\mingw64\bin\openssl.exe' s_client `
  -connect 127.0.0.1:443 -servername recycling.local.home -showcerts
```

Expect: leaf issued by `Caddy Local Authority - ECC Intermediate`, which is
issued by the root. (`Verification error: unable to get local issuer
certificate` from openssl is normal — openssl doesn't read the Windows trust
store.)

### Does the served root match what devices trust?

```powershell
# Root(s) in the Windows trust stores
Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root |
  Where-Object { $_.Subject -match 'Caddy' } |
  Format-List PSParentPath, Subject, NotBefore, NotAfter, Thumbprint

# Thumbprint of a previously exported root (e.g. the one on the phones)
(New-Object Security.Cryptography.X509Certificates.X509Certificate2(
  "$env:USERPROFILE\Downloads\caddy-root-ca.crt")).Thumbprint
```

If the thumbprints match, trust is fine — the problem is elsewhere (DNS).
If they differ, the CA was regenerated: re-export `root.crt` and reinstall it
on every phone.

### Installing the root on a phone

- **Android**: Settings > Security & privacy > More security settings >
  Install from device storage > CA certificate.
- **iPhone**: open the `.crt` > install the profile (Settings > General >
  VPN & Device Management), then **also** toggle it on under Settings >
  General > About > Certificate Trust Settings — skipping the second step is
  the most common mistake.

## Lesson from June 2026: "cert errors" that weren't

Both phones reported certificate errors while the PC worked. The TLS layer
was completely healthy — the served chain and the phones' installed root
matched exactly. The real cause was router DNS (wiped by a reboot; see
[router-dns-setup.md](router-dns-setup.md)), and the misleading symptoms were:

- A DNS failure can surface on a phone as a **certificate error** rather than
  "site not found" (e.g. an upstream resolver hijacking NXDOMAIN to a server
  whose cert doesn't match the requested hostname).
- "It works on the PC" proves nothing: the PC has
  `127.0.0.1 recycling.local.home` in its `hosts` file *and* Caddy
  self-installs its root locally, so the PC is immune to both DNS and trust
  breakage that takes down every other device.

**Triage order for "phone shows cert error":**

1. `nslookup recycling.local.home 192.168.50.1` — if NXDOMAIN or wrong IP,
   it's DNS; stop here and fix that.
2. Compare root thumbprints (above) — if they differ, the CA regenerated;
   reinstall on devices.
3. Only then suspect the phone itself (profile removed, Android credential
   wipe, iOS trust toggle reset by an OS update).
