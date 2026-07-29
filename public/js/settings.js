const listEl = document.getElementById('settings-list');

function statusLine(info) {
  if (info.source === 'env') {
    return { text: `Aktiv über Umgebungsvariable ${info.keyEnv}`, cls: 'ok' };
  }
  if (info.source === 'file') {
    return { text: `Gespeichert: ${info.preview}`, cls: 'ok' };
  }
  return { text: 'Kein Key hinterlegt', cls: 'muted' };
}

function buildCard(provider, info) {
  const card = document.createElement('div');
  card.className = 'settings-card';

  const head = document.createElement('div');
  head.className = 'settings-card-head';
  const h3 = document.createElement('h3');
  h3.textContent = info.label;
  const dot = document.createElement('span');
  dot.className = `settings-dot ${info.configured ? 'on' : 'off'}`;
  head.append(dot, h3);
  card.appendChild(head);

  const status = document.createElement('p');
  const st = statusLine(info);
  status.className = `settings-status ${st.cls}`;
  status.textContent = st.text;
  card.appendChild(status);

  const row = document.createElement('div');
  row.className = 'settings-row';
  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = info.source === 'env' ? 'Wird per Umgebungsvariable gesetzt' : 'API-Key einfügen…';
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (info.source === 'env') input.disabled = true;

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.textContent = 'Anzeigen';
  toggleBtn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggleBtn.textContent = show ? 'Verbergen' : 'Anzeigen';
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Speichern';
  saveBtn.disabled = info.source === 'env';

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn-danger';
  clearBtn.textContent = 'Löschen';
  clearBtn.disabled = info.source !== 'file';

  const hint = document.createElement('span');
  hint.className = 'settings-hint';

  saveBtn.addEventListener('click', async () => {
    if (!input.value.trim()) {
      hint.className = 'settings-hint error';
      hint.textContent = 'Bitte zuerst einen Key eingeben.';
      return;
    }
    hint.className = 'settings-hint';
    hint.textContent = 'Speichere…';
    saveBtn.disabled = true;
    try {
      await api.saveSetting(provider, input.value.trim());
      hint.className = 'settings-hint ok';
      hint.textContent = 'Gespeichert ✓';
      input.value = '';
      await loadSettings();
    } catch (err) {
      hint.className = 'settings-hint error';
      hint.textContent = err.message;
      saveBtn.disabled = false;
    }
  });

  clearBtn.addEventListener('click', async () => {
    if (!confirm(`Key für ${info.label} wirklich entfernen?`)) return;
    hint.className = 'settings-hint';
    hint.textContent = 'Entferne…';
    try {
      await api.clearSetting(provider);
      hint.className = 'settings-hint ok';
      hint.textContent = 'Entfernt ✓';
      await loadSettings();
    } catch (err) {
      hint.className = 'settings-hint error';
      hint.textContent = err.message;
    }
  });

  row.append(input, toggleBtn, saveBtn, clearBtn);
  card.append(row, hint);

  // ── Modell-Zeile: Modell-ID manuell eintragen ────────────────────
  const modelLabel = document.createElement('label');
  modelLabel.className = 'settings-sublabel';
  modelLabel.textContent = 'Modell (Modell-ID, die an die API geht)';

  const modelRow = document.createElement('div');
  modelRow.className = 'settings-row';
  const modelInput = document.createElement('input');
  modelInput.type = 'text';
  modelInput.autocomplete = 'off';
  modelInput.spellcheck = false;
  modelInput.value = info.model || '';
  modelInput.placeholder = info.exampleModel ? `z. B. ${info.exampleModel}` : 'Modell-ID eintragen…';

  const modelSaveBtn = document.createElement('button');
  modelSaveBtn.className = 'btn-primary';
  modelSaveBtn.textContent = 'Modell speichern';

  const modelClearBtn = document.createElement('button');
  modelClearBtn.textContent = 'Zurücksetzen';
  modelClearBtn.disabled = !info.model;

  const fetchBtn = document.createElement('button');
  fetchBtn.textContent = '🔄 Modelle abrufen';
  fetchBtn.title = 'Verfügbare Modelle direkt beim Anbieter abfragen';

  const modelHint = document.createElement('span');
  modelHint.className = 'settings-hint';
  modelHint.textContent = info.model
    ? `Aktiv: ${info.model} – erscheint im „KI-Modell“-Dropdown.`
    : 'Optional. Leer = nur die vorgegebenen Modelle nutzen.';

  const fetchHint = document.createElement('span');
  fetchHint.className = 'settings-hint';
  if (info.fetchedCount) {
    const when = info.fetchedAt
      ? new Date(info.fetchedAt).toLocaleString('de-DE', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : '';
    fetchHint.className = 'settings-hint ok';
    fetchHint.textContent = `${info.fetchedCount} Modelle abgerufen${when ? ` (${when})` : ''} – im Dropdown verfügbar.`;
  } else {
    fetchHint.textContent = 'Noch keine Modelle abgerufen.';
  }

  fetchBtn.addEventListener('click', async () => {
    fetchHint.className = 'settings-hint';
    fetchHint.innerHTML = '<span class="spinner"></span>Modelle werden abgerufen…';
    fetchBtn.disabled = true;
    try {
      const result = await api.fetchProviderModels(provider);
      // Erfolg: Neu laden zeigt Anzahl/Zeitpunkt aus dem Server-Status.
      await loadSettings();
      console.info(`[Modelle] ${provider}: ${result.count} Modelle abgerufen.`);
    } catch (err) {
      // Fehler: bestehende Auswahl bleibt unverändert, nur Meldung anzeigen.
      fetchHint.className = 'settings-hint error';
      fetchHint.textContent = err.message;
      fetchBtn.disabled = false;
    }
  });

  async function saveModel(value) {
    modelHint.className = 'settings-hint';
    modelHint.textContent = 'Speichere…';
    modelSaveBtn.disabled = true;
    try {
      await api.saveSettingModel(provider, value);
      await loadSettings();
    } catch (err) {
      modelHint.className = 'settings-hint error';
      modelHint.textContent = err.message;
      modelSaveBtn.disabled = false;
    }
  }
  modelSaveBtn.addEventListener('click', () => saveModel(modelInput.value.trim()));
  modelClearBtn.addEventListener('click', () => saveModel(''));

  modelRow.append(modelInput, modelSaveBtn, modelClearBtn);
  card.append(modelLabel, modelRow, modelHint);

  const fetchRow = document.createElement('div');
  fetchRow.className = 'settings-row';
  fetchRow.append(fetchBtn, fetchHint);
  card.appendChild(fetchRow);
  return card;
}

const SYSPROMPT_LABELS = {
  promptGenerator: 'System-Anweisung: Claude-Code-Prompt-Generator',
  ticketDraft: 'System-Anweisung: Ticket-Entwurf aus Freitext',
};

const sysListEl = document.getElementById('sysprompts-list');

function buildSysPromptCard(key, info) {
  const card = document.createElement('div');
  card.className = 'settings-card';

  const head = document.createElement('div');
  head.className = 'settings-card-head';
  const h3 = document.createElement('h3');
  h3.textContent = SYSPROMPT_LABELS[key] || key;
  head.appendChild(h3);
  card.appendChild(head);

  const status = document.createElement('p');
  status.className = `settings-status ${info.isDefault ? 'muted' : 'ok'}`;
  status.textContent = info.isDefault ? 'Standardtext (unverändert)' : 'Angepasst';
  card.appendChild(status);

  const ta = document.createElement('textarea');
  ta.className = 'sysprompt-text';
  ta.rows = 6;
  ta.value = info.text || '';
  card.appendChild(ta);

  const actions = document.createElement('div');
  actions.className = 'settings-row';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Speichern';
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Auf Standard zurücksetzen';
  resetBtn.disabled = info.isDefault;
  const hint = document.createElement('span');
  hint.className = 'settings-hint';

  saveBtn.addEventListener('click', async () => {
    hint.className = 'settings-hint';
    hint.textContent = 'Speichere…';
    saveBtn.disabled = true;
    try {
      await api.saveSystemPrompt(key, ta.value.trim());
      await loadSettings();
    } catch (err) {
      hint.className = 'settings-hint error';
      hint.textContent = err.message;
      saveBtn.disabled = false;
    }
  });
  resetBtn.addEventListener('click', async () => {
    if (!confirm('Diese System-Anweisung auf den Standardtext zurücksetzen?')) return;
    try {
      await api.saveSystemPrompt(key, '');
      await loadSettings();
    } catch (err) {
      hint.className = 'settings-hint error';
      hint.textContent = err.message;
    }
  });

  actions.append(saveBtn, resetBtn, hint);
  card.appendChild(actions);
  return card;
}

async function loadSettings() {
  listEl.innerHTML = '';
  if (sysListEl) sysListEl.innerHTML = '';
  let data;
  try {
    data = await api.getSettings();
  } catch (err) {
    listEl.textContent = 'Einstellungen konnten nicht geladen werden.';
    return;
  }
  Object.entries(data.providers).forEach(([provider, info]) => {
    listEl.appendChild(buildCard(provider, info));
  });
  if (sysListEl && data.systemPrompts) {
    Object.entries(data.systemPrompts).forEach(([key, info]) => {
      sysListEl.appendChild(buildSysPromptCard(key, info));
    });
  }
}

loadSettings();
