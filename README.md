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

### API-Keys eintragen: über die Einstellungsseite (empfohlen)

Oben rechts im Header findest du den Link **„⚙ Einstellungen"**
(<http://localhost:3000/settings.html>). Dort siehst du alle drei Anbieter mit
Status (grüner Punkt = Key hinterlegt), kannst einen Key einfügen, auf
**„Speichern"** klicken und ihn bei Bedarf wieder **„Löschen"**. Der Key wird
serverseitig in die passende Datei (`api-key.txt`, `gemini-key.txt`,
`openai-key.txt`) geschrieben – kein manuelles Anlegen von Dateien mehr nötig.

### Unterstützte Anbieter & Modelle

| Anbieter | Modelle (günstig → stark) | Key-Datei | API-Key bekommst du bei |
|----------|---------------------------|-----------|-------------------------|
| Claude (Anthropic) | Haiku 4.5 · Sonnet 5 · Opus 5 | `api-key.txt` | console.anthropic.com |
| Google Gemini | 3.6 Flash · 2.5 Pro | `gemini-key.txt` | aistudio.google.com (kostenloser Tarif) |
| OpenAI (ChatGPT) | GPT-4o mini · GPT-4o | `openai-key.txt` | platform.openai.com (pay-per-use) |

**Wichtig zu Gemini Pro:** Google setzt für manche Modelle (z. B. 2.5 Pro) das
kostenlose Kontingent auf 0, solange kein Billing-Konto mit dem
Google-Cloud-Projekt verknüpft ist. Fix: console.cloud.google.com → Projekt →
Billing → Zahlungsmethode hinterlegen. Der kostenlose Tarif bleibt dabei
kostenlos, wird aber erst durch die Verknüpfung freigeschaltet. Gemini 3.6
Flash läuft normalerweise auch ohne Billing.

**Ein Key deckt alle Modelle eines Anbieters ab** – du brauchst nicht mehrere
Keys pro Anbieter für z. B. Flash und Pro oder Haiku und Opus. Die
Modellwahl im Dropdown steuert, welches Modell mit demselben Key
angesprochen wird.

**Wichtig:** Ein ChatGPT-/Gemini-*Abo* ist **nicht** dasselbe wie ein API-Key.
Für das Tool brauchst du je Anbieter einen eigenen API-Key (siehe Spalte oben).

### So aktivierst du einen Anbieter

**Variante A – Einstellungsseite (einfachste Methode):** Key im Browser unter
„⚙ Einstellungen" einfügen und auf „Speichern" klicken. Kein Neustart nötig.

**Variante B – manuell per Datei:**
1. Lege im Projektordner die passende Key-Datei an (z. B. `gemini-key.txt`).
2. Trage nur deinen API-Key hinein und speichere.
3. Server neu starten (`start.bat` schließen und erneut doppelklicken).

Du kannst mehrere Anbieter parallel einrichten und im Dropdown umschalten.
Anbieter ohne hinterlegten Key sind im Dropdown mit „(Key fehlt)" markiert; ein
Klick auf Generieren zeigt dann einen Hinweis, welche Datei fehlt. Alternativ
lassen sich die Keys über die Umgebungsvariablen `ANTHROPIC_API_KEY`,
`GEMINI_API_KEY`, `OPENAI_API_KEY` setzen; das Standardmodell über `LLM_MODEL`.

### Eigene KI-Anweisungen pro Projekt

Im Projekt oben auf **„✏ KI-Anweisungen"** klicken, um projektweite
Zusatzanweisungen zu hinterlegen (z. B. „Verwende TypeScript", „Schreibe Tests
mit Vitest", „Achte auf Barrierefreiheit"). Diese werden bei **jeder**
Prompt-Generierung in diesem Projekt automatisch an das Modell mitgeschickt –
zusätzlich zu Titel, Beschreibung, Kategorie, Schweregrad und Status des
jeweiligen Tickets.

## Boss Move – mehrere Tickets zu einem Super-Prompt bündeln

Manchmal willst du nicht für jedes Ticket einzeln einen Prompt, sondern **einen
übergreifenden „Super-Prompt"** für mehrere zusammengehörige Tickets. Dafür gibt
es den **Boss-Move-Status (BM)**:

1. Bei jedem Ticket kannst du den **BM-Schalter** auf grün setzen (Button „🟢 BM"
   auf der Karte, Checkbox im Bearbeiten-Dialog oder Spalte „BM" in der
   Übersicht). Über die Filterzeile **„BM Status"** blendest du gezielt die grün
   markierten Tickets ein.
2. Oben auf **„🟢 Boss Move"** klicken (zeigt in Klammern, wie viele Tickets
   markiert sind). Im Dialog hinterlegst du eine **separate KI-Anweisung**, die
   nur für den Super-Prompt gilt und **unabhängig** von den normalen
   „✏ KI-Anweisungen" ist.
3. **„✨ Super-Prompt generieren"** fasst alle grün markierten Tickets zu einem
   einzigen, stimmigen Prompt zusammen (Modellwahl über dasselbe „KI-Modell"-
   Dropdown). Das Ergebnis kannst du kopieren; es wird im Projekt gespeichert.

## Projekte exportieren & importieren

Auf der Startseite hat jede Projektkarte einen Button **„Exportieren"** (auch im
Projekt oben über **„⭳ Export"**). Damit lädst du das **komplette Projekt inkl.
aller Tickets** als eine JSON-Datei herunter. Die Datei ist bewusst
menschen- und KI-lesbar aufgebaut (Projektname, Beschreibung, KI-Anweisungen und
eine `tickets`-Liste mit Titel, Beschreibung, Kategorie, Schweregrad, Status und
Prompt).

**Typischer Ablauf mit externer KI:**

1. Projekt **exportieren** (z. B. mit 10 Tickets).
2. Die JSON-Datei in eine beliebige externe KI/Anwendung geben, dort auslesen,
   verändern oder um neue Tickets ergänzen lassen.
3. Die bearbeitete Datei über **„⭱ Projekt importieren"** (Startseite, oben)
   wieder hochladen.

Der Import legt daraus **immer ein neues Projekt** an – dein Original bleibt
unangetastet, es kann also nichts verloren gehen. Danach kannst du das alte
Projekt bei Bedarf löschen. Interne IDs und Zeitstempel werden beim Import
frisch vergeben; als Pflichtfeld genügt der Projekt-`name`.

## Datenhaltung

Es wird **keine Datenbank** verwendet – alle Daten liegen als JSON-Dateien
unter `data/projects/`. Jedes Projekt ist ein Ordner mit `project.json` und
einem Unterordner `tickets/`, in dem jedes Ticket als eigene `<id>.json` liegt.

## Ticket-Felder

`id`, `titel`, `beschreibung`, `kategorie` (Frontend/Backend/Infrastruktur/
Prozess), `schweregrad` (Kritisch/Hoch/Mittel/Klein/Recherche), `status`
(Offen/In Arbeit/Erledigt/Zurückgestellt), `bmStatus` (Boss-Move-Markierung,
true/false), `claudePrompt` (manuell) sowie `createdAt`/`updatedAt`.
