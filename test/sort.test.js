const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { SORT_KEYS, ticketNummer, compareTickets, sortTickets } = require('../public/js/sort');

// id dient nur zur Lesbarkeit der erwarteten Reihenfolgen.
const A = { id: 'A', titel: '#003 Zebra-Login', kategorie: 'Backend', schweregrad: 'Hoch', status: 'Offen', bmStatus: true, updatedAt: '2026-03-01T10:00:00.000Z' };
const B = { id: 'B', titel: '#001 Ärger beim Export', kategorie: 'Frontend', schweregrad: 'Kritisch', status: 'In Arbeit', bmStatus: false, updatedAt: '2026-01-01T10:00:00.000Z' };
const C = { id: 'C', titel: '#010 Übersicht', kategorie: 'Infrastruktur', schweregrad: 'Mittel', status: 'Erledigt', updatedAt: '2026-05-01T10:00:00.000Z' };
const D = { id: 'D', titel: 'Ohne Nummer Ticket', kategorie: 'Prozess', schweregrad: 'Klein', status: 'Zurückgestellt', bmStatus: true };
const E = { id: 'E', titel: '#002 Alpha', kategorie: '', schweregrad: 'Recherche', status: 'Offen', bmStatus: false, updatedAt: '2026-02-01T10:00:00.000Z' };
const F = { id: 'F', titel: '#020 Beta', kategorie: 'Backend', schweregrad: 'Hoch', status: 'In Arbeit', bmStatus: false, updatedAt: '2026-04-01T10:00:00.000Z' };

function fixtures() {
  return [A, B, C, D, E, F];
}

function ids(key, dir) {
  return sortTickets(fixtures(), { key, dir }).map((t) => t.id).join('');
}

describe('ticketNummer', () => {
  test('liest die Nummer am Titelanfang', () => {
    assert.equal(ticketNummer({ titel: '#007 Irgendwas' }), 7);
    assert.equal(ticketNummer({ titel: '#123' }), 123);
  });

  test('liefert Infinity ohne Nummer am Titelanfang', () => {
    assert.equal(ticketNummer({ titel: 'Ohne Nummer' }), Infinity);
    assert.equal(ticketNummer({ titel: 'Text #005 später' }), Infinity);
    assert.equal(ticketNummer({}), Infinity);
  });
});

describe('sortTickets je Spalte', () => {
  test('SORT_KEYS enthält alle Spalten', () => {
    assert.deepEqual(SORT_KEYS, ['nummer', 'titel', 'kategorie', 'schweregrad', 'status', 'bm', 'geaendert']);
  });

  test('nummer aufsteigend und absteigend, ohne Nummer immer am Ende', () => {
    assert.equal(ids('nummer', 'asc'), 'BEACFD');
    assert.equal(ids('nummer', 'desc'), 'FCAEBD');
  });

  test('titel ohne Nummernpräfix, Umlaute wie Grundbuchstaben', () => {
    assert.equal(ids('titel', 'asc'), 'EBFDCA');
    assert.equal(ids('titel', 'desc'), 'ACDFBE');
  });

  test('kategorie nach Listenindex, leere Kategorie immer am Ende', () => {
    assert.equal(ids('kategorie', 'asc'), 'BAFCDE');
    assert.equal(ids('kategorie', 'desc'), 'DCAFBE');
  });

  test('schweregrad nach Listenindex', () => {
    assert.equal(ids('schweregrad', 'asc'), 'BAFCDE');
    assert.equal(ids('schweregrad', 'desc'), 'EDCAFB');
  });

  test('status nach Listenindex', () => {
    assert.equal(ids('status', 'asc'), 'EABFCD');
    assert.equal(ids('status', 'desc'), 'DCBFEA');
  });

  test('bm: true vor false, fehlendes bmStatus zählt als false', () => {
    assert.equal(ids('bm', 'asc'), 'ADBECF');
    assert.equal(ids('bm', 'desc'), 'BECFAD');
  });

  test('geaendert nach ISO-String, fehlendes updatedAt immer am Ende', () => {
    assert.equal(ids('geaendert', 'asc'), 'BEAFCD');
    assert.equal(ids('geaendert', 'desc'), 'CFAEBD');
  });
});

describe('Ans-Ende-Regel und Tie-Breaker', () => {
  test('Unbekannte Werte stehen in beiden Richtungen am Ende', () => {
    for (const dir of ['asc', 'desc']) {
      assert.equal(ids('kategorie', dir).slice(-1), 'E');
      assert.equal(ids('nummer', dir).slice(-1), 'D');
      assert.equal(ids('geaendert', dir).slice(-1), 'D');
    }
  });

  test('Gleichstand sortiert nach Nummer aufsteigend, unabhängig von dir', () => {
    // A (#003) und F (#020) haben beide Backend
    for (const dir of ['asc', 'desc']) {
      const ergebnis = ids('kategorie', dir);
      assert.ok(ergebnis.indexOf('A') < ergebnis.indexOf('F'));
    }
  });

  test('compareTickets liefert 0 bei vollständigem Gleichstand', () => {
    assert.equal(compareTickets(A, { ...A }, { key: 'status', dir: 'asc' }), 0);
  });

  test('Ticket ohne Nummer folgt im Gleichstand nach Tickets mit Nummer', () => {
    const ohne = { id: 'X', titel: 'Ohne', bmStatus: true };
    const mit = { id: 'Y', titel: '#050 Mit', bmStatus: true };
    for (const dir of ['asc', 'desc']) {
      const r = sortTickets([ohne, mit], { key: 'bm', dir }).map((t) => t.id);
      assert.deepEqual(r, ['Y', 'X']);
    }
  });
});

describe('sortTickets allgemein', () => {
  test('lässt das Original unverändert und liefert ein neues Array', () => {
    const original = fixtures();
    const kopie = original.slice();
    const ergebnis = sortTickets(original, { key: 'titel', dir: 'desc' });
    assert.notEqual(ergebnis, original);
    assert.deepEqual(original, kopie);
    assert.equal(original.map((t) => t.id).join(''), 'ABCDEF');
  });

  test('unbekannter Key sortiert wie nummer', () => {
    assert.equal(ids('gibt-es-nicht', 'asc'), ids('nummer', 'asc'));
    assert.equal(ids(undefined, 'desc'), ids('nummer', 'desc'));
  });
});
