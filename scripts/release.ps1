#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$ServiceName   = "recycling-booker"
$DevPort       = 3000
$ProdPort      = $DevPort + 100
$DeployDir     = "C:\services\$ServiceName"
$PuppeteerCache = "$DeployDir\.cache\puppeteer"
$RepoRoot      = Split-Path -Parent $PSScriptRoot
$NodeExe       = (Get-Command node).Source

Write-Host "=== Release: $ServiceName ==="
Write-Host "[*] Repo root: $RepoRoot"
Write-Host ""

# ============================================================
# Preflight checks
# ============================================================
Write-Host "--- Preflight checks ---"
$preflight_ok = $true

# 1. Node.js
$nodeVersion = (node --version 2>$null)
if ($nodeVersion) {
    Write-Host "[+] Node.js: $nodeVersion ($NodeExe)"
} else {
    Write-Host "[X] Node.js not found in PATH"
    $preflight_ok = $false
}

# 2. NSSM
$nssmPath = (Get-Command nssm -ErrorAction SilentlyContinue)
if ($nssmPath) {
    Write-Host "[+] NSSM: $($nssmPath.Source)"
} else {
    Write-Host "[X] NSSM not found in PATH -- run scripts\install-nssm.ps1 first"
    $preflight_ok = $false
}

# 3. Production .env
if (Test-Path "$DeployDir\.env") {
    Write-Host "[+] Production .env exists"
} else {
    Write-Host "[~] Production .env missing -- will copy from repo"
}

# 4. Port conflict on production port
$portPid = $null
try {
    $netstat = netstat -ano | Select-String "LISTENING" | Select-String ":$ProdPort "
    if ($netstat) {
        $match = $netstat[0].ToString().Trim() -match '\s(\d+)\s*$'
        if ($match) { $portPid = $Matches[1] }
    }
} catch {}

$existingSvc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($portPid) {
    if ($existingSvc -and $existingSvc.Status -eq "Running") {
        Write-Host "[+] Port $ProdPort in use by $ServiceName (PID $portPid) -- will be restarted"
    } else {
        Write-Host "[!] Port $ProdPort in use by PID $portPid (not our service) -- attempting to free it"
        try {
            taskkill /PID $portPid /F /T 2>$null | Out-Null
            Start-Sleep -Seconds 1
            Write-Host "[+] Killed PID $portPid"
        } catch {
            Write-Host "[X] Could not kill PID $portPid -- release may fail"
            $preflight_ok = $false
        }
    }
} else {
    Write-Host "[+] Port $ProdPort is free"
}

# 5. Caddy service
$caddySvc = Get-Service -Name "caddy" -ErrorAction SilentlyContinue
if ($caddySvc -and $caddySvc.Status -eq "Running") {
    Write-Host "[+] Caddy reverse proxy: Running"
} elseif ($caddySvc) {
    Write-Host "[!] Caddy service exists but not running (status: $($caddySvc.Status))"
} else {
    Write-Host "[~] Caddy service not installed -- app will only be accessible via direct port"
}

# 6. CoreDNS service
$dnsSvc = Get-Service -Name "coredns" -ErrorAction SilentlyContinue
if ($dnsSvc -and $dnsSvc.Status -eq "Running") {
    Write-Host "[+] CoreDNS: Running"
} elseif ($dnsSvc) {
    Write-Host "[!] CoreDNS service exists but not running (status: $($dnsSvc.Status))"
} else {
    Write-Host "[~] CoreDNS not installed -- recycling.local.home DNS won't resolve"
}

if (-not $preflight_ok) {
    Write-Error "Preflight checks failed. Fix the issues above and re-run."
    exit 1
}

Write-Host ""
Write-Host "[+] Preflight checks passed"
Write-Host ""

# ============================================================
# 1. Build
# ============================================================
Write-Host "--- Build ---"
Push-Location $RepoRoot
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed."; exit 1 }
Pop-Location
Write-Host ""

# ============================================================
# 2. Deploy files
# ============================================================
Write-Host "--- Deploy ---"

if (!(Test-Path $DeployDir)) {
    New-Item -ItemType Directory -Path $DeployDir -Force | Out-Null
}

Write-Host "[*] Syncing files to $DeployDir ..."

robocopy "$RepoRoot\server\dist" "$DeployDir\server\dist" /MIR /NJH /NJS /NDL /NC /NS | Out-Null
robocopy "$RepoRoot\server\node_modules" "$DeployDir\server\node_modules" /MIR /NJH /NJS /NDL /NC /NS | Out-Null
Copy-Item "$RepoRoot\server\package.json" -Destination "$DeployDir\server\package.json" -Force
robocopy "$RepoRoot\client\dist" "$DeployDir\client\dist" /MIR /NJH /NJS /NDL /NC /NS | Out-Null

if (!(Test-Path "$DeployDir\.env")) {
    Copy-Item "$RepoRoot\.env" -Destination "$DeployDir\.env"
    Write-Host "[+] Copied .env to deploy dir (edit C:\services\$ServiceName\.env for production)"
}

if (!(Test-Path "$DeployDir\data")) {
    New-Item -ItemType Directory -Path "$DeployDir\data" | Out-Null
}

Write-Host "[+] Files synced"
Write-Host ""

# ============================================================
# 3. Puppeteer Chrome
# ============================================================
Write-Host "--- Puppeteer Chrome ---"

if (!(Test-Path $PuppeteerCache)) {
    New-Item -ItemType Directory -Path $PuppeteerCache -Force | Out-Null
}

$chromeFound = $false
if (Test-Path $PuppeteerCache) {
    $chromeBins = Get-ChildItem -Path $PuppeteerCache -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue
    if ($chromeBins) { $chromeFound = $true }
}

if ($chromeFound) {
    Write-Host "[+] Chrome found in $PuppeteerCache"
    Write-Host "    $($chromeBins[0].FullName)"
} else {
    Write-Host "[*] Chrome not found -- installing via Puppeteer..."
    Push-Location "$DeployDir\server"
    $env:PUPPETEER_CACHE_DIR = $PuppeteerCache
    npx puppeteer browsers install chrome
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Chrome install failed. Try manually: npx puppeteer browsers install chrome --path `"$PuppeteerCache`""
        exit 1
    }
    Remove-Item Env:\PUPPETEER_CACHE_DIR
    Pop-Location
    Write-Host "[+] Chrome installed"
}

Write-Host ""

# ============================================================
# 4. NSSM service
# ============================================================
Write-Host "--- Service ---"

$envExtra = @(
    "NODE_ENV=production",
    "PORT=$ProdPort",
    "PUPPETEER_CACHE_DIR=$PuppeteerCache"
)

if (!$existingSvc) {
    Write-Host "[*] Creating NSSM service '$ServiceName'..."
    nssm install $ServiceName $NodeExe "$DeployDir\server\dist\index.js"
    nssm set $ServiceName AppDirectory $DeployDir
    nssm set $ServiceName AppEnvironmentExtra $envExtra
    nssm set $ServiceName DisplayName "Recycling Booker"
    nssm set $ServiceName Description "Balloo recycling centre booking PWA"
    nssm set $ServiceName Start SERVICE_AUTO_START
    nssm set $ServiceName AppStdout "$DeployDir\data\service-stdout.log"
    nssm set $ServiceName AppStderr "$DeployDir\data\service-stderr.log"
    nssm set $ServiceName AppRotateFiles 1
    nssm set $ServiceName AppRotateBytes 1048576
    Write-Host "[+] Service created"
} else {
    Write-Host "[=] Service '$ServiceName' already exists -- updating"
    nssm set $ServiceName Application $NodeExe
    nssm set $ServiceName AppParameters "$DeployDir\server\dist\index.js"
    nssm set $ServiceName AppDirectory $DeployDir
    nssm set $ServiceName AppEnvironmentExtra $envExtra
}

Write-Host ""

# ============================================================
# 5. Restart
# ============================================================
Write-Host "--- Restart ---"
nssm restart $ServiceName 2>$null
if ($LASTEXITCODE -ne 0) {
    nssm start $ServiceName
}

Start-Sleep -Seconds 3
$svc = Get-Service -Name $ServiceName
Write-Host "[+] Service status: $($svc.Status)"

if ($svc.Status -ne "Running") {
    Write-Host "[X] Service failed to start -- check $DeployDir\data\service-stderr.log"
    Get-Content "$DeployDir\data\service-stderr.log" -Tail 10
    exit 1
}

Write-Host ""

# ============================================================
# 6. Health check
# ============================================================
Write-Host "--- Health check ---"
$healthOk = $false
for ($i = 1; $i -le 3; $i++) {
    try {
        $health = Invoke-RestMethod "http://127.0.0.1:$ProdPort/api/health" -TimeoutSec 5
        Write-Host "[+] OK: $($health.status) at $($health.timestamp)"
        $healthOk = $true
        break
    } catch {
        if ($i -lt 3) {
            Write-Host "[~] Attempt $i failed, retrying in 2s..."
            Start-Sleep -Seconds 2
        }
    }
}

if (-not $healthOk) {
    Write-Host "[X] Health check failed after 3 attempts"
    Write-Host "[*] Recent stderr:"
    Get-Content "$DeployDir\data\service-stderr.log" -Tail 15
    exit 1
}

# ============================================================
# 7. Caddy reload (if running)
# ============================================================
$caddySvc = Get-Service -Name "caddy" -ErrorAction SilentlyContinue
if ($caddySvc -and $caddySvc.Status -eq "Running") {
    Write-Host "[*] Reloading Caddy config..."
    $caddyOutput = caddy reload --config C:\caddy\Caddyfile 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[+] Caddy reloaded"
    } else {
        Write-Host "[~] Caddy reload returned non-zero (may already be current)"
        Write-Host "    $caddyOutput"
    }
}

Write-Host ""
Write-Host "=== Release complete ==="
Write-Host "  Service:   $ServiceName"
Write-Host "  Deploy:    $DeployDir"
Write-Host "  Logs:      $DeployDir\data\service-*.log"
Write-Host "  Requests:  $DeployDir\data\logs\requests.log"
Write-Host "  URL:       https://recycling.local.home (via Caddy)"
Write-Host "  Direct:    http://127.0.0.1:$ProdPort"
