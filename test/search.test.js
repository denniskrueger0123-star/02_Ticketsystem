const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseQuery, matchTicket, fieldLabel } = require('../public/js/search');

const T = { titel: '#001 Login-Fehler', beschreibung: 'Der Export bricht ab', claudePrompt: 'Prüfe die Über-Funktion' };

describe('parseQuery', () => {
  test('trennt mehrere Wörter', () => {
    assert.deepEqual(parseQuery('Login  Export'), ['login', 'export']);
  });
  test('Mindestlänge', () => {
    assert.deepEqual(parseQuery('a'), []);
    assert.deepEqual(parseQuery('ab'), ['ab']);
    assert.deepEqual(parseQuery('  a  '), []);
  });
  test('nur Leerzeichen', () => {
    assert.deepEqual(parseQuery('   '), []);
    assert.deepEqual(parseQuery(''), []);
  });
});

describe('matchTicket', () => {
  test('Treffer nur im Titel', () => {
    assert.deepEqual(matchTicket(T, ['login']), { felder: ['titel'] });
  });
  test('Treffer nur in der Beschreibung', () => {
    assert.deepEqual(matchTicket(T, ['export']), { felder: ['beschreibung'] });
  });
  test('Treffer nur im Prompt', () => {
    assert.deepEqual(matchTicket(T, ['prüfe']), { felder: ['claudePrompt'] });
  });
  test('Groß/Klein egal', () => {
    assert.deepEqual(matchTicket(T, parseQuery('LOGIN')), { felder: ['titel'] });
  });
  test('Umlaut', () => {
    assert.deepEqual(matchTicket(T, parseQuery('Über')), { felder: ['claudePrompt'] });
  });
  test('Mehrwort über zwei Felder verteilt', () => {
    assert.deepEqual(matchTicket(T, ['login', 'export']), { felder: ['titel', 'beschreibung'] });
  });
  test('Wort nirgends vorhanden', () => {
    assert.equal(matchTicket(T, ['login', 'nirgends']), null);
  });
  test('fehlende Felder stürzen nicht ab', () => {
    assert.deepEqual(matchTicket({ titel: 'Nur Titel' }, ['titel']), { felder: ['titel'] });
    assert.equal(matchTicket({ titel: 'Nur Titel' }, ['export']), null);
  });
  test('leere Wortliste trifft alles', () => {
    assert.deepEqual(matchTicket(T, []), { felder: [] });
  });
});

test('fieldLabel', () => {
  assert.equal(fieldLabel('claudePrompt'), 'Prompt');
  assert.equal(fieldLabel('beschreibung'), 'Beschreibung');
});
