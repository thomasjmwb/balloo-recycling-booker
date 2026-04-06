#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$InstallDir  = "C:\coredns"
$CoreDnsExe  = "$InstallDir\coredns.exe"
$CoreFile    = "$InstallDir\Corefile"
$ServiceName = "coredns"
$TempZip     = "$env:TEMP\coredns_windows_amd64.zip"
$LanIP       = "192.168.50.94"
$RouterDNS   = "192.168.50.1"

if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
    Write-Host "[+] Created $InstallDir"
}

# --- Download latest CoreDNS ---
Write-Host "[*] Resolving latest CoreDNS release..."
$release  = Invoke-RestMethod "https://api.github.com/repos/coredns/coredns/releases/latest"
$tag      = $release.tag_name
$version  = $tag.TrimStart("v")
$assetUrl = "https://github.com/coredns/coredns/releases/download/$tag/coredns_${version}_windows_amd64.tgz"
Write-Host "[*] Latest version: $version"

Write-Host "[*] Downloading $assetUrl ..."
$tgzPath = "$env:TEMP\coredns.tgz"
Invoke-WebRequest -Uri $assetUrl -OutFile $tgzPath -UseBasicParsing

Write-Host "[*] Extracting..."
$tarPath = "$env:TEMP\coredns.tar"
# .tgz is gzip'd tar -- use tar to extract (available on Windows 10+)
tar -xzf $tgzPath -C $InstallDir
Remove-Item $tgzPath -Force -ErrorAction SilentlyContinue

if (!(Test-Path $CoreDnsExe)) {
    Write-Error "coredns.exe not found after extraction."
    exit 1
}
Write-Host "[+] coredns.exe installed at $CoreDnsExe"

# --- Add to PATH ---
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($machinePath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$machinePath;$InstallDir", "Machine")
    $env:Path += ";$InstallDir"
    Write-Host "[+] Added $InstallDir to system PATH"
} else {
    Write-Host "[=] $InstallDir already in PATH"
}

# --- Write Corefile ---
if (!(Test-Path $CoreFile)) {
    @"
local.home {
    template IN A {
        answer "{{ .Name }} 60 IN A $LanIP"
    }
}

. {
    forward . $RouterDNS
    cache 30
}
"@ | Set-Content -Path $CoreFile -Encoding UTF8
    Write-Host "[+] Corefile written to $CoreFile"
} else {
    Write-Host "[=] Corefile already exists -- skipping"
}

# --- Stop Windows DNS Client to free port 53 ---
$dnsClient = Get-Service -Name "Dnscache" -ErrorAction SilentlyContinue
if ($dnsClient -and $dnsClient.Status -eq "Running") {
    Write-Host "[*] Stopping Windows DNS Client (Dnscache) to free port 53..."
    Stop-Service Dnscache -Force
    Set-Service Dnscache -StartupType Disabled
    Write-Host "[+] Dnscache stopped and disabled"
}

# --- Register NSSM service ---
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[=] Service '$ServiceName' already exists -- updating"
    nssm set $ServiceName Application $CoreDnsExe
    nssm set $ServiceName AppParameters "-conf `"$CoreFile`""
    nssm set $ServiceName AppDirectory $InstallDir
} else {
    Write-Host "[*] Creating NSSM service '$ServiceName'..."
    nssm install $ServiceName $CoreDnsExe "-conf" "`"$CoreFile`""
    nssm set $ServiceName AppDirectory $InstallDir
    nssm set $ServiceName Start SERVICE_AUTO_START
    nssm set $ServiceName DisplayName "CoreDNS"
    nssm set $ServiceName Description "Local DNS resolver for *.local.home"
    nssm set $ServiceName AppStdout "$InstallDir\coredns-stdout.log"
    nssm set $ServiceName AppStderr "$InstallDir\coredns-stderr.log"
    nssm set $ServiceName AppRotateFiles 1
    nssm set $ServiceName AppRotateBytes 1048576
    Write-Host "[+] Service created"
}

# --- Start ---
$svc = Get-Service -Name $ServiceName
if ($svc.Status -ne "Running") {
    Start-Service $ServiceName
    Write-Host "[+] Service '$ServiceName' started"
} else {
    Write-Host "[=] Service '$ServiceName' is already running"
}

# --- Verify ---
Start-Sleep -Seconds 2
Write-Host "[*] Testing DNS resolution..."
try {
    $result = Resolve-DnsName "recycling.local.home" -Server 127.0.0.1 -ErrorAction Stop
    Write-Host "[+] recycling.local.home -> $($result.IPAddress)"
} catch {
    Write-Host "[!] DNS test failed -- check logs at $InstallDir\coredns-stderr.log"
}

Write-Host ""
Write-Host "Done. CoreDNS is running on port 53."
Write-Host "Set WireGuard peer DNS to $LanIP to use it from the phone."
