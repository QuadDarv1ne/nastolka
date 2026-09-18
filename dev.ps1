# dev.ps1 — автозапуск dev-сервера «Настолки» вместе с mini-service мультиплеера (Windows).
#
#   .\dev.ps1          # Next.js (3000) + WebSocket-мультиплеер (3003)
#   .\dev.ps1 -NoMp    # только Next.js
#
# Альтернатива в bash (Linux/macOS/Git Bash): bash dev.sh

param(
  [switch]$NoMp
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$mpProcess = $null

# Путь к bun.exe (npm-обёртки не работают с Start-Process напрямую)
function Find-Bun {
  $cmd = Get-Command bun -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) {
    # Прямой exe
    if ($cmd.Source.EndsWith(".exe")) { return $cmd.Source }
    # npm-обёртка bun.ps1 → реальный exe внутри node_modules
    $candidate = Join-Path (Split-Path $cmd.Source -Parent) "node_modules\bun\bin\bun.exe"
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

try {
  if (-not $NoMp) {
    $mpPort = if ($env:MP_PORT) { $env:MP_PORT } else { "3003" }
    Write-Host "[dev] запуск mini-service мультиплеера (порт $mpPort)..." -ForegroundColor Cyan
    $mpDir = Join-Path $PSScriptRoot "mini-services\nastolka-multiplayer"
    if (-not (Test-Path (Join-Path $mpDir "node_modules"))) {
      Write-Host "[multiplayer] установка зависимостей..."
      $bunExe = Find-Bun
      if ($bunExe) { & $bunExe install } else { npm install }
      Set-Location $mpDir
    }
    Set-Location $mpDir
    $bunExe = Find-Bun
    if ($bunExe) {
      $mpProcess = Start-Process -FilePath $bunExe -ArgumentList "--hot", "index.ts" -PassThru -NoNewWindow
    } else {
      $mpProcess = Start-Process -FilePath "node" -ArgumentList "index.ts" -PassThru -NoNewWindow
    }
    Start-Sleep -Seconds 3
    # Проверяем не процесс, а сам порт — надёжнее (процесс может упасть позже)
    $portListening = (Get-NetTCPConnection -LocalPort $mpPort -State Listen -ErrorAction SilentlyContinue) -ne $null
    if ($portListening) {
      Write-Host "[dev] mini-service запущен и слушает порт $mpPort" -ForegroundColor Green
    } else {
      Write-Host "[dev] ВНИМАНИЕ: mini-service не запустился (порт $mpPort не слушается) — продолжаем без него" -ForegroundColor Yellow
      if ($mpProcess -and -not $mpProcess.HasExited) { Stop-Process -Id $mpProcess.Id -Force -ErrorAction SilentlyContinue }
      $mpProcess = $null
    }
    Set-Location $PSScriptRoot
  } else {
    Write-Host "[dev] мультиплеер отключён (-NoMp)" -ForegroundColor Yellow
  }

  Write-Host "[dev] запуск Next.js на порту 3000..." -ForegroundColor Cyan
  $bunExe = Find-Bun
  if ($bunExe) { & $bunExe run dev } else { npm run dev }
}
finally {
  if ($mpProcess -and -not $mpProcess.HasExited) {
    Write-Host ""
    Write-Host "[dev] остановка mini-service (pid $($mpProcess.Id))..." -ForegroundColor Cyan
    Stop-Process -Id $mpProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
