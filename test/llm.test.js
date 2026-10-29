const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

// Umgebung vor dem require setzen: config.js wertet sie beim ersten Laden aus.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ideenforum-llm-'));
process.env.DATA_DIR = path.join(tmpRoot, 'projects');
process.env.LLM_TIMEOUT = '5';
process.env.LLM_LOG_KEEP = '10';

const llm = require('../server/lib/llm');
const llmLog = require('../server/lib/llm-log');
const { httpFehler, uebersetzeFehler, normalizeBaseUrl, callLiteLLM } = llm._intern;

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Fehlerübersetzung', () => {
  test('HTTP-Status werden in Codes und Texte übersetzt', () => {
    assert.equal(httpFehler(401, 'X', {}).code, 'AUTH');
    assert.equal(httpFehler(403, 'X', {}).code, 'AUTH');
    assert.equal(httpFehler(429, 'X', {}).code, 'RATE_LIMIT');
    assert.equal(httpFehler(503, 'X', {}).code, 'UPSTREAM');
    assert.match(httpFehler(503, 'X', {}).message, /Serverfehler \(503\)/);
    assert.equal(httpFehler(400, 'X', { error: { message: 'kaputt' } }).message, 'X: kaputt');
  });

  test('404 bekommt beim LiteLLM-Proxy den Zusatz', () => {
    const normal = httpFehler(404, 'X', {});
    assert.equal(normal.code, 'NOT_FOUND');
    assert.ok(!normal.message.includes('Basis-URL'));
    assert.match(httpFehler(404, 'X', {}, { baseUrl: 'https://x' }).message, /Prüfe Modell-ID und Basis-URL\./);
  });

  test('TimeoutError wird zu TIMEOUT mit Sekundenangabe', () => {
    const err = uebersetzeFehler(Object.assign(new Error('t'), { name: 'TimeoutError' }), 'Y');
    assert.equal(err.code, 'TIMEOUT');
    assert.match(err.message, /nach 5 s bei Y/);
  });

  test('Netzfehler wird zu UNREACHABLE', () => {
    const err = uebersetzeFehler(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }), 'Y', { baseUrl: 'https://h' });
    assert.equal(err.code, 'UNREACHABLE');
    assert.match(err.message, /Y nicht erreichbar \(https:\/\/h\): ECONNREFUSED/);
  });

  test('Fremder Fehler wird zu API_ERROR', () => {
    assert.equal(uebersetzeFehler(new Error('boom'), 'Y').code, 'API_ERROR');
  });
});

describe('normalizeBaseUrl', () => {
  test('ohne Schema wirft BAD_URL', () => {
    assert.throws(() => normalizeBaseUrl('litellm.firma.de'), (e) => e.code === 'BAD_URL');
  });

  test('entfernt Schrägstrich und /v1', () => {
    assert.equal(normalizeBaseUrl('https://x/'), 'https://x');
    assert.equal(normalizeBaseUrl('https://x/v1'), 'https://x');
    assert.equal(normalizeBaseUrl('  https://x/v1/ '), 'https://x');
  });
});

describe('Zeitlimit', () => {
  let server;
  let url;

  before(async () => {
    server = http.createServer(() => {}); // antwortet nie
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
    delete process.env.LITELLM_BASE_URL;
  });

  test('callLiteLLM bricht nach LLM_TIMEOUT mit TIMEOUT ab', async () => {
    process.env.LITELLM_BASE_URL = url;
    const start = Date.now();
    await assert.rejects(
      () => callLiteLLM({ id: 'm' }, 'test', 'system', 'user'),
      (e) => e.code === 'TIMEOUT' && /5 s/.test(e.message)
    );
    assert.ok(Date.now() - start < 8000);
  });
});

describe('Aufrufprotokoll', () => {
  const basis = { anbieter: 'litellm', anbieterLabel: 'L', modell: 'm', zweck: 'prompt', dauerMs: 5, ok: false, fehlerCode: 'TIMEOUT', fehlerText: 'Zeit' };

  test('append/read: neueste zuerst, nur Metadaten', async () => {
    await llmLog.clear();
    await llmLog.append({ ...basis, modell: 'alt', prompt: 'GEHEIM', antwort: 'GEHEIM' });
    await llmLog.append({ ...basis, modell: 'neu' });
    const eintraege = await llmLog.read(1);
    assert.equal(eintraege.length, 1);
    assert.equal(eintraege[0].modell, 'neu');
    assert.ok(!fs.readFileSync(llmLog.FILE, 'utf-8').includes('GEHEIM'));
    assert.deepEqual(
      Object.keys(eintraege[0]).sort(),
      ['anbieter', 'anbieterLabel', 'dauerMs', 'fehlerCode', 'fehlerText', 'modell', 'ok', 'zeitpunkt', 'zweck']
    );
  });

  test('unparsebare Zeilen werden übersprungen, clear leert', async () => {
    fs.appendFileSync(llmLog.FILE, 'kein json\n');
    assert.equal((await llmLog.read(100)).length, 2);
    await llmLog.clear();
    assert.deepEqual(await llmLog.read(100), []);
  });

  test('Kürzung auf etwa LLM_LOG_KEEP', async () => {
    await llmLog.clear();
    for (let i = 0; i < 150; i++) await llmLog.append({ ...basis, dauerMs: i });
    const eintraege = await llmLog.read(500);
    assert.ok(eintraege.length >= 10 && eintraege.length <= 12, String(eintraege.length));
    assert.equal(eintraege[0].dauerMs, 149);
  });

  test('fehlgeschlagener Aufruf wird ohne Inhalte protokolliert', async () => {
    await llmLog.clear();
    // Ohne passenden Key scheitert der Aufruf vor jedem Netzzugriff mit NO_KEY.
    const vorher = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      if (llm.listModels().length && !fs.existsSync(path.join(__dirname, '..', 'api-key.txt'))) {
        await assert.rejects(
          () => llm.generatePrompt({ project: { name: 'P' }, ticket: { titel: 'T' }, modelId: 'claude-haiku-4-5' }),
          (e) => e.code === 'NO_KEY'
        );
        // Das Protokollieren wird nicht abgewartet.
        await new Promise((resolve) => setTimeout(resolve, 200));
        const eintraege = await llmLog.read(5);
        assert.equal(eintraege.length, 1);
        assert.equal(eintraege[0].zweck, 'prompt');
        assert.equal(eintraege[0].ok, false);
        assert.equal(eintraege[0].fehlerCode, 'NO_KEY');
      }
    } finally {
      if (vorher !== undefined) process.env.ANTHROPIC_API_KEY = vorher;
    }
  });
});
