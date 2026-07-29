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
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash – günstig & schnell', provider: 'google' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro – stark (Billing im Google-Projekt nötig)', provider: 'google' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini – günstig', provider: 'openai' },
  { id: 'gpt-4o', label: 'GPT-4o – stark', provider: 'openai' },
];

const DEFAULT_MODEL = process.env.LLM_MODEL || 'claude-haiku-4-5';

// ── Eigene Modelle: pro Anbieter ein manuell eingetragenes Modell ───
// Modelle ändern sich häufig; deshalb kann pro Anbieter in den Einstellungen
// eine eigene Modell-ID hinterlegt werden (Datei custom-models.json).
const CUSTOM_MODELS_FILE = 'custom-models.json';

function readCustomModels() {
  let raw;
  try {
    raw = fs.readFileSync(path.join(ROOT, CUSTOM_MODELS_FILE), 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveCustomModel(provider, modelId) {
  if (!PROVIDERS[provider]) throw new LlmError('Unbekannter Anbieter.', 'BAD_PROVIDER');
  const all = readCustomModels();
  const trimmed = (modelId || '').trim();
  if (trimmed) all[provider] = trimmed;
  else delete all[provider];
  fs.writeFileSync(path.join(ROOT, CUSTOM_MODELS_FILE), JSON.stringify(all, null, 2) + '\n', 'utf-8');
  return trimmed;
}

// Eigene Modelle als wählbare Einträge (erscheinen im Dropdown beim Anbieter).
function customModelEntries() {
  const all = readCustomModels();
  const out = [];
  for (const [provider, id] of Object.entries(all)) {
    if (PROVIDERS[provider] && id) {
      out.push({ id, label: `Eigenes Modell: ${id}`, provider, custom: true });
    }
  }
  return out;
}

// Alle wählbaren Modelle: eigene zuerst, dann die Presets (ohne Dubletten).
function allModels() {
  const custom = customModelEntries();
  const customIds = new Set(custom.map((m) => m.id));
  return [...custom, ...MODELS.filter((m) => !customIds.has(m.id))];
}

// Erstes Preset-Modell eines Anbieters – dient als Platzhalter/Beispiel.
function exampleModelFor(provider) {
  const m = MODELS.find((x) => x.provider === provider);
  return m ? m.id : '';
}

// ── Globale, in den Einstellungen bearbeitbare System-Anweisungen ───
// Standardtexte; die tatsächlich verwendeten Texte liegen (falls angepasst) in
// system-prompts.json. Fehlt dort ein Wert, greift der Default.
const DEFAULT_PROMPT_GENERATOR_SYSTEM =
  'Du bist ein Assistent, der aus Ticket-Beschreibungen präzise, umsetzbare ' +
  'Prompts für Claude Code (ein KI-Coding-Tool) formuliert. Schreibe den Prompt ' +
  'auf Deutsch, in der zweiten Person ("Implementiere...", "Analysiere..."). Er ' +
  'soll konkret genug sein, dass ein Entwickler-Agent direkt loslegen kann: nenne ' +
  'Ziel, betroffene Bereiche und sinnvolle Schritte. Gib AUSSCHLIESSLICH den ' +
  'fertigen Prompt-Text aus – keine Einleitung, keine Erklärung, keine ' +
  'Code-Blöcke oder Anführungszeichen drumherum.';

const DEFAULT_TICKET_DRAFT_SYSTEM =
  'Du bist ein Assistent, der aus einer frei formulierten Idee einen ' +
  'strukturierten Ticket-Entwurf erzeugt. Antworte AUSSCHLIESSLICH mit einem ' +
  'einzigen JSON-Objekt (keine Erklärung, kein Text, keine Code-Blöcke) mit ' +
  'genau diesen Feldern:\n' +
  '- "titel": prägnanter Titel (String, Deutsch)\n' +
  '- "beschreibung": ausformulierte Beschreibung des Vorhabens (String, Deutsch)\n' +
  '- "kategorie": genau einer von "Frontend", "Backend", "Infrastruktur", "Prozess"\n' +
  '- "schweregrad": genau einer von "Kritisch", "Hoch", "Mittel", "Klein", "Recherche"\n' +
  'Wähle Kategorie und Schweregrad passend zum Inhalt. Gib nur das JSON aus.';

const SYSTEM_PROMPTS_FILE = 'system-prompts.json';
const SYSTEM_PROMPT_DEFAULTS = {
  promptGenerator: DEFAULT_PROMPT_GENERATOR_SYSTEM,
  ticketDraft: DEFAULT_TICKET_DRAFT_SYSTEM,
};

function readSystemPrompts() {
  let raw;
  try {
    raw = fs.readFileSync(path.join(ROOT, SYSTEM_PROMPTS_FILE), 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

// Liefert den aktiven Text einer System-Anweisung (gespeichert oder Default).
function getSystemPrompt(key) {
  const stored = readSystemPrompts();
  const val = stored[key];
  if (typeof val === 'string' && val.trim()) return val;
  return SYSTEM_PROMPT_DEFAULTS[key] || '';
}

// Speichert eine System-Anweisung; leerer Text = auf Default zurücksetzen.
function saveSystemPrompt(key, text) {
  if (!(key in SYSTEM_PROMPT_DEFAULTS)) {
    throw new LlmError('Unbekannte System-Anweisung.', 'BAD_PROMPT_KEY');
  }
  const all = readSystemPrompts();
  const trimmed = (text || '').trim();
  if (trimmed) all[key] = trimmed;
  else delete all[key];
  fs.writeFileSync(path.join(ROOT, SYSTEM_PROMPTS_FILE), JSON.stringify(all, null, 2) + '\n', 'utf-8');
  return getSystemPrompt(key);
}

// Status beider System-Anweisungen für die Einstellungsseite.
function systemPromptsStatus() {
  const stored = readSystemPrompts();
  const out = {};
  for (const key of Object.keys(SYSTEM_PROMPT_DEFAULTS)) {
    const isCustom = typeof stored[key] === 'string' && stored[key].trim();
    out[key] = {
      text: isCustom ? stored[key] : SYSTEM_PROMPT_DEFAULTS[key],
      isDefault: !isCustom,
      default: SYSTEM_PROMPT_DEFAULTS[key],
    };
  }
  return out;
}

const BM_SYSTEM_PROMPT =
  'Du bist ein Assistent, der aus MEHREREN zusammengehörigen Tickets EINEN ' +
  'einzigen, übergreifenden Prompt für Claude Code (ein KI-Coding-Tool) ' +
  'formuliert – einen sogenannten "Super-Prompt". Fasse die Tickets zu einem ' +
  'stimmigen Gesamtauftrag zusammen: erkenne gemeinsame Themen und ' +
  'Abhängigkeiten, leite eine sinnvolle Reihenfolge ab und vermeide ' +
  'Wiederholungen. Schreibe den Prompt auf Deutsch, in der zweiten Person ' +
  '("Implementiere...", "Analysiere..."). Er soll konkret genug sein, dass ein ' +
  'Entwickler-Agent die Tickets gemeinsam abarbeiten kann. Gib AUSSCHLIESSLICH ' +
  'den fertigen Prompt-Text aus – keine Einleitung, keine Erklärung, keine ' +
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
  return allModels().map((m) => ({ id: m.id, label: m.label, provider: m.provider, custom: !!m.custom }));
}

function providerStatus() {
  const out = {};
  for (const [id, cfg] of Object.entries(PROVIDERS)) {
    out[id] = { label: cfg.label, keyFile: cfg.keyFile, configured: !!resolveKey(id) };
  }
  return out;
}

// ── Einstellungen: Keys per UI lesbar/schreibbar machen ──────────────
function maskKey(key) {
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
}

function readFileKey(provider) {
  const cfg = PROVIDERS[provider];
  try {
    return fs.readFileSync(path.join(ROOT, cfg.keyFile), 'utf-8').trim();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return '';
  }
}

function settingsStatus() {
  const out = {};
  const custom = readCustomModels();
  for (const [id, cfg] of Object.entries(PROVIDERS)) {
    const envKey = process.env[cfg.keyEnv] && process.env[cfg.keyEnv].trim();
    const fileKey = readFileKey(id);
    const source = envKey ? 'env' : fileKey ? 'file' : null;
    out[id] = {
      label: cfg.label,
      keyEnv: cfg.keyEnv,
      configured: !!source,
      source,
      preview: fileKey ? maskKey(fileKey) : '',
      model: custom[id] || '',
      exampleModel: exampleModelFor(id),
    };
  }
  return out;
}

function saveKey(provider, key) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new LlmError('Unbekannter Anbieter.', 'BAD_PROVIDER');
  const trimmed = (key || '').trim();
  if (!trimmed) throw new LlmError('Kein Key übergeben.', 'BAD_KEY');
  fs.writeFileSync(path.join(ROOT, cfg.keyFile), trimmed + '\n', 'utf-8');
}

function clearKey(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new LlmError('Unbekannter Anbieter.', 'BAD_PROVIDER');
  try {
    fs.unlinkSync(path.join(ROOT, cfg.keyFile));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
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

function buildBossMoveContent(project, tickets) {
  const header =
    `Projekt: ${project.name}\n` +
    (project.description ? `Projektbeschreibung: ${project.description}\n` : '') +
    `\nEs folgen ${tickets.length} zusammengehörige Tickets (Boss Move). ` +
    'Formuliere daraus EINEN übergreifenden Super-Prompt.\n';
  const blocks = tickets
    .map((t, i) => {
      return (
        `\n─── Ticket ${i + 1} ───\n` +
        `Titel: ${t.titel}\n` +
        `Kategorie: ${t.kategorie} · Schweregrad: ${t.schweregrad} · Status: ${t.status}\n` +
        `Beschreibung:\n${t.beschreibung || '(keine Beschreibung vorhanden)'}\n`
      );
    })
    .join('');
  return header + blocks;
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
  const models = allModels();
  const model = models.find((m) => m.id === (modelId || DEFAULT_MODEL)) || models.find((m) => m.id === DEFAULT_MODEL);
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

  const baseSystem = getSystemPrompt('promptGenerator');
  const system = project.promptSkill
    ? `${baseSystem}\n\nZusätzliche Anweisungen für dieses Projekt (unbedingt beachten):\n${project.promptSkill}`
    : baseSystem;
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

// Erzeugt EINEN Super-Prompt aus mehreren (Boss-Move-)Tickets. Nutzt eine
// eigene System-Anweisung und die projektweite BM-KI-Anweisung, unabhängig von
// der normalen promptSkill.
async function generateBossMovePrompt({ project, tickets, modelId }) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    throw new LlmError('Keine Tickets im Boss-Move-Status (grün) markiert.', 'NO_TICKETS');
  }

  const models = allModels();
  const model = models.find((m) => m.id === (modelId || DEFAULT_MODEL)) || models.find((m) => m.id === DEFAULT_MODEL);
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

  const system = project.bmPromptSkill
    ? `${BM_SYSTEM_PROMPT}\n\nZusätzliche Anweisungen für diesen Super-Prompt (unbedingt beachten):\n${project.bmPromptSkill}`
    : BM_SYSTEM_PROMPT;
  const user = buildBossMoveContent(project, tickets);

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

// ── Funktion 2: Ticket-Entwurf aus Freitext ─────────────────────────
const TICKET_KATEGORIEN = ['Frontend', 'Backend', 'Infrastruktur', 'Prozess'];
const TICKET_SCHWEREGRADE = ['Kritisch', 'Hoch', 'Mittel', 'Klein', 'Recherche'];

// Extrahiert ein JSON-Objekt aus einer Modell-Antwort (entfernt evtl.
// Code-Fences oder umgebenden Text).
function extractJson(text) {
  let t = (text || '').trim();
  // ```json ... ``` oder ``` ... ``` entfernen
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // Falls noch Text drumherum: erstes { bis letztes }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

function buildDraftUserContent(project, text) {
  let out = `Freitext-Idee:\n${text}\n`;
  if (project.promptSkill) {
    out += `\nProjektweite KI-Anweisungen (beachten):\n${project.promptSkill}\n`;
  }
  if (project.projektReadme) {
    out += `\nProjekt-Readme / Kontext (nur zur Orientierung):\n${project.projektReadme}\n`;
  }
  out += '\nErzeuge daraus einen Ticket-Entwurf als JSON.';
  return out;
}

async function draftTicketFromText({ project, text, modelId }) {
  if (!text || !text.trim()) {
    throw new LlmError('Bitte zuerst eine Idee als Freitext eingeben.', 'NO_TEXT');
  }

  const models = allModels();
  const model = models.find((m) => m.id === (modelId || DEFAULT_MODEL)) || models.find((m) => m.id === DEFAULT_MODEL);
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

  const system = getSystemPrompt('ticketDraft');
  const user = buildDraftUserContent(project, text.trim());

  let raw;
  try {
    raw = (await CALLERS[model.provider](model, key, system, user)).trim();
  } catch (err) {
    if (err instanceof LlmError) throw err;
    throw new LlmError(`LLM-Aufruf fehlgeschlagen: ${err.message}`, 'API_ERROR');
  }
  if (!raw) throw new LlmError('Das Modell hat keinen Text zurückgegeben.', 'EMPTY');

  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (e) {
    throw new LlmError('Die Antwort des Modells war kein gültiges JSON. Bitte erneut versuchen.', 'BAD_JSON');
  }

  const titel = String(parsed.titel || parsed.title || '').trim();
  const beschreibung = String(parsed.beschreibung || parsed.description || '').trim();
  let kategorie = String(parsed.kategorie || parsed.category || '').trim();
  let schweregrad = String(parsed.schweregrad || parsed.severity || '').trim();
  if (!TICKET_KATEGORIEN.includes(kategorie)) kategorie = 'Prozess';
  if (!TICKET_SCHWEREGRADE.includes(schweregrad)) schweregrad = 'Mittel';

  return { titel, beschreibung, kategorie, schweregrad };
}

module.exports = {
  generatePrompt,
  generateBossMovePrompt,
  draftTicketFromText,
  listModels,
  providerStatus,
  settingsStatus,
  systemPromptsStatus,
  saveSystemPrompt,
  saveKey,
  clearKey,
  saveCustomModel,
  LlmError,
  DEFAULT_MODEL,
};
