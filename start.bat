@echo off
chcp 65001 >nul
title IT-Ideenforum
cd /d "%~dp0"

echo ============================================
echo   IT-Ideenforum wird gestartet...
echo ============================================
echo.

REM --- Pruefen, ob Node.js installiert ist ---
where node >nul 2>nul
if errorlevel 1 (
    echo [FEHLER] Node.js wurde nicht gefunden.
    echo.
    echo Bitte installiere zuerst Node.js ^(LTS-Version^):
    echo     https://nodejs.org/
    echo.
    echo Danach diese Datei erneut per Doppelklick starten.
    echo.
    pause
    exit /b 1
)

REM --- Abhaengigkeiten installieren, falls node_modules fehlt ---
if not exist "node_modules\express" (
    echo Installiere Abhaengigkeiten ^(einmalig, benoetigt Internet^)...
    call npm install
    if errorlevel 1 (
        echo [FEHLER] npm install ist fehlgeschlagen.
        pause
        exit /b 1
    )
)

echo Server startet auf http://localhost:3000
echo.
echo Der Browser oeffnet sich gleich automatisch.
echo Zum Beenden dieses Fenster schliessen.
echo.

REM --- Nur fuer DIESEN Server-Prozess: eine evtl. global gesetzte
REM     GEMINI_API_KEY-Umgebungsvariable ignorieren, damit stattdessen der
REM     in den Einstellungen (gemini-key.txt) hinterlegte Key verwendet wird.
REM     Aendert NICHTS an der globalen Windows-Variable - andere Programme
REM     auf diesem Rechner sehen weiterhin ihren gewohnten Wert.
set GEMINI_API_KEY=

REM --- Browser nach kurzer Wartezeit oeffnen, dann Server starten ---
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
node server/index.js

pause
