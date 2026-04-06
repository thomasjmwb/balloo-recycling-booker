#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$InstallDir  = "C:\caddy"
$CaddyExe    = "$InstallDir\caddy.exe"
$CaddyFile   = "$InstallDir\Caddyfile"
$ServiceName = "caddy"
$TempZip     = "$env:TEMP\caddy_windows_amd64.zip"

if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
    Write-Host "[+] Created $InstallDir"
}

Write-Host "[*] Resolving latest Caddy release..."
$release  = Invoke-RestMethod "https://api.github.com/repos/caddyserver/caddy/releases/latest"
$tag      = $release.tag_name
$version  = $tag.TrimStart("v")
$assetUrl = "https://github.com/caddyserver/caddy/releases/download/$tag/caddy_${version}_windows_amd64.zip"
Write-Host "[*] Latest version: $version"

Write-Host "[*] Downloading $assetUrl ..."
Invoke-WebRequest -Uri $assetUrl -OutFile $TempZip -UseBasicParsing

Write-Host "[*] Extracting to $InstallDir ..."
Expand-Archive -Path $TempZip -DestinationPath $InstallDir -Force
Remove-Item $TempZip -Force

if (!(Test-Path $CaddyExe)) {
    Write-Error "caddy.exe not found after extraction."
    exit 1
}
Write-Host "[+] caddy.exe installed at $CaddyExe"

$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($machinePath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$machinePath;$InstallDir", "Machine")
    $env:Path += ";$InstallDir"
    Write-Host "[+] Added $InstallDir to system PATH"
} else {
    Write-Host "[=] $InstallDir already in PATH"
}

if (!(Test-Path $CaddyFile)) {
    @"
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
"@ | Set-Content -Path $CaddyFile -Encoding UTF8
    Write-Host "[+] Starter Caddyfile written to $CaddyFile"
} else {
    Write-Host "[=] Caddyfile already exists -- skipping"
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    sc.exe config $ServiceName binPath= "`"$CaddyExe`" run --config `"$CaddyFile`"" | Out-Null
    Write-Host "[=] Service '$ServiceName' updated"
} else {
    sc.exe create $ServiceName binPath= "`"$CaddyExe`" run --config `"$CaddyFile`"" start= auto DisplayName= "Caddy Web Server"
    Write-Host "[+] Service '$ServiceName' created"
}

$svc = Get-Service -Name $ServiceName
if ($svc.Status -ne "Running") {
    Start-Service $ServiceName
    Write-Host "[+] Service '$ServiceName' started"
} else {
    Write-Host "[=] Service '$ServiceName' is already running"
}

Write-Host ""
& $CaddyExe version
Write-Host ""
Write-Host "Done. Caddy is installed at $InstallDir and running as a Windows service."
Write-Host "Edit $CaddyFile then run:  caddy reload --config $CaddyFile"
