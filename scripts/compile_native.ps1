# Compiles all C++ native modules using GCC from MSYS2 ucrt64
$ErrorActionPreference = "Stop"

$CompilerPaths = @(
    "C:\msys64\ucrt64\bin",
    "C:\msys64\mingw64\bin",
    "C:\MinGW\bin"
)

$FoundGpp = $null
foreach ($path in $CompilerPaths) {
    $candidate = Join-Path $path "g++.exe"
    if (Test-Path $candidate) {
        $FoundGpp = $candidate
        $env:PATH = "$path;" + $env:PATH
        break
    }
}

if (-not $FoundGpp) {
    Write-Error "No compatible g++ compiler found in standard paths."
    exit 1
}

Write-Host "Using compiler: $FoundGpp" -ForegroundColor Cyan

$NativeDir = Join-Path $PSScriptRoot "..\src\capture\native"

Write-Host "Compiling enum_screens.cpp..." -ForegroundColor Yellow
& $FoundGpp -O3 -static (Join-Path $NativeDir "enum_screens.cpp") -lgdi32 -luser32 -o (Join-Path $NativeDir "enum_screens.exe")

Write-Host "Compiling input_injector.cpp..." -ForegroundColor Yellow
& $FoundGpp -O3 -static (Join-Path $NativeDir "input_injector.cpp") -luser32 -o (Join-Path $NativeDir "input_injector.exe")

Write-Host "All native components compiled successfully!" -ForegroundColor Green
