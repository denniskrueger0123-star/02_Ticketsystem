// Serverseitige LLM-Anbindung zum Generieren von Claude-Code-Prompts.
// Unterstützt mehrere Anbieter (Anthropic/Claude, Google Gemini, OpenAI).
// API-Keys liegen NIEMALS im Frontend – sie werden hier serverseitig aus einer
// Datei im Projektordner (bzw. einer Umgebungsvariable) gelesen.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.join(__dirname, '..', '..');

// ── Anbieter: je ein Key-File + eine Umgebungsvariable ──────────────
const PROVIDERS = {
  anthropic: { label: 'Claude (Anthropic)', keyFile: 'api-key.txt', keyEnv: 'ANTHROPIC_API_KEY' },
  google: { label: 'Google Gemini', keyFile: 'gemini-key.txt', keyEnv: 'GEMINI_API_KEY' },
  openai: { label: 'OpenAI (ChatGPT)', keyFile: 'openai-key.txt', keyEnv: 'OPENAI_API_KEY' },
};

// ── Wählbare Modelle (id = das, was an die jeweilige API geht) ──────
const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 – günstig & schnell', provider: 'anthropic' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 – ausgewogen', provider: 'anthropic', effort: 'low' },
  { id: 'claude-opus-5', label: 'Claude Opus 5 – am stärksten', provider: 'anthropic', effort: 'low' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash – günstig & schnell', provider: 'google' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro – stark', provider: 'google' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini – günstig', provider: 'openai' },
  { id: 'gpt-4o', label: 'GPT-4o – stark', provider: 'openai' },
];

const DEFAULT_MODEL = process.env.LLM_MODEL || 'claude-haiku-4-5';

const SYSTEM_PROMPT =
  'Du bist ein Assistent, der aus Ticket-Beschreibungen präzise, umsetzbare ' +
  'Prompts für Claude Code (ein KI-Coding-Tool) formuliert. Schreibe den Prompt ' +
  'auf Deutsch, in der zweiten Person ("Implementiere...", "Analysiere..."). Er ' +
  'soll konkret genug sein, dass ein Entwickler-Agent direkt loslegen kann: nenne ' +
  'Ziel, betroffene Bereiche und sinnvolle Schritte. Gib AUSSCHLIESSLICH den ' +
  'fertigen Prompt-Text aus – keine Einleitung, keine Erklärung, keine ' +
  'Code-Blöcke oder Anführungszeichen drumherum.';

class LlmError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function resolveKey(provider) {
  const cfg = PROVIDERS[provider];
  if (process.env[cfg.keyEnv] && process.env[cfg.keyEnv].trim()) {
    return process.env[cfg.keyEnv].trim();
  }
  try {
    const key = fs.readFileSync(path.join(ROOT, cfg.keyFile), 'utf-8').trim();
    if (key) return key;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return null;
}

function listModels() {
  return MODELS.map((m) => ({ id: m.id, label: m.label, provider: m.provider }));
}

function providerStatus() {
  const out = {};
  for (const [id, cfg] of Object.entries(PROVIDERS)) {
    out[id] = { label: cfg.label, keyFile: cfg.keyFile, configured: !!resolveKey(id) };
  }
  return out;
}

function buildUserContent(project, ticket) {
  return (
    `Projekt: ${project.name}\n` +
    (project.description ? `Projektbeschreibung: ${project.description}\n` : '') +
    `\nTicket-Titel: ${ticket.titel}\n` +
    `Kategorie: ${ticket.kategorie} · Schweregrad: ${ticket.schweregrad} · Status: ${ticket.status}\n\n` +
    `Ticket-Beschreibung:\n${ticket.beschreibung || '(keine Beschreibung vorhanden)'}\n\n` +
    'Formuliere daraus einen Claude-Code-Prompt.'
  );
}

// ── Anbieter-spezifische Aufrufe ────────────────────────────────────
async function callAnthropic(model, key, system, user) {
  const client = new Anthropic({ apiKey: key });
  const req = {
    model: model.id,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  };
  if (model.effort) req.output_config = { effort: model.effort };
  const res = await client.messages.create(req);
  if (res.stop_reason === 'refusal') {
    throw new LlmError('Die Anfrage wurde vom Modell abgelehnt.', 'REFUSAL');
  }
  return (res.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

async function callGemini(model, key, system, user) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new LlmError(`Gemini-Fehler: ${data.error?.message || res.statusText}`, 'API_ERROR');
  }
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('');
}

async function callOpenAI(model, key, system, user) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model.id,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new LlmError(`OpenAI-Fehler: ${data.error?.message || res.statusText}`, 'API_ERROR');
  }
  return data.choices?.[0]?.message?.content || '';
}

const CALLERS = { anthropic: callAnthropic, google: callGemini, openai: callOpenAI };

async function generatePrompt({ project, ticket, modelId }) {
  const model = MODELS.find((m) => m.id === (modelId || DEFAULT_MODEL)) || MODELS.find((m) => m.id === DEFAULT_MODEL);
  if (!model) throw new LlmError('Unbekanntes Modell.', 'BAD_MODEL');

  const key = resolveKey(model.provider);
  if (!key) {
    const cfg = PROVIDERS[model.provider];
    throw new LlmError(
      `Kein API-Key für ${cfg.label}. Lege die Datei "${cfg.keyFile}" im Projektordner an ` +
        `und trage deinen API-Key hinein (oder setze die Umgebungsvariable ${cfg.keyEnv}).`,
      'NO_KEY'
    );
  }

  const system = SYSTEM_PROMPT;
  const user = buildUserContent(project, ticket);

  let text;
  try {
    text = (await CALLERS[model.provider](model, key, system, user)).trim();
  } catch (err) {
    if (err instanceof LlmError) throw err;
    throw new LlmError(`LLM-Aufruf fehlgeschlagen: ${err.message}`, 'API_ERROR');
  }

  if (!text) throw new LlmError('Das Modell hat keinen Text zurückgegeben.', 'EMPTY');
  return text;
}

module.exports = { generatePrompt, listModels, providerStatus, LlmError, DEFAULT_MODEL };
