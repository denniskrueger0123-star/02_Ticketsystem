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

  const modelHint = document.createElement('span');
  modelHint.className = 'settings-hint';
  modelHint.textContent = info.model
    ? `Aktiv: ${info.model} – erscheint im „KI-Modell“-Dropdown.`
    : 'Optional. Leer = nur die vorgegebenen Modelle nutzen.';

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
  return card;
}

async function loadSettings() {
  listEl.innerHTML = '';
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
}

loadSettings();
