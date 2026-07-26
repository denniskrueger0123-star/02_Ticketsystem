# PowerShell-Skript zum Installieren von Node.js (LTS)
# Ausführung: PowerShell öffnen, in diesen Ordner navigieren, dann:
#   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
#   .\install-nodejs.ps1

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Node.js LTS Installation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Prüfe, ob Node.js bereits installiert ist
if (Get-Command node -ErrorAction SilentlyContinue) {
    $version = node --version
    Write-Host "[OK] Node.js ist bereits installiert: $version" -ForegroundColor Green
    exit 0
}

Write-Host "Node.js wird heruntergeladen und installiert..." -ForegroundColor Yellow
Write-Host ""

# Download-URL für LTS (x64)
$url = "https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi"
$installer = "$env:TEMP\nodejs-installer.msi"

Write-Host "Lade herunter: $url"
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
    Write-Host "[OK] Download abgeschlossen" -ForegroundColor Green
} catch {
    Write-Host "[FEHLER] Download fehlgeschlagen: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starte Installation (Fenster öffnet sich)..." -ForegroundColor Yellow
Write-Host ""

# Starte MSI-Installer
$process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $installer, "/quiet", "/norestart" -Wait -PassThru

if ($process.ExitCode -eq 0) {
    Write-Host "[OK] Node.js wurde erfolgreich installiert!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Starte PowerShell neu, um node-Befehl zu nutzen..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2

    # Aktualisiere PATH für aktuelle Session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    if (Get-Command node -ErrorAction SilentlyContinue) {
        $v = node --version
        Write-Host "[OK] Bestätigung: $v verfügbar" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Nächste Schritte:" -ForegroundColor Cyan
    Write-Host "  1. Dieses Fenster schließen" -ForegroundColor White
    Write-Host "  2. Im IT-Ideenforum-Ordner start.bat doppelklicken" -ForegroundColor White
} else {
    Write-Host "[FEHLER] Installation fehlgeschlagen (Code: $($process.ExitCode))" -ForegroundColor Red
    exit 1
}

# Aufräumen
Remove-Item $installer -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Drücke Enter zum Beenden..."
Read-Host
