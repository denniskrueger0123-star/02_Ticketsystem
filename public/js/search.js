// Suchlogik der Projektansicht – ohne DOM, damit sie in Node testbar ist.
(function (root) {
  const MIN_LEN = 2;

  const SEARCH_FIELDS = [
    { key: 'titel', label: 'Titel' },
    { key: 'beschreibung', label: 'Beschreibung' },
    { key: 'claudePrompt', label: 'Prompt' },
  ];

  function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFC');
  }

  // Zu kurze Eingaben liefern keine Wörter, damit ein einzelner Buchstabe nicht alles filtert.
  function parseQuery(text) {
    const trimmed = normalize(text).trim();
    if (trimmed.length < MIN_LEN) return [];
    return trimmed.split(/\s+/).filter(Boolean);
  }

  // UND über Wörter, ODER über Felder.
  function matchTicket(ticket, words) {
    if (!words || words.length === 0) return { felder: [] };
    const texte = SEARCH_FIELDS.map((f) => ({ key: f.key, text: normalize(ticket && ticket[f.key]) }));
    const alleGefunden = words.every((w) => texte.some((f) => f.text.includes(w)));
    if (!alleGefunden) return null;
    const felder = texte.filter((f) => words.some((w) => f.text.includes(w))).map((f) => f.key);
    return { felder };
  }

  function fieldLabel(key) {
    const f = SEARCH_FIELDS.find((x) => x.key === key);
    return f ? f.label : key;
  }

  const api = { MIN_LEN, SEARCH_FIELDS, normalize, parseQuery, matchTicket, fieldLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TicketSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
