const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

// Kindprozess, weil config.js beim ersten require auswertet und das Modul gecacht wird.
function ladeConfig(overrides = {}) {
  const env = { ...process.env };
  // Eine .env im Projektordner oder die Umgebung des Aufrufers darf das Ergebnis nicht beeinflussen.
  for (const key of ['HOST', 'PORT', 'BACKUP_DIR', 'BACKUP_INTERVAL', 'BACKUP_KEEP', 'DATA_DIR']) delete env[key];
  Object.assign(env, overrides);
  const res = spawnSync(
    process.execPath,
    ['-e', "console.log(JSON.stringify(require('./server/lib/config')))"],
    { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  assert.equal(res.status, 0, res.stderr);
  return { config: JSON.parse(res.stdout), stderr: res.stderr };
}

describe('config.js', () => {
  test('Standardwerte', () => {
    const { config } = ladeConfig();
    assert.equal(config.server.host, '127.0.0.1');
    assert.equal(config.server.port, 3000);
    assert.equal(config.backup.intervalMinutes, 60);
    assert.equal(config.backup.keep, 10);
  });

  test('ungültige Werte fallen auf Standard zurück und warnen', () => {
    const { config, stderr } = ladeConfig({ BACKUP_INTERVAL: 'abc', BACKUP_KEEP: '0', PORT: '70000' });
    assert.equal(config.backup.intervalMinutes, 60);
    assert.equal(config.backup.keep, 10);
    assert.equal(config.server.port, 3000);
    assert.match(stderr, /BACKUP_INTERVAL/);
    assert.match(stderr, /BACKUP_KEEP/);
    assert.match(stderr, /PORT/);
  });

  test('zu großes BACKUP_INTERVAL fällt auf 60 zurück', () => {
    assert.equal(ladeConfig({ BACKUP_INTERVAL: '99999' }).config.backup.intervalMinutes, 60);
  });

  test('HOST wird übernommen', () => {
    assert.equal(ladeConfig({ HOST: '0.0.0.0' }).config.server.host, '0.0.0.0');
  });

  test('absolutes BACKUP_DIR bleibt absolut', () => {
    const abs = path.resolve(path.parse(ROOT).root, 'irgendwo', 'backups');
    assert.equal(ladeConfig({ BACKUP_DIR: abs }).config.backup.dir, abs);
  });

  test('DATA_DIR ist standardmäßig data/projects und überschreibbar', () => {
    assert.equal(ladeConfig().config.dataDir, path.join(path.resolve(ROOT), 'data', 'projects'));
    const abs = path.resolve(path.parse(ROOT).root, 'irgendwo', 'daten');
    assert.equal(ladeConfig({ DATA_DIR: abs }).config.dataDir, abs);
  });
});
