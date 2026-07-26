# IT-Ideenforum – Projekt-/Ticket-Dashboard

Lokales Web-Tool zur Verwaltung eigener IT-Vorhaben: Projekte anlegen und pro
Projekt Ideen als Tickets sammeln. Jedes Ticket hat ein separates Feld für
einen manuell befüllbaren Claude-Code-Prompt.

## Schnellstart (Windows)

1. Sicherstellen, dass **Node.js** installiert ist (LTS-Version von
   <https://nodejs.org/>). Einmalig – prüfen mit `node --version`.
2. **`start.bat` per Doppelklick** starten.
3. Der Browser öffnet automatisch <http://localhost:3000>.
4. Zum Beenden das schwarze Server-Fenster schließen.

Das Paket enthält bereits die Beispieldaten des Projekts
**„01_MetID Workflow Web"** mit 27 Tickets.

## Schnellstart (Mac/Linux oder manuell)

```bash
npm install      # nur beim ersten Mal nötig (im Paket bereits enthalten)
npm start        # startet den Server auf http://localhost:3000
```

## Beispieldaten neu erzeugen

```bash
npm run seed     # legt das Demo-Projekt inkl. 27 Tickets neu an
```

## Aufbau

```
server/          Node.js/Express-Backend (REST-API)
  index.js       Server-Start
  routes/        Projekt- und Ticket-Endpunkte
  lib/storage.js Lesen/Schreiben der JSON-Dateien
public/          Frontend (Vanilla HTML/CSS/JS, kein Framework)
data/projects/   Datenhaltung – pro Projekt ein Ordner, pro Ticket eine JSON-Datei
scripts/seed.js  Erzeugt die Beispieldaten
start.bat        Ein-Klick-Start unter Windows
```

## Datenhaltung

Es wird **keine Datenbank** verwendet – alle Daten liegen als JSON-Dateien
unter `data/projects/`. Jedes Projekt ist ein Ordner mit `project.json` und
einem Unterordner `tickets/`, in dem jedes Ticket als eigene `<id>.json` liegt.

## Ticket-Felder

`id`, `titel`, `beschreibung`, `kategorie` (Frontend/Backend/Infrastruktur/
Prozess), `schweregrad` (Kritisch/Hoch/Mittel/Klein/Recherche), `status`
(Offen/In Arbeit/Erledigt/Zurückgestellt), `claudePrompt` (manuell) sowie
`createdAt`/`updatedAt`.
