#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Redeploy a fresh build of recycling-booker to C:\services\recycling-booker.

.DESCRIPTION
  Stops the recycling-booker NSSM service, mirrors server/dist and client/dist
  into the production directory, restarts the service, and tails the new log
  output until a [router-dns] line appears or 30s have passed.

  Run from an elevated PowerShell:
      pwsh .\scripts\deploy.ps1
  or
      powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1
#>

$ErrorActionPreference = 'Stop'

$repoRoot   = Split-Path -Parent $PSScriptRoot
$prodRoot   = 'C:\services\recycling-booker'
$serverSrc  = Join-Path $repoRoot 'server\dist'
$clientSrc  = Join-Path $repoRoot 'client\dist'
$serverDst  = Join-Path $prodRoot 'server\dist'
$clientDst  = Join-Path $prodRoot 'client\dist'
$serviceName = 'recycling-booker'
$stdoutLog  = Join-Path $prodRoot 'data\service-stdout.log'

if (-not (Test-Path $serverSrc)) { throw "Missing $serverSrc - run 'npm run build' first." }
if (-not (Test-Path $clientSrc)) { throw "Missing $clientSrc - run 'npm run build' first." }

Write-Host "Stopping $serviceName..." -ForegroundColor Cyan
Stop-Service $serviceName -Force
$sw = [Diagnostics.Stopwatch]::StartNew()
while ((Get-Service $serviceName).Status -ne 'Stopped' -and $sw.Elapsed.TotalSeconds -lt 15) {
    Start-Sleep -Milliseconds 500
}
if ((Get-Service $serviceName).Status -ne 'Stopped') {
    throw "Service did not stop within 15s."
}

Write-Host "Mirroring server\dist..." -ForegroundColor Cyan
robocopy $serverSrc $serverDst /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy server failed (exit $LASTEXITCODE)" }

Write-Host "Mirroring client\dist..." -ForegroundColor Cyan
robocopy $clientSrc $clientDst /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy client failed (exit $LASTEXITCODE)" }

Write-Host "Starting $serviceName..." -ForegroundColor Cyan
Start-Service $serviceName
$sw.Restart()
while ((Get-Service $serviceName).Status -ne 'Running' -and $sw.Elapsed.TotalSeconds -lt 15) {
    Start-Sleep -Milliseconds 500
}
$status = (Get-Service $serviceName).Status
Write-Host "Service status: $status" -ForegroundColor Green

Write-Host ""
Write-Host "Health check on http://127.0.0.1:3100/api/health:" -ForegroundColor Cyan
try {
    $resp = (New-Object Net.WebClient).DownloadString('http://127.0.0.1:3100/api/health')
    Write-Host $resp -ForegroundColor Green
} catch {
    Write-Host "  Failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Watching $stdoutLog for [router-dns] lines (max 30s)..." -ForegroundColor Cyan
$timeout = (Get-Date).AddSeconds(30)
$found = $false
while ((Get-Date) -lt $timeout) {
    if (Test-Path $stdoutLog) {
        $tail = Get-Content $stdoutLog -Tail 50 -ErrorAction SilentlyContinue
        $hits = $tail | Select-String 'router-dns'
        if ($hits) {
            $hits | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
            $found = $true
            break
        }
    }
    Start-Sleep -Milliseconds 500
}
if (-not $found) {
    Write-Host "  No [router-dns] line yet. Tail manually with:" -ForegroundColor Yellow
    Write-Host "    Get-Content -Wait $stdoutLog | Select-String router-dns" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
