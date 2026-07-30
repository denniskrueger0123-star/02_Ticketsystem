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

echo "Baue ${NAME}.zip ..."

mkdir -p "$STAGE"
cp -r public server scripts package.json package-lock.json README.md start.bat "$STAGE/"

echo "Installiere produktive Abhängigkeiten..."
(cd "$STAGE" && npm ci --omit=dev --no-audit --no-fund --silent)

echo "Erzeuge Demo-Daten..."
(cd "$STAGE" && node scripts/seed.js)

mkdir -p "$DIST_DIR"
rm -f "$DIST_DIR/${NAME}.zip"
(cd "$(dirname "$STAGE")" && zip -rq "$DIST_DIR/${NAME}.zip" "$NAME")

rm -rf "$(dirname "$STAGE")"

echo "Fertig: dist/${NAME}.zip"
