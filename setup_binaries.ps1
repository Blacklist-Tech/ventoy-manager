# Ventoy Manager — Binary Hydration Script
# Automates the setup of official Ventoy binaries for the internal installer.

$vUrl = "https://github.com/ventoy/Ventoy/releases/download/v1.0.99/ventoy-1.0.99-windows.zip"
$vZip = "ventoy.zip"
$vDir = "ventoy_temp"

Write-Host "📡 Downloading official Ventoy binaries..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $vUrl -OutFile $vZip

Write-Host "📦 Extracting core files..." -ForegroundColor Cyan
Expand-Archive -Path $vZip -DestinationPath $vDir

if (!(Test-Path "bin")) {
    New-Item -ItemType Directory -Path "bin"
}

Write-Host "🚀 Deploying to project bin folder..." -ForegroundColor Cyan
# Move everything from the inner folder to the bin folder
$innerFolder = Get-ChildItem -Path $vDir | Select-Object -First 1
Copy-Item -Path "$($innerFolder.FullName)\*" -Destination "bin" -Recurse -Force

Write-Host "🧹 Cleaning up temporary files..." -ForegroundColor Cyan
Remove-Item $vZip -Force
Remove-Item -Recurse $vDir -Force

Write-Host "✅ Ventoy Core Deployment Successful!" -ForegroundColor Green
