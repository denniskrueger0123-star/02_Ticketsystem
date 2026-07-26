// Serverseitige LLM-Anbindung zum Generieren von Claude-Code-Prompts.
// Der API-Key liegt NIEMALS im Frontend – er wird hier serverseitig aus der
// Umgebungsvariable ANTHROPIC_API_KEY oder der Datei api-key.txt gelesen.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.LLM_MODEL || 'claude-opus-5';
const KEY_FILE = path.join(__dirname, '..', '..', 'api-key.txt');

// Fehler mit Code, damit die Route eine passende Meldung/Statuscode wählen kann.
class LlmError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function resolveApiKey() {
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim()) {
    return process.env.ANTHROPIC_API_KEY.trim();
  }
  try {
    const key = fs.readFileSync(KEY_FILE, 'utf-8').trim();
    if (key) return key;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return null;
}

const SYSTEM_PROMPT =
  'Du bist ein Assistent, der aus Ticket-Beschreibungen präzise, umsetzbare ' +
  'Prompts für Claude Code (ein KI-Coding-Tool) formuliert. Schreibe den Prompt ' +
  'auf Deutsch, in der zweiten Person ("Implementiere...", "Analysiere..."). Er ' +
  'soll konkret genug sein, dass ein Entwickler-Agent direkt loslegen kann: nenne ' +
  'Ziel, betroffene Bereiche und sinnvolle Schritte. Gib AUSSCHLIESSLICH den ' +
  'fertigen Prompt-Text aus – keine Einleitung, keine Erklärung, keine ' +
  'Code-Blöcke oder Anführungszeichen drumherum.';

async function generatePrompt({ project, ticket }) {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new LlmError(
      'Kein API-Key konfiguriert. Lege eine Datei "api-key.txt" im Projektordner an ' +
        'und trage deinen Anthropic-API-Key hinein (oder setze die Umgebungsvariable ANTHROPIC_API_KEY).',
      'NO_KEY'
    );
  }

  const client = new Anthropic({ apiKey });

  const userContent =
    `Projekt: ${project.name}\n` +
    (project.description ? `Projektbeschreibung: ${project.description}\n` : '') +
    `\nTicket-Titel: ${ticket.titel}\n` +
    `Kategorie: ${ticket.kategorie} · Schweregrad: ${ticket.schweregrad} · Status: ${ticket.status}\n\n` +
    `Ticket-Beschreibung:\n${ticket.beschreibung || '(keine Beschreibung vorhanden)'}\n\n` +
    'Formuliere daraus einen Claude-Code-Prompt.';

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: userContent }],
    });
  } catch (err) {
    throw new LlmError(`LLM-Aufruf fehlgeschlagen: ${err.message}`, 'API_ERROR');
  }

  if (response.stop_reason === 'refusal') {
    throw new LlmError('Die Anfrage wurde vom Modell abgelehnt.', 'REFUSAL');
  }

  const text = (response.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  if (!text) {
    throw new LlmError('Das Modell hat keinen Text zurückgegeben.', 'EMPTY');
  }
  return text;
}

module.exports = { generatePrompt, LlmError };
