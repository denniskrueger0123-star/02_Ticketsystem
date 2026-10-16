#!/usr/bin/env bash
# Baut ein lauffähiges Startpaket als ZIP: IT-Ideenforum-v<version>.zip in dist/.
# Enthält Quellcode, produktive node_modules (frisch installiert) und die
# Demo-Seed-Daten - unzip + start.bat doppelklicken reicht.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

VERSION=$(node -p "require('./package.json').version")
NAME="IT-Ideenforum-v${VERSION}"
STAGE="$(mktemp -d)/${NAME}"
DIST_DIR="${REPO_ROOT}/dist"
# Staging-Ordner auch bei Abbruch entfernen, sonst bleibt er im Temp-Verzeichnis liegen.
trap 'rm -rf "$(dirname "$STAGE")"' EXIT

echo "Baue ${NAME}.zip ..."

mkdir -p "$STAGE"
cp -r public server scripts package.json package-lock.json README.md start.bat .env.example "$STAGE/"

echo "Installiere produktive Abhängigkeiten..."
(cd "$STAGE" && npm ci --omit=dev --no-audit --no-fund --silent)

echo "Erzeuge Demo-Daten..."
(cd "$STAGE" && node scripts/seed.js)

mkdir -p "$DIST_DIR"
rm -f "$DIST_DIR/${NAME}.zip"
if command -v zip >/dev/null 2>&1; then
  (cd "$(dirname "$STAGE")" && zip -rq "$DIST_DIR/${NAME}.zip" "$NAME")
else
  # Git Bash unter Windows bringt kein zip mit – PowerShell kann es.
  if ! command -v powershell.exe >/dev/null 2>&1; then
    echo "Fehler: weder zip noch powershell.exe gefunden." >&2
    exit 1
  fi
  STAGE_WIN="$(cygpath -w "$STAGE")"
  ZIP_WIN="$(cygpath -w "$DIST_DIR/${NAME}.zip")"
  powershell.exe -NoProfile -Command "Compress-Archive -Path '${STAGE_WIN}' -DestinationPath '${ZIP_WIN}' -Force"
fi


echo "Fertig: dist/${NAME}.zip"
