const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { matchValue, STATUS, KATEGORIEN } = require('../server/lib/ticket-values');

describe('matchValue', () => {
  test('trifft bei exakter Schreibweise', () => {
    assert.equal(matchValue(STATUS, 'In Arbeit'), 'In Arbeit');
  });

  test('trifft bei abweichender Groß-/Kleinschreibung', () => {
    assert.equal(matchValue(KATEGORIEN, 'frontend'), 'Frontend');
    assert.equal(matchValue(STATUS, 'IN ARBEIT'), 'In Arbeit');
  });

  test('trifft bei ue/ü-Variante', () => {
    assert.equal(matchValue(STATUS, 'Zurueckgestellt'), 'Zurückgestellt');
  });

  test('liefert null bei unbekanntem Wert', () => {
    assert.equal(matchValue(STATUS, 'Gibt es nicht'), null);
  });

  test('liefert null bei leerem oder ungültigem Wert', () => {
    assert.equal(matchValue(STATUS, ''), null);
    assert.equal(matchValue(STATUS, '   '), null);
    assert.equal(matchValue(STATUS, undefined), null);
    assert.equal(matchValue(STATUS, 42), null);
  });
});
