# Starts the email-OTP backend (send_otp.php / verify_otp.php) on http://localhost:8090
# — the URL the scholar app targets by default (ApiConfig.otpBaseUrl).
#
# Run this BEFORE using the app's email verification / password-reset flows.
# Usage:  powershell -ExecutionPolicy Bypass -File php-otp\start-otp-server.ps1

$ErrorActionPreference = 'Stop'
$docroot = $PSScriptRoot
$port    = 8090

# ── Locate a PHP CLI binary ──────────────────────────────────────────────────
$php = $null
$cmd = Get-Command php -ErrorAction SilentlyContinue
if ($cmd) { $php = $cmd.Source }

if (-not $php) {
    $candidates = @()
    # Laragon (newest version first), then XAMPP / standalone.
    $candidates += Get-ChildItem "C:\laragon\bin\php" -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object { Join-Path $_.FullName 'php.exe' }
    $candidates += @("C:\xampp\php\php.exe", "C:\php\php.exe")
    $php = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $php) {
    Write-Error "PHP was not found. Install PHP (or Laragon/XAMPP) or add php.exe to PATH."
    exit 1
}

# ── Warn if the port is already in use ───────────────────────────────────────
$busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host "Port $port is already in use (the OTP server may already be running)." -ForegroundColor Yellow
    exit 0
}

Write-Host "Starting OTP backend with $php" -ForegroundColor Cyan
Write-Host "  -> http://localhost:$port  (Ctrl+C to stop)" -ForegroundColor Cyan
& $php -S "localhost:$port" -t $docroot
