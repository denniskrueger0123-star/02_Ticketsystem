# Node.js Installation – Schritt für Schritt

Bevor du `start.bat` nutzen kannst, muss Node.js installiert sein. Hier zwei Wege:

## Weg 1: Automatisiert (PowerShell-Skript) — empfohlen

1. **PowerShell öffnen**: Drücke `Win+R`, tippe `powershell`, Enter.
2. **In den IT-Ideenforum-Ordner navigieren**:
   ```powershell
   cd "C:\Pfad\zu\IT-Ideenforum"
   ```
   (Beispiel: `cd C:\Users\Dennis\Downloads\IT-Ideenforum`)

3. **Ausführungsrichtlinie anpassen** (einmalig):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   ```
   → Bestätige mit `y` + Enter.

4. **Installationsskript ausführen**:
   ```powershell
   .\install-nodejs.ps1
   ```
   → Das Installationsfenster öffnet sich automatisch. Die Installation dauert ~1–2 Minuten.

5. **PowerShell neu starten** (wichtig!):
   - PowerShell-Fenster schließen.
   - Neue PowerShell öffnen (oder direkt `start.bat` nutzen).

6. **Bestätigung**:
   ```powershell
   node --version
   ```
   → Sollte etwas wie `v22.11.0` ausgeben.

## Weg 2: Manuell — wenn Weg 1 nicht funktioniert

1. Gehe zu <https://nodejs.org/>
2. Lade die **LTS-Version** (große grüne Schaltfläche) herunter.
3. Öffne die Installer-Datei (`.msi`) und folge dem Standard-Installationsassistenten.
4. Nach der Installation: PowerShell neu starten und `node --version` prüfen.

## Danach

Sobald Node.js installiert ist:
- **`start.bat` doppelklicken** im IT-Ideenforum-Ordner.
- Browser öffnet sich automatisch auf `http://localhost:3000`.
- Fertig!

## Troubleshooting

**„PowerShell kennt install-nodejs.ps1 nicht"**
- Stelle sicher, dass du in PowerShell im IT-Ideenforum-Ordner bist: `cd [Pfad]`
- Schreibe den Punkt-Slash davor: `.\install-nodejs.ps1`

**„Ausführungsrichtlinie blockiert das Skript"**
- Führe aus (mit Bestätigung):
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
  ```

**`node --version` funktioniert nicht**
- PowerShell komplett schließen und neu öffnen (nicht einfach ein neues Tab).

Fragen? Nachricht schreiben – ich helfe gerne weiter!
