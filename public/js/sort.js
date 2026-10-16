// Sortierlogik der Übersichtstabelle – ohne DOM, damit sie in Node testbar ist.
(function (root) {
  // Reihenfolge muss server/lib/ticket-values.js entsprechen. Hier bewusst eine
  // Kopie: Das Frontend läuft als klassisches <script> im Browser und kann keine
  // Server-Module laden. Die Regel „nirgendwo kopieren“ gilt für den Server.
  const KATEGORIEN = ['Frontend', 'Backend', 'Infrastruktur', 'Prozess'];
  const SCHWEREGRADE = ['Kritisch', 'Hoch', 'Mittel', 'Klein', 'Recherche'];
  const STATUS = ['Offen', 'In Arbeit', 'Erledigt', 'Zurückgestellt'];

  const SORT_KEYS = ['nummer', 'titel', 'kategorie', 'schweregrad', 'status', 'bm', 'geaendert'];

  function ticketNummer(ticket) {
    const m = /^#(\d+)/.exec((ticket && ticket.titel) || '');
    return m ? Number(m[1]) : Infinity;
  }

  function titelOhneNummer(ticket) {
    return String((ticket && ticket.titel) || '').replace(/^#\d+\s*/, '');
  }

  function listenIndex(liste, wert) {
    const i = liste.indexOf(wert);
    return i === -1 ? null : i;
  }

  // Sortierwert je Spalte; null = fehlt/unbekannt und kommt immer ans Ende.
  function sortWert(ticket, key) {
    switch (key) {
      case 'titel':
        return titelOhneNummer(ticket);
      case 'kategorie':
        return listenIndex(KATEGORIEN, ticket.kategorie);
      case 'schweregrad':
        return listenIndex(SCHWEREGRADE, ticket.schweregrad);
      case 'status':
        return listenIndex(STATUS, ticket.status);
      case 'bm':
        return ticket.bmStatus === true ? 0 : 1;
      case 'geaendert':
        return typeof ticket.updatedAt === 'string' && ticket.updatedAt ? ticket.updatedAt : null;
      default: {
        const n = ticketNummer(ticket);
        return n === Infinity ? null : n;
      }
    }
  }

  function vergleicheWerte(key, x, y) {
    if (key === 'titel') return x.localeCompare(y, 'de', { sensitivity: 'base', numeric: true });
    if (key === 'geaendert') return x < y ? -1 : x > y ? 1 : 0;
    return x - y;
  }

  function nummerAufsteigend(a, b) {
    const x = ticketNummer(a);
    const y = ticketNummer(b);
    if (x === y) return 0;
    return x < y ? -1 : 1;
  }

  function compareTickets(a, b, { key, dir } = {}) {
    const k = SORT_KEYS.includes(key) ? key : 'nummer';
    const x = sortWert(a, k);
    const y = sortWert(b, k);
    if (x === null && y !== null) return 1;
    if (x !== null && y === null) return -1;
    if (x !== null && y !== null) {
      const c = vergleicheWerte(k, x, y);
      if (c !== 0) return dir === 'desc' ? -c : c;
    }
    return nummerAufsteigend(a, b);
  }

  function sortTickets(tickets, optionen) {
    return tickets.slice().sort((a, b) => compareTickets(a, b, optionen));
  }

  const api = { SORT_KEYS, ticketNummer, compareTickets, sortTickets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TicketSort = api;
})(typeof window !== 'undefined' ? window : globalThis);
