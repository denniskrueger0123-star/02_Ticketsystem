// Gültige Werte für Ticket-Felder und tolerantes Zuordnen von Schreibvarianten
// (z. B. aus extern bearbeiteten Import-Dateien).
const KATEGORIEN = ['Frontend', 'Backend', 'Infrastruktur', 'Prozess'];
const SCHWEREGRADE = ['Kritisch', 'Hoch', 'Mittel', 'Klein', 'Recherche'];
const STATUS = ['Offen', 'In Arbeit', 'Erledigt', 'Zurückgestellt'];

function normalize(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/ae/g, 'ä')
    .replace(/oe/g, 'ö')
    .replace(/ue/g, 'ü')
    .replace(/ss/g, 'ß')
    .replace(/[-_\s]+/g, ' ')
    .trim();
}

// Liefert den exakten erlaubten Wert zu einer Schreibvariante, sonst null.
// Beide Seiten werden gleich normalisiert, damit "ue"/"ü" usw. nicht
// davon abhängen, welche Variante der erlaubte Wert selbst nutzt.
function matchValue(allowed, raw) {
  if (typeof raw !== 'string') return null;
  const n = normalize(raw);
  if (!n) return null;
  return allowed.find((a) => normalize(a) === n) || null;
}

module.exports = { KATEGORIEN, SCHWEREGRADE, STATUS, matchValue };
