# IT-Ideenforum – Hinweise für Claude Code

Lokales Projekt-/Ticket-Dashboard. Node.js + Express 4, Vanilla-JS-Frontend
(kein Framework, kein Build-Schritt), Datenhaltung als JSON-Dateien unter
`data/projects/<id>/`. Fachliche Doku: `README.md`.

## Starten & Testen

- `npm start` → http://localhost:3000, lauscht nur auf 127.0.0.1 (`HOST`/`PORT`/`DATA_DIR`/`BACKUP_*` in `.env`, Vorlage `.env.example`). `PORT=3105 npm start` für Testserver, damit ein laufender Nutzer-Server nicht stört
- `npm test` → automatische Tests (`node:test`, Ordner `test/`), laufen in GitHub Actions bei jedem Push und vor jedem Release. Tests nutzen eigene Temp-Ordner über `DATA_DIR`/`BACKUP_DIR` und fassen `data/` nie an
- `npm run seed` → Demo-Projekt `metid-workflow-web-0001` mit 27 Tickets (löscht KEINE bestehenden Projekte; Testprojekte danach von Hand entfernen, `data/backups` leeren)
- `npm run package` → `dist/IT-Ideenforum-v<version>.zip`, lauffähiges Startpaket (ohne `zip`, z. B. Git Bash, nutzt das Skript PowerShell `Compress-Archive`)
- UI-Änderungen immer im Browser prüfen (Playwright), nicht nur per curl. Nach Tests alles zurücksetzen.

## Konventionen

- Sprache: Deutsch für UI-Texte, Fehlermeldungen, Kommentare und Commit-Messages
- Kommentare nur, wenn das WARUM nicht offensichtlich ist; keine WAS-Kommentare
- Keine neuen Abhängigkeiten ohne Rückfrage
- **Express 4 reicht Fehler aus `async`-Routen nicht weiter** – jede async-Route braucht `try/catch`, sonst bleibt die Anfrage hängen oder der Prozess bricht ab
- Gültige Ticket-Werte (Kategorie, Schweregrad, Status) liegen zentral in `server/lib/ticket-values.js` – nirgendwo kopieren
- Ticket-Nummern vergibt `createTicket` dreistellig (`#001`); Titel mit vorhandener `#NNN`-Nummer bleiben unverändert
- Beim Import werden Schreibvarianten über `matchValue` normalisiert, Unbekanntes wird gemeldet

## Versionierung & Git

- **Jede funktionale Änderung zählt `version` in `package.json` hoch**: Patch für Fixes (1.1.2 → 1.1.3), Minor für Features (→ 1.2.0). Dafür `npm version patch|minor --no-git-tag-version`, das hält `package-lock.json` synchron
- Ein Commit pro Ticket/Thema, Commit-Message erklärt das Warum; danach `git push origin main`
- Release: Tag `v<version>` pushen → GitHub Actions testet, baut das ZIP und hängt es an das Release. „Latest“ wird nur gesetzt, wenn der Tag die höchste Version ist
- Nie committen: `data/`, `dist/`, `*-key.txt`, `litellm-url.txt`, `custom-models.json`, `system-prompts.json`, `fetched-models.json` (alles in `.gitignore`)

## Arbeitsweise bei Tickets

1. Betroffene Stellen lesen, kurzen Plan nennen (Dateien, Schritte, Tests)
2. Umsetzen, dabei nur das Ticket – kein Refactoring nebenbei
3. Selbst prüfen: `node -c`, Server auf Testport, curl + Browser
4. Version hochzählen, committen, pushen, `npm run package`
Rückfragen nur bei echten Entscheidungen (Fachlogik, Datenformat), nicht bei Details mit sinnvollem Default.

## Bekannte Stolperfallen

- Projektordner unter **OneDrive** → Sync sperrt Dateien, Löschen schlägt fehl. Ordner außerhalb von OneDrive halten.
- Eine global gesetzte `GEMINI_API_KEY` würde den Key aus den Einstellungen überstimmen – `start.bat` leert sie deshalb nur für diesen Prozess.
- Gleiche Modell-ID bei zwei Anbietern (z. B. `claude-sonnet-5` eingebaut und als LiteLLM-Modell) → im Dropdown gewinnt der eigene Eintrag und verdeckt den eingebauten.
- API-Keys liegen im Klartext als Dateien im Projektordner; nie an den Browser zurückgeben.
