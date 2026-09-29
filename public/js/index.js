const projectListEl = document.getElementById('project-list');
const modalEl = document.getElementById('project-modal');
const formEl = document.getElementById('project-form');
const modalTitleEl = document.getElementById('modal-title');
const idInput = document.getElementById('project-id');
const nameInput = document.getElementById('project-name');
const descInput = document.getElementById('project-description');
const skillInput = document.getElementById('project-skill');
const formErrorEl = document.getElementById('project-form-error');

document.getElementById('new-project-btn').addEventListener('click', () => openModal());
document.getElementById('project-cancel-btn').addEventListener('click', closeModal);
formEl.addEventListener('submit', onSubmit);

const importBtn = document.getElementById('import-project-btn');
const importFileInput = document.getElementById('import-file-input');
importBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', onImportFile);

const importModalEl = document.getElementById('import-modal');
const importTargetEl = document.getElementById('import-target');
const importHintEl = document.getElementById('import-hint');
const importConfirmBtn = document.getElementById('import-confirm-btn');
const importModeEls = document.querySelectorAll('input[name="import-mode"]');
// Geparste Datei bleibt hier, bis der Dialog bestätigt oder abgebrochen wird –
// so genügen einmal registrierte Listener.
let pendingImportData = null;

const IMPORT_HINTS = {
  new: '',
  append: 'Tickets werden hinzugefügt, Nummern werden fortlaufend neu vergeben.',
  replace: 'Alle bestehenden Tickets des Zielprojekts werden gelöscht.',
};

function selectedImportMode() {
  return document.querySelector('input[name="import-mode"]:checked').value;
}

function updateImportModeUi() {
  const mode = selectedImportMode();
  importTargetEl.disabled = mode === 'new';
  importHintEl.textContent = IMPORT_HINTS[mode];
}

function closeImportModal() {
  importModalEl.classList.add('hidden');
  pendingImportData = null;
}

importModeEls.forEach((el) => el.addEventListener('change', updateImportModeUi));
document.getElementById('import-cancel-btn').addEventListener('click', closeImportModal);
importConfirmBtn.addEventListener('click', onImportConfirm);

async function onImportFile() {
  const file = importFileInput.files && importFileInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Die Datei ist kein gültiges JSON.');
    }
    const projects = await api.listProjects();
    importTargetEl.innerHTML = '';
    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      importTargetEl.appendChild(opt);
    }
    document.querySelector('input[name="import-mode"][value="new"]').checked = true;
    updateImportModeUi();
    pendingImportData = data;
    importModalEl.classList.remove('hidden');
  } catch (err) {
    alert('Import fehlgeschlagen: ' + err.message);
  } finally {
    importFileInput.value = '';
  }
}

async function onImportConfirm() {
  if (!pendingImportData) return;
  const mode = selectedImportMode();
  const targetProjectId = mode === 'new' ? undefined : importTargetEl.value;
  if (mode !== 'new' && !targetProjectId) {
    alert('Bitte ein Zielprojekt wählen.');
    return;
  }
  importConfirmBtn.disabled = true;
  try {
    if (mode === 'replace') {
      const existing = await api.listTickets(targetProjectId);
      if (!confirm(`${existing.length} Tickets werden gelöscht. Unwiderruflich.`)) return;
    }
    const result = await api.importProject(pendingImportData, { mode, targetProjectId });
    closeImportModal();
    await loadProjects();
    let msg;
    if (mode === 'append') {
      msg = `„${result.project.name}": ${result.ticketCount} Ticket(s) angehängt.`;
    } else if (mode === 'replace') {
      msg = `„${result.project.name}": ${result.deletedCount} Ticket(s) gelöscht, ${result.ticketCount} importiert.`;
    } else {
      msg = `Importiert: „${result.project.name}" mit ${result.ticketCount} Ticket(s) als neues Projekt.`;
    }
    const unbekannt = result.unbekannteWerte || [];
    if (unbekannt.length > 0) {
      const lines = [msg, `⚠ ${unbekannt.length} Wert(e) nicht zugeordnet – ersetzt:`];
      unbekannt.slice(0, 10).forEach((u) => lines.push(`– ${u.titel}: ${u.feld} „${u.wert}“ → „${u.ersetztDurch}“`));
      if (unbekannt.length > 10) lines.push(`… und ${unbekannt.length - 10} weitere`);
      msg = lines.join('\n');
    }
    alert(msg);
  } catch (err) {
    alert('Import fehlgeschlagen: ' + err.message);
  } finally {
    importConfirmBtn.disabled = false;
  }
}

document.getElementById('export-all-btn').addEventListener('click', () => {
  window.location.href = api.exportAllProjectsUrl();
});

const importAllBtn = document.getElementById('import-all-btn');
const importAllFileInput = document.getElementById('import-all-file-input');
importAllBtn.addEventListener('click', () => importAllFileInput.click());
importAllFileInput.addEventListener('change', onImportAllFile);

async function onImportAllFile() {
  const file = importAllFileInput.files && importAllFileInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Die Datei ist kein gültiges JSON.');
    }
    const result = await api.importAllProjects(data);
    await loadProjects();
    const lines = [`${result.imported.length} Projekt(e) importiert.`];
    if (result.failed.length > 0) {
      lines.push(`${result.failed.length} fehlgeschlagen:`);
      result.failed.forEach((f) => lines.push(`– „${f.name}": ${f.error}`));
    }
    result.imported.forEach((p) => {
      const n = (p.unbekannteWerte || []).length;
      if (n > 0) lines.push(`– „${p.name}“: ${n} Wert(e) nicht zugeordnet (ersetzt)`);
    });
    alert(lines.join('\n'));
  } catch (err) {
    alert('Import fehlgeschlagen: ' + err.message);
  } finally {
    importAllFileInput.value = '';
  }
}

function openModal(project) {
  formErrorEl.textContent = '';
  if (project) {
    modalTitleEl.textContent = 'Projekt bearbeiten';
    idInput.value = project.id;
    nameInput.value = project.name;
    descInput.value = project.description || '';
    skillInput.value = project.promptSkill || '';
  } else {
    modalTitleEl.textContent = 'Neues Projekt';
    idInput.value = '';
    nameInput.value = '';
    descInput.value = '';
    skillInput.value = '';
  }
  modalEl.classList.remove('hidden');
  nameInput.focus();
}

function closeModal() {
  modalEl.classList.add('hidden');
}

async function onSubmit(e) {
  e.preventDefault();
  formErrorEl.textContent = '';
  const data = {
    name: nameInput.value.trim(),
    description: descInput.value.trim(),
    promptSkill: skillInput.value.trim(),
  };
  try {
    if (idInput.value) {
      await api.updateProject(idInput.value, data);
    } else {
      await api.createProject(data);
    }
    closeModal();
    await loadProjects();
  } catch (err) {
    formErrorEl.textContent = err.message;
  }
}

async function deleteProject(project) {
  if (!confirm(`Projekt "${project.name}" inkl. aller Tickets wirklich löschen?`)) return;
  try {
    await api.deleteProject(project.id);
  } catch (err) {
    alert(`Löschen fehlgeschlagen: ${err.message}`);
    return;
  }
  await loadProjects();
}

function fmtDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function projectMeta(project) {
  const parts = [];
  const created = fmtDateTime(project.createdAt);
  if (created) parts.push(`Erstellt: ${created}`);
  const imported = fmtDateTime(project.importedAt);
  if (imported) parts.push(`Importiert: ${imported}`);
  const exported = fmtDateTime(project.lastExportedAt);
  if (exported) parts.push(`Zuletzt exportiert: ${exported}`);
  return parts.join('  ·  ');
}

function renderProjects(projects) {
  projectListEl.innerHTML = '';
  if (projects.length === 0) {
    projectListEl.innerHTML = '<div class="empty-state">Noch keine Projekte. Lege dein erstes Projekt an.</div>';
    return;
  }
  for (const project of projects) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <h3></h3>
      <p class="pdesc"></p>
      <p class="pmeta"></p>
      <div class="pactions">
        <button class="edit-btn">Bearbeiten</button>
        <button class="export-btn">Exportieren</button>
        <button class="btn-danger delete-btn">Löschen</button>
      </div>
    `;
    card.querySelector('h3').textContent = project.name;
    card.querySelector('.pdesc').textContent = project.description || '';
    card.querySelector('.pmeta').textContent = projectMeta(project);

    card.addEventListener('click', () => {
      window.location.href = `project.html?id=${encodeURIComponent(project.id)}`;
    });
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(project);
    });
    card.querySelector('.export-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = api.exportProjectUrl(project.id);
    });
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProject(project);
    });

    projectListEl.appendChild(card);
  }
}

async function loadProjects() {
  const projects = await api.listProjects();
  renderProjects(projects);
}

loadProjects();

const backupBtn = document.getElementById('backup-btn');
const backupStatusEl = document.getElementById('backup-status');

async function loadBackupStatus() {
  try {
    const { letztesBackup } = await api.getBackupStatus();
    const zeit = letztesBackup && fmtDateTime(letztesBackup.zeitpunkt);
    backupStatusEl.textContent = zeit ? `Letztes Backup: ${zeit}` : 'Noch kein Backup vorhanden.';
  } catch (err) {
    backupStatusEl.textContent = '';
  }
}

backupBtn.addEventListener('click', async () => {
  backupBtn.disabled = true;
  backupStatusEl.classList.remove('error');
  backupStatusEl.textContent = 'Sichere…';
  try {
    const r = await api.createBackup();
    backupStatusEl.textContent =
      `Backup gespeichert: ${r.anzahlProjekte} Projekt(e), ${r.anzahlTickets} Ticket(s) – ${fmtDateTime(r.zeitpunkt)}`;
  } catch (err) {
    backupStatusEl.classList.add('error');
    backupStatusEl.textContent = 'Backup fehlgeschlagen: ' + err.message;
  } finally {
    backupBtn.disabled = false;
  }
});

loadBackupStatus();
