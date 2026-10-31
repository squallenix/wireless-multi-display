<#
.SYNOPSIS
    Automated Helper to Install / Configure the Virtual Display Driver (VDD) on Windows.
.DESCRIPTION
    Uses the Microsoft Indirect Display Driver (IddCx) open-source implementation
    (Virtual-Display-Driver by itsmikethetech) to create genuine 2nd, 3rd, and 4th
    virtual monitors that Windows recognizes as physical cable-connected displays.
#>

[CmdletBinding()]
param(
    [switch]$DownloadOnly,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   AegisDisplay - Virtual Display Driver Setup        " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

$VddDir = Join-Path $PSScriptRoot "..\drivers\vdd"
if (-not (Test-Path $VddDir)) {
    New-Item -ItemType Directory -Force -Path $VddDir | Out-Null
}

$LatestReleaseUrl = "https://github.com/itsmikethetech/Virtual-Display-Driver/releases/latest"
Write-Host "`nThe Virtual Display Driver (VDD) enables Windows to create" -ForegroundColor White
Write-Host "real secondary & tertiary virtual monitors without dummy plugs.`n" -ForegroundColor White

Write-Host "Steps to enable 2nd / 3rd virtual monitors on Windows:" -ForegroundColor Yellow
Write-Host "1. Download the latest release from:" -ForegroundColor White
Write-Host "   https://github.com/itsmikethetech/Virtual-Display-Driver/releases" -ForegroundColor Cyan
Write-Host "2. Extract the ZIP into: $VddDir" -ForegroundColor White
Write-Host "3. Right-click 'vdd_settings.xml' to customize your virtual monitor resolution" -ForegroundColor White
Write-Host "   (e.g., 1920x1080@60Hz for laptops, or 1080x2400 for smartphones)." -ForegroundColor White
Write-Host "4. Right-click 'device-installer.bat' and select 'Run as Administrator'." -ForegroundColor White
Write-Host "5. Open Windows Settings -> System -> Display." -ForegroundColor White
Write-Host "   You will see 'Monitor 2' appear as an active extended display!" -ForegroundColor Green
Write-Host "`nOnce added, restart AegisDisplay and your laptop/phone can bind directly to Monitor 2!`n" -ForegroundColor Green
