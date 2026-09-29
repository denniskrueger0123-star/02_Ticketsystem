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
(<http://localhost:3000/settings.html>). Dort siehst du alle Anbieter mit
Status (grüner Punkt = Key hinterlegt), kannst einen Key einfügen, auf
**„Speichern"** klicken und ihn bei Bedarf wieder **„Löschen"**. Der Key wird
serverseitig in die passende Datei (`api-key.txt`, `gemini-key.txt`,
`openai-key.txt`, `litellm-key.txt`) geschrieben – kein manuelles Anlegen von
Dateien mehr nötig.

### Unterstützte Anbieter & Modelle

| Anbieter | Modelle (günstig → stark) | Key-Datei | API-Key bekommst du bei |
|----------|---------------------------|-----------|-------------------------|
| Claude (Anthropic) | Haiku 4.5 · Sonnet 5 · Opus 5 | `api-key.txt` | console.anthropic.com |
| Google Gemini | 3.6 Flash · 2.5 Pro | `gemini-key.txt` | aistudio.google.com (kostenloser Tarif) |
| OpenAI (ChatGPT) | GPT-4o mini · GPT-4o | `openai-key.txt` | platform.openai.com (pay-per-use) |
| Firmen-LLM (LiteLLM-Proxy) | frei wählbar, je nach Freigabe | `litellm-key.txt` | vom Arbeitgeber/Admin (virtueller Key + Basis-URL) |

**Firmen-LLM (LiteLLM-Proxy):** Manche Arbeitgeber betreiben einen eigenen
[LiteLLM](https://www.litellm.ai/)-Proxy-Server, der mehrere KI-Anbieter
zentral bündelt (Kosten-Tracking, Zugriffskontrolle). Der von dir bekommene
Key ist dabei **kein** normaler Anthropic-/Gemini-/OpenAI-Key, sondern gilt
nur gegenüber dem Proxy eurer Firma. Deshalb braucht dieser Anbieter in den
Einstellungen zusätzlich eine **Basis-URL** (die Adresse eures Proxys, z. B.
`https://litellm.deinefirma.de`) – frag deinen Admin danach, ebenso nach der
freigegebenen Modell-ID (Feld „Modell").

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

### Modelle beim Anbieter abrufen

Statt Modell-IDs von Hand zu suchen, kannst du sie direkt beim Anbieter
abfragen: In den Einstellungen steht pro Anbieter der Button
**„🔄 Modelle abrufen"**. Er fragt – mit deinem hinterlegten Key – die
offizielle Modell-Liste ab (Anthropic `/v1/models`, Google
`/v1beta/models`, OpenAI `/v1/models`), filtert auf textgenerierungsfähige
Modelle und legt das Ergebnis lokal in `fetched-models.json` ab. Danach
stehen die Modelle im **„KI-Modell"**-Dropdown zur Auswahl.

Der Abruf passiert **nur auf Klick** – beim Start der App wird nie etwas
nachgeladen, sondern ausschließlich die zuletzt gespeicherte Liste verwendet.
Schlägt ein Abruf fehl (kein Key, ungültiger Key, kein Netz), erscheint eine
klare Meldung und die bisherige Auswahl bleibt unverändert erhalten.

### Modell selbst eintragen (Modelle ändern sich)

Anbieter benennen ihre Modelle regelmäßig um. Deshalb kannst du in den
Einstellungen pro Anbieter neben dem API-Key auch ein **Modell-Feld** ausfüllen
und dort die aktuelle Modell-ID eintragen (z. B. `gemini-3.6-flash`). Dieses
eigene Modell erscheint dann im **„KI-Modell"**-Dropdown im Projekt und wird für
die Generierung verwendet – ganz ohne Code-Änderung. Die vorgegebenen Modelle
bleiben zusätzlich wählbar. „Zurücksetzen" entfernt das eigene Modell wieder.
Gespeichert wird es lokal in `custom-models.json` (nicht in Git). Das Feld
bleibt auch dann nutzbar, wenn du Modelle abrufst – im Dropdown erscheinen
eigene und abgerufene Modelle zusammen, ohne Duplikate.

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

## Idee → Ticket (KI-Entwurf aus Freitext)

Über **„💡 Idee → Ticket"** oben im Projekt beschreibst du eine Idee frei in
Worten. Die KI erzeugt daraus einen **Ticket-Entwurf** mit Titel, Beschreibung,
Kategorie und Schweregrad. Der Entwurf wird **nicht sofort gespeichert**: Du
kannst alle Felder noch anpassen und legst das Ticket erst mit
**„Ticket erstellen"** an; „Verwerfen" bricht ohne Anlage ab.

Als Kontext fließen – sofern befüllt – die projektweiten „KI-Anweisungen" und
das Projekt-Readme mit ein. Verwendet wird dasselbe Modell wie beim
Prompt-Generator (Auswahl im „KI-Modell"-Dropdown).

## Projekt-Readme (Kontext & Projektstand)

Über **„📄 Readme"** hinterlegst du pro Projekt einen Markdown-Text, der den
Projektstand beschreibt. Zwei Wege: **.md-Datei laden** oder direkt eintippen
bzw. einfügen. Der Inhalt wird unter der Filterleiste als **gerendertes
Markdown** angezeigt (Überschriften, Listen, Code, Links) und dient zusätzlich
als Kontext für „Idee → Ticket". Das Feld ist optional.

## System-Anweisungen anpassen

In den Einstellungen (⚙) findest du unter **„System-Anweisungen"** zwei
Grundanweisungen, die das KI-Verhalten steuern:

1. **Claude-Code-Prompt-Generator** – steuert „✨ Prompt generieren"
2. **Ticket-Entwurf aus Freitext** – steuert „💡 Idee → Ticket"

Beide sind mit sinnvollen Standardtexten vorbelegt und funktionieren ohne
Anpassung. Änderungen werden serverseitig in `system-prompts.json` gespeichert
(nicht in Git); „Auf Standard zurücksetzen" stellt den Originaltext wieder her.

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

Nach der Dateiauswahl fragt ein Dialog, **wie** importiert werden soll:

- **Neues Projekt anlegen** (Standard): dein Original bleibt unangetastet, es
  kann nichts verloren gehen. Pflichtfeld ist nur der Projekt-`name`.
- **An bestehendes Projekt anhängen:** die Tickets aus der Datei kommen zu den
  vorhandenen dazu. Ticket-Nummern werden fortlaufend neu vergeben, damit es
  keine doppelten `#NNN` gibt.
- **Bestehendes Projekt ersetzen:** alle Tickets des Zielprojekts werden
  gelöscht und durch den Dateiinhalt ersetzt (Nummerierung beginnt wieder bei
  1). Vorher erscheint eine Sicherheitsabfrage mit der Anzahl der betroffenen
  Tickets – das ist unwiderruflich, ein Backup (siehe unten) lohnt sich.

In allen Modi bleibt das Prompt-Feld der Tickets erhalten; interne IDs werden
frisch vergeben, Projekt und importierte Tickets erhalten einen
`importedAt`-Zeitstempel.

Schreibvarianten bei **Status, Kategorie und Schweregrad** werden beim Import
automatisch auf die gültigen Werte abgebildet (z. B. `Zurueckgestellt`,
`in-arbeit`, `BACKEND` → `Zurückgestellt`, `In Arbeit`, `Backend`) – praktisch,
wenn eine externe KI die Datei bearbeitet hat. Wirklich unbekannte Werte (etwa
`Done` oder `Critical`) werden durch `Offen` / `Prozess` / `Mittel` ersetzt und
nach dem Import mit Ticket, Feld und Originalwert gemeldet.

Auf der Startseite steht unter jedem Projekt eine **Zeitstempel-Zeile**
(Erstellt, Importiert, Zuletzt exportiert). So lassen sich mehrere gleichnamige
Projekte – etwa nach mehreren Import-Runden – zuverlässig auseinanderhalten.

## Backup aller Projekte

Auf der Startseite sichert **„💾 Backup speichern"** alle Projekte samt Tickets
in eine Datei unter `data/backups/backup-<Zeitstempel>.json` – im selben
Format wie „Alle Projekte exportieren", also jederzeit über **„⭱ Alle Projekte
importieren"** wiederherstellbar. Die Statuszeile daneben zeigt das letzte
Backup. Es bleiben immer die **letzten 10 Backups** erhalten, ältere werden
automatisch entfernt.

Zusätzlich läuft nach jeder Änderung an Projekten oder Tickets automatisch ein
Backup – gebündelt auf höchstens eines pro Minute. Schlägt das fehl (z. B.
gesperrter Ordner), wird es nur im Server-Fenster protokolliert; die App läuft
normal weiter.

## Filter in der Projektansicht

In der Filterleiste lassen sich pro Zeile (Kategorie, Schweregrad, Status, BM
Status) **mehrere Werte gleichzeitig** wählen: Werte innerhalb einer Zeile
gelten als ODER, die Zeilen untereinander als UND, die Titelsuche kommt
zusätzlich dazu. **„Alle"** bzw. **„Zurücksetzen"** leert eine Zeile, **„Alle
Filter zurücksetzen"** die ganze Leiste inkl. Suche. Übersichtstabelle und
Detailkarten folgen immer derselben Auswahl. Die Auswahl wird pro Projekt im
Browser gespeichert und beim nächsten Öffnen wiederhergestellt.

## Datenhaltung

Es wird **keine Datenbank** verwendet – alle Daten liegen als JSON-Dateien
unter `data/projects/`. Jedes Projekt ist ein Ordner mit `project.json` und
einem Unterordner `tickets/`, in dem jedes Ticket als eigene `<id>.json` liegt.

## Ticket-Felder

`id`, `titel`, `beschreibung`, `kategorie` (Frontend/Backend/Infrastruktur/
Prozess), `schweregrad` (Kritisch/Hoch/Mittel/Klein/Recherche), `status`
(Offen/In Arbeit/Erledigt/Zurückgestellt), `bmStatus` (Boss-Move-Markierung,
true/false), `claudePrompt` (manuell) sowie `createdAt`/`updatedAt` (bei importierten
Tickets zusätzlich `importedAt`).

In der Übersichtstabelle im Projekt lässt sich der **Status jedes Tickets direkt
per Dropdown** umstellen – ohne den Bearbeiten-Dialog zu öffnen.

## Versionierung & Release-ZIP

Die App zeigt ihre aktuelle Version (aus `package.json`, Feld `version`) unten
im Footer an. **GitHubs eigener „Code → Download ZIP"-Button ist nicht die
empfohlene Bezugsquelle** – er liefert den Stand eines Branches mit dessen
Namen im Dateipfad, ohne erkennbare Versionsnummer und ohne installierte
Abhängigkeiten oder Demo-Daten.

Stattdessen gibt es ein sauber benanntes, lauffähiges Startpaket:

- **Lokal bauen:** `npm run package` erzeugt
  `dist/IT-Ideenforum-v<version>.zip` – enthält Quellcode, bereits
  installierte produktive Abhängigkeiten und die Demo-Seed-Daten. Einfach
  entpacken und `start.bat` doppelklicken.
- **Als GitHub Release:** Bei jedem gepushten Tag `v<version>` (z. B.
  `v0.13.0`) baut ein GitHub-Actions-Workflow (`.github/workflows/release.yml`)
  automatisch dasselbe ZIP und veröffentlicht es auf der Releases-Seite des
  Repos – dort ist pro Version eindeutig nachvollziehbar, welches ZIP welchem
  Stand entspricht.

**Ablauf für eine neue Version:**
1. Version in `package.json` hochzählen und committen.
2. `git tag v<version>` und `git push origin v<version>`.
3. Der Workflow baut das ZIP und legt es unter „Releases" ab.
