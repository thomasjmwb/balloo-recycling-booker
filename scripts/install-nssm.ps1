#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$InstallDir  = "C:\nssm"
$NssmExe     = "$InstallDir\nssm.exe"
$TempZip     = "$env:TEMP\nssm.zip"
$DownloadUrl = "https://nssm.cc/release/nssm-2.24.zip"

if (Test-Path $NssmExe) {
    Write-Host "[=] NSSM already installed at $NssmExe"
    exit 0
}

if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}

Write-Host "[*] Downloading NSSM 2.24..."
Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempZip -UseBasicParsing

Write-Host "[*] Extracting..."
$tempExtract = "$env:TEMP\nssm-extract"
Expand-Archive -Path $TempZip -DestinationPath $tempExtract -Force
Copy-Item "$tempExtract\nssm-2.24\win64\nssm.exe" -Destination $NssmExe -Force
Remove-Item $TempZip, $tempExtract -Recurse -Force

$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($machinePath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$machinePath;$InstallDir", "Machine")
    $env:Path += ";$InstallDir"
    Write-Host "[+] Added $InstallDir to system PATH"
} else {
    Write-Host "[=] $InstallDir already in PATH"
}

Write-Host "[+] NSSM installed at $NssmExe"
