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
  lib/llm.js     Serverseitige LLM-Anbindung (Prompt-Generierung)
public/          Frontend (Vanilla HTML/CSS/JS, kein Framework)
data/projects/   Datenhaltung – pro Projekt ein Ordner, pro Ticket eine JSON-Datei
scripts/seed.js  Erzeugt die Beispieldaten
start.bat        Ein-Klick-Start unter Windows
```

## Claude-Code-Prompt generieren (optional)

Jedes Ticket hat ein Feld **„Claude-Code-Prompt"**. Du kannst es entweder
selbst befüllen (dann auf **Speichern** klicken) oder per Button
**„✨ Prompt generieren"** automatisch aus Titel und Beschreibung erzeugen
lassen. Die Generierung läuft **serverseitig** über die Anthropic-API – der
API-Key liegt niemals im Browser.

So aktivierst du die Generierung:

1. Lege im Projektordner eine Datei **`api-key.txt`** an.
2. Trage dort deinen Anthropic-API-Key hinein (nur den Key, sonst nichts) und speichere.
3. Server neu starten (`start.bat` schließen und erneut doppelklicken).

Ohne Key funktioniert alles andere normal weiter; nur der Button zeigt dann
einen Hinweis. Die Datei `api-key.txt` ist von Git ausgeschlossen und wird nicht
mitgeliefert. Alternativ kann der Key über die Umgebungsvariable
`ANTHROPIC_API_KEY` gesetzt werden; das Modell lässt sich über `LLM_MODEL`
überschreiben (Standard: `claude-opus-5`).

## Datenhaltung

Es wird **keine Datenbank** verwendet – alle Daten liegen als JSON-Dateien
unter `data/projects/`. Jedes Projekt ist ein Ordner mit `project.json` und
einem Unterordner `tickets/`, in dem jedes Ticket als eigene `<id>.json` liegt.

## Ticket-Felder

`id`, `titel`, `beschreibung`, `kategorie` (Frontend/Backend/Infrastruktur/
Prozess), `schweregrad` (Kritisch/Hoch/Mittel/Klein/Recherche), `status`
(Offen/In Arbeit/Erledigt/Zurückgestellt), `claudePrompt` (manuell) sowie
`createdAt`/`updatedAt`.
