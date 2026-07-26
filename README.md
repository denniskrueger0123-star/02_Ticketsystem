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
lassen. Oben im Filterbereich wählst du bei **„KI-Modell"** aus, welches
Modell dafür verwendet wird.

Die Generierung läuft **serverseitig** – der API-Key liegt **niemals im
Browser** und wird nicht in Git mitgeliefert.

### Unterstützte Anbieter & Modelle

| Anbieter | Modelle (günstig → stark) | Key-Datei | API-Key bekommst du bei |
|----------|---------------------------|-----------|-------------------------|
| Claude (Anthropic) | Haiku 4.5 · Sonnet 5 · Opus 5 | `api-key.txt` | console.anthropic.com |
| Google Gemini | 2.5 Flash · 2.5 Pro | `gemini-key.txt` | aistudio.google.com (kostenloser Tarif) |
| OpenAI (ChatGPT) | GPT-4o mini · GPT-4o | `openai-key.txt` | platform.openai.com (pay-per-use) |

**Wichtig:** Ein ChatGPT-/Gemini-*Abo* ist **nicht** dasselbe wie ein API-Key.
Für das Tool brauchst du je Anbieter einen eigenen API-Key (siehe Spalte oben).

### So aktivierst du einen Anbieter

1. Lege im Projektordner die passende Key-Datei an (z. B. `gemini-key.txt`).
2. Trage nur deinen API-Key hinein und speichere.
3. Server neu starten (`start.bat` schließen und erneut doppelklicken).

Du kannst mehrere Anbieter parallel einrichten und im Dropdown umschalten.
Anbieter ohne hinterlegten Key sind im Dropdown mit „(Key fehlt)" markiert; ein
Klick auf Generieren zeigt dann einen Hinweis, welche Datei fehlt. Alternativ
lassen sich die Keys über die Umgebungsvariablen `ANTHROPIC_API_KEY`,
`GEMINI_API_KEY`, `OPENAI_API_KEY` setzen; das Standardmodell über `LLM_MODEL`.

## Datenhaltung

Es wird **keine Datenbank** verwendet – alle Daten liegen als JSON-Dateien
unter `data/projects/`. Jedes Projekt ist ein Ordner mit `project.json` und
einem Unterordner `tickets/`, in dem jedes Ticket als eigene `<id>.json` liegt.

## Ticket-Felder

`id`, `titel`, `beschreibung`, `kategorie` (Frontend/Backend/Infrastruktur/
Prozess), `schweregrad` (Kritisch/Hoch/Mittel/Klein/Recherche), `status`
(Offen/In Arbeit/Erledigt/Zurückgestellt), `claudePrompt` (manuell) sowie
`createdAt`/`updatedAt`.
