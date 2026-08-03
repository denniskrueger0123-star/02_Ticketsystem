const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');
if (!projectId) window.location.href = 'index.html';

const SEV_ORDER = ['Kritisch', 'Hoch', 'Mittel', 'Klein', 'Recherche'];

const titleEl = document.getElementById('project-title');
const subEl = document.getElementById('project-sub');
const statsEl = document.getElementById('stats');
const ovwBody = document.getElementById('ovw-body');
const detailWrap = document.getElementById('detail-wrap');
const counterEl = document.getElementById('counter');
const footEl = document.getElementById('pagefoot');
const modelSelect = document.getElementById('model-select');

// Modal
const modalEl = document.getElementById('ticket-modal');
const formEl = document.getElementById('ticket-form');
const modalTitleEl = document.getElementById('ticket-modal-title');
const idInput = document.getElementById('ticket-id');
const titelInput = document.getElementById('ticket-titel');
const beschreibungInput = document.getElementById('ticket-beschreibung');
const kategorieInput = document.getElementById('ticket-kategorie');
const schweregradInput = document.getElementById('ticket-schweregrad');
const statusInput = document.getElementById('ticket-status');
const bmInput = document.getElementById('ticket-bm');
const formErrorEl = document.getElementById('ticket-form-error');

// Projekt-Anweisungen (Skill) Modal
const projectEditModalEl = document.getElementById('project-edit-modal');
const projectEditFormEl = document.getElementById('project-edit-form');
const peSkillInput = document.getElementById('pe-skill');
const projectEditErrorEl = document.getElementById('project-edit-error');

// Readme Modal (Bearbeiten) + View-Popup (Lesen)
const readmeModalEl = document.getElementById('readme-modal');
const readmeTextInput = document.getElementById('readme-text');
const readmePreviewEl = document.getElementById('readme-preview');
const readmeHintEl = document.getElementById('readme-hint');
const readmeViewModalEl = document.getElementById('readme-view-modal');
const readmeViewRenderEl = document.getElementById('readme-view-render');

// Idee → Ticket Modal
const ideaModalEl = document.getElementById('idea-modal');
const ideaTextInput = document.getElementById('idea-text');
const ideaHintEl = document.getElementById('idea-hint');
const ideaDraftEl = document.getElementById('idea-draft');
const ideaTitelInput = document.getElementById('idea-titel');
const ideaBeschreibungInput = document.getElementById('idea-beschreibung');
const ideaKategorieInput = document.getElementById('idea-kategorie');
const ideaSchweregradInput = document.getElementById('idea-schweregrad');
const ideaCreateBtn = document.getElementById('idea-create-btn');

// Boss Move Modal
const bmModalEl = document.getElementById('bm-modal');
const bmCountEl = document.getElementById('bm-count');
const bmSkillInput = document.getElementById('bm-skill');
const bmOutputInput = document.getElementById('bm-output');
const bmHintEl = document.getElementById('bm-hint');

let projectData = null;
let allTickets = [];
const state = { cat: 'all', sev: 'all', st: 'all', bm: 'all', search: '', detailview: 'severity' };
let cards = []; // { ticket, cardEl, rowEl, severity }

const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', () => {
  state.search = searchInput.value.trim().toLowerCase();
  applyFilters();
});

const scrollTopBtn = document.getElementById('scroll-top-btn');
window.addEventListener('scroll', () => {
  scrollTopBtn.classList.toggle('hidden', window.scrollY < 400);
});
scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('new-ticket-btn').addEventListener('click', () => openModal());
document.getElementById('ticket-cancel-btn').addEventListener('click', closeModal);
formEl.addEventListener('submit', onSubmit);

document.getElementById('export-project-btn').addEventListener('click', () => {
  window.location.href = api.exportProjectUrl(projectId);
});
document.getElementById('edit-project-btn').addEventListener('click', openProjectEditModal);
document.getElementById('project-edit-cancel-btn').addEventListener('click', closeProjectEditModal);
projectEditFormEl.addEventListener('submit', onProjectEditSubmit);

function openProjectEditModal() {
  projectEditErrorEl.textContent = '';
  peSkillInput.value = projectData.promptSkill || '';
  projectEditModalEl.classList.remove('hidden');
  peSkillInput.focus();
}
function closeProjectEditModal() {
  projectEditModalEl.classList.add('hidden');
}
async function onProjectEditSubmit(e) {
  e.preventDefault();
  projectEditErrorEl.textContent = '';
  try {
    projectData = await api.updateProject(projectId, { promptSkill: peSkillInput.value.trim() });
    closeProjectEditModal();
  } catch (err) {
    projectEditErrorEl.textContent = err.message;
  }
}

// ── Projekt-Readme (Teil B) ─────────────────────────────────────────
document.getElementById('readme-open-btn').addEventListener('click', () => {
  const md = (projectData && projectData.projektReadme) || '';
  if (md.trim()) openReadmeViewModal();
  else openReadmeModal();
});
document.getElementById('readme-cancel-btn').addEventListener('click', () => readmeModalEl.classList.add('hidden'));
document.getElementById('readme-save-btn').addEventListener('click', saveReadme);
document.getElementById('readme-upload-btn').addEventListener('click', () =>
  document.getElementById('readme-file-input').click()
);
document.getElementById('readme-file-input').addEventListener('change', onReadmeFile);
document.getElementById('readme-preview-toggle').addEventListener('click', toggleReadmePreview);
document.getElementById('readme-view-close-btn').addEventListener('click', () => readmeViewModalEl.classList.add('hidden'));
document.getElementById('readme-view-edit-btn').addEventListener('click', () => {
  readmeViewModalEl.classList.add('hidden');
  openReadmeModal();
});

function openReadmeViewModal() {
  const md = (projectData && projectData.projektReadme) || '';
  readmeViewRenderEl.innerHTML = renderMarkdown(md);
  readmeViewModalEl.classList.remove('hidden');
}

function openReadmeModal() {
  readmeHintEl.className = 'prompt-hint';
  readmeHintEl.textContent = '';
  readmeTextInput.value = (projectData && projectData.projektReadme) || '';
  readmePreviewEl.classList.add('hidden');
  document.getElementById('readme-preview-toggle').textContent = 'Vorschau anzeigen';
  readmeModalEl.classList.remove('hidden');
  readmeTextInput.focus();
}

function toggleReadmePreview() {
  const btn = document.getElementById('readme-preview-toggle');
  if (readmePreviewEl.classList.contains('hidden')) {
    readmePreviewEl.innerHTML = renderMarkdown(readmeTextInput.value);
    readmePreviewEl.classList.remove('hidden');
    btn.textContent = 'Vorschau ausblenden';
  } else {
    readmePreviewEl.classList.add('hidden');
    btn.textContent = 'Vorschau anzeigen';
  }
}

async function onReadmeFile() {
  const input = document.getElementById('readme-file-input');
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    readmeTextInput.value = text;
    readmeHintEl.className = 'prompt-hint ok';
    readmeHintEl.textContent = `„${file.name}“ geladen – noch speichern.`;
    if (!readmePreviewEl.classList.contains('hidden')) {
      readmePreviewEl.innerHTML = renderMarkdown(readmeTextInput.value);
    }
  } catch (err) {
    readmeHintEl.className = 'prompt-hint error';
    readmeHintEl.textContent = 'Datei konnte nicht gelesen werden.';
  } finally {
    input.value = '';
  }
}

async function saveReadme() {
  readmeHintEl.className = 'prompt-hint';
  readmeHintEl.textContent = 'Speichere…';
  try {
    projectData = await api.updateProject(projectId, { projektReadme: readmeTextInput.value });
    readmeModalEl.classList.add('hidden');
  } catch (err) {
    readmeHintEl.className = 'prompt-hint error';
    readmeHintEl.textContent = err.message;
  }
}

// ── Idee → Ticket (Teil C) ──────────────────────────────────────────
document.getElementById('idea-open-btn').addEventListener('click', openIdeaModal);
document.getElementById('idea-cancel-btn').addEventListener('click', () => ideaModalEl.classList.add('hidden'));
document.getElementById('idea-generate-btn').addEventListener('click', generateIdeaDraft);
ideaCreateBtn.addEventListener('click', createIdeaTicket);

function openIdeaModal() {
  ideaHintEl.className = 'prompt-hint';
  ideaHintEl.textContent = '';
  ideaTextInput.value = '';
  ideaDraftEl.classList.add('hidden');
  ideaCreateBtn.classList.add('hidden');
  ideaModalEl.classList.remove('hidden');
  ideaTextInput.focus();
}

async function generateIdeaDraft() {
  const text = ideaTextInput.value.trim();
  if (!text) {
    ideaHintEl.className = 'prompt-hint error';
    ideaHintEl.textContent = 'Bitte zuerst eine Idee beschreiben.';
    return;
  }
  const genBtn = document.getElementById('idea-generate-btn');
  ideaHintEl.className = 'prompt-hint';
  ideaHintEl.innerHTML = '<span class="spinner"></span>Entwurf wird generiert… (kann einen Moment dauern)';
  genBtn.disabled = true;
  try {
    const draft = await api.draftTicket(projectId, text, modelSelect.value);
    ideaTitelInput.value = draft.titel || '';
    ideaBeschreibungInput.value = draft.beschreibung || '';
    ideaKategorieInput.value = draft.kategorie || 'Prozess';
    ideaSchweregradInput.value = draft.schweregrad || 'Mittel';
    ideaDraftEl.classList.remove('hidden');
    ideaCreateBtn.classList.remove('hidden');
    ideaHintEl.className = 'prompt-hint ok';
    ideaHintEl.textContent = 'Entwurf erstellt – bei Bedarf anpassen und „Ticket erstellen“.';
  } catch (err) {
    ideaHintEl.className = 'prompt-hint error';
    ideaHintEl.textContent = err.message;
  } finally {
    genBtn.disabled = false;
  }
}

async function createIdeaTicket() {
  const data = {
    titel: ideaTitelInput.value.trim(),
    beschreibung: ideaBeschreibungInput.value.trim(),
    kategorie: ideaKategorieInput.value,
    schweregrad: ideaSchweregradInput.value,
    status: 'Offen',
  };
  if (!data.titel) {
    ideaHintEl.className = 'prompt-hint error';
    ideaHintEl.textContent = 'Der Titel darf nicht leer sein.';
    return;
  }
  ideaCreateBtn.disabled = true;
  ideaHintEl.className = 'prompt-hint';
  ideaHintEl.textContent = 'Ticket wird angelegt…';
  try {
    await api.createTicket(projectId, data);
    ideaModalEl.classList.add('hidden');
    await loadTickets();
  } catch (err) {
    ideaHintEl.className = 'prompt-hint error';
    ideaHintEl.textContent = err.message;
  } finally {
    ideaCreateBtn.disabled = false;
  }
}

// ── Boss Move ───────────────────────────────────────────────────────
document.getElementById('bm-open-btn').addEventListener('click', openBmModal);
document.getElementById('bm-close-btn').addEventListener('click', () => bmModalEl.classList.add('hidden'));
document.getElementById('bm-skill-save-btn').addEventListener('click', saveBmSkill);
document.getElementById('bm-generate-btn').addEventListener('click', generateBmPrompt);
document.getElementById('bm-copy-btn').addEventListener('click', copyBmPrompt);

function bmTicketCount() {
  return allTickets.filter((t) => t.bmStatus === true).length;
}

function updateBmCount() {
  const n = bmTicketCount();
  const btn = document.getElementById('bm-open-btn');
  if (btn) btn.textContent = n > 0 ? `🟢 Boss Move (${n})` : '🟢 Boss Move';
  if (bmCountEl) {
    bmCountEl.textContent = n > 0
      ? `${n} Ticket(s) sind grün markiert und werden zusammengeführt.`
      : 'Noch keine Tickets grün markiert – markiere Tickets über den BM-Schalter, um sie einzubeziehen.';
  }
}

function openBmModal() {
  bmHintEl.className = 'prompt-hint';
  bmHintEl.textContent = '';
  bmSkillInput.value = projectData.bmPromptSkill || '';
  bmOutputInput.value = projectData.bmPrompt || '';
  updateBmCount();
  bmModalEl.classList.remove('hidden');
  bmSkillInput.focus();
}

async function saveBmSkill() {
  bmHintEl.className = 'prompt-hint';
  bmHintEl.textContent = 'Speichere…';
  try {
    projectData = await api.updateProject(projectId, { bmPromptSkill: bmSkillInput.value.trim() });
    bmHintEl.className = 'prompt-hint ok';
    bmHintEl.textContent = 'Anweisung gespeichert ✓';
  } catch (err) {
    bmHintEl.className = 'prompt-hint error';
    bmHintEl.textContent = err.message;
  }
}

async function generateBmPrompt() {
  if (bmTicketCount() === 0) {
    bmHintEl.className = 'prompt-hint error';
    bmHintEl.textContent = 'Keine Tickets grün markiert.';
    return;
  }
  const genBtn = document.getElementById('bm-generate-btn');
  bmHintEl.className = 'prompt-hint';
  bmHintEl.textContent = 'Generiere Super-Prompt… (kann einen Moment dauern)';
  genBtn.disabled = true;
  try {
    // Erst die separate BM-Anweisung speichern, damit sie serverseitig einfließt.
    projectData = await api.updateProject(projectId, { bmPromptSkill: bmSkillInput.value.trim() });
    const result = await api.generateBmPrompt(projectId, modelSelect.value);
    projectData.bmPrompt = result.bmPrompt;
    bmOutputInput.value = result.bmPrompt;
    bmHintEl.className = 'prompt-hint ok';
    bmHintEl.textContent = `Aus ${result.ticketCount} Ticket(s) generiert ✓`;
  } catch (err) {
    bmHintEl.className = 'prompt-hint error';
    bmHintEl.textContent = err.message;
  } finally {
    genBtn.disabled = false;
  }
}

// Robuster Clipboard-Zugriff: navigator.clipboard erfordert einen sicheren
// Kontext (HTTPS/localhost) und ist z.B. bei Zugriff per LAN-IP oder über
// einen Tunnel ohne festen Fokus nicht verfügbar bzw. schlägt fehl. Fallback
// über ein verstecktes Textarea + execCommand('copy') deckt diese Fälle ab.
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('execCommand copy fehlgeschlagen');
}

async function copyBmPrompt() {
  try {
    await copyToClipboard(bmOutputInput.value);
    bmHintEl.className = 'prompt-hint ok';
    bmHintEl.textContent = 'Kopiert ✓';
  } catch (err) {
    bmHintEl.className = 'prompt-hint error';
    bmHintEl.textContent = 'Kopieren fehlgeschlagen';
  }
}
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const dim = chip.dataset.dim;
    state[dim] = chip.dataset.val;
    document.querySelectorAll(`.chip[data-dim="${dim}"]`).forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    // Die Detailansicht-Gruppierung ändert die DOM-Struktur der Detailkarten,
    // ein reines Ein-/Ausblenden über applyFilters() reicht dafür nicht.
    if (dim === 'detailview') render();
    else applyFilters();
  });
});

function slug(s) {
  return s.replace(/\s/g, '');
}
function splitNum(titel) {
  const m = titel.match(/^(#\d+)\s+(.*)$/s);
  return m ? { num: m[1], rest: m[2] } : { num: '', rest: titel };
}

// Numerisch aufsteigend nach der Ticket-Nummer (z.B. "#001" -> 1); Tickets
// ohne Nummer landen am Ende.
function ticketSortValue(t) {
  const { num } = splitNum(t.titel);
  const n = num ? parseInt(num.slice(1), 10) : NaN;
  return Number.isNaN(n) ? Infinity : n;
}

function matches(t) {
  return (
    (state.cat === 'all' || t.kategorie === state.cat) &&
    (state.sev === 'all' || t.schweregrad === state.sev) &&
    (state.st === 'all' || t.status === state.st) &&
    (state.bm === 'all' || (state.bm === 'yes' ? t.bmStatus === true : t.bmStatus !== true)) &&
    (!state.search || (t.titel || '').toLowerCase().includes(state.search))
  );
}

function tagRow(t) {
  const row = document.createElement('div');
  row.className = 'tagrow';
  const cat = document.createElement('span');
  cat.className = `tag tag-cat-${t.kategorie}`;
  cat.textContent = t.kategorie;
  const sev = document.createElement('span');
  sev.className = `tag tag-sev-${t.schweregrad}`;
  sev.textContent = t.schweregrad;
  const st = document.createElement('span');
  st.className = `tag tag-st-${slug(t.status)}`;
  st.textContent = t.status;
  row.append(cat, sev, st);
  return row;
}

// ── Rendering ───────────────────────────────────────────────────────
function render() {
  titleEl.textContent = projectData.name;
  ovwBody.innerHTML = '';
  detailWrap.innerHTML = '';
  cards = [];

  const rowByTicket = new Map();

  // Übersichtstabelle
  allTickets.forEach((t) => {
    const { num, rest } = splitNum(t.titel);
    const tr = document.createElement('tr');
    const tdNum = document.createElement('td');
    tdNum.className = 'num';
    tdNum.textContent = num || '–';
    const tdTitle = document.createElement('td');
    tdTitle.className = 'titlecell';
    tdTitle.textContent = rest;
    const tdCat = document.createElement('td');
    tdCat.appendChild(makeTag(`tag-cat-${t.kategorie}`, t.kategorie));
    const tdSev = document.createElement('td');
    tdSev.appendChild(makeTag(`tag-sev-${t.schweregrad}`, t.schweregrad));
    const tdSt = document.createElement('td');
    tdSt.appendChild(makeStatusSelect(t));
    const tdBm = document.createElement('td');
    tdBm.className = 'bm-cell';
    const bmDot = document.createElement('span');
    bmDot.className = 'bm-dot' + (t.bmStatus ? ' on' : '');
    bmDot.title = t.bmStatus ? 'Boss Move: grün' : 'nicht markiert';
    tdBm.appendChild(bmDot);
    tr.append(tdNum, tdTitle, tdCat, tdSev, tdSt, tdBm);
    tr.addEventListener('click', () => {
      const el = document.getElementById(`card-${t.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    ovwBody.appendChild(tr);
    rowByTicket.set(t.id, tr);
  });

  // Detailkarten: entweder nach Schweregrad gruppiert, oder als eine
  // durchgehende, numerisch sortierte Liste (Umschalter "Detailansicht").
  if (state.detailview === 'number') {
    const container = document.createElement('div');
    container.className = 'cards';
    detailWrap.appendChild(container);

    allTickets.forEach((t) => {
      const cardEl = buildCard(t);
      container.appendChild(cardEl);
      cards.push({ ticket: t, cardEl, rowEl: rowByTicket.get(t.id), severity: 'all', headEl: null, container });
    });
  } else {
    SEV_ORDER.forEach((sev) => {
      const group = allTickets.filter((t) => t.schweregrad === sev);
      if (group.length === 0) return;

      const head = document.createElement('div');
      head.className = 'sevgroup-head';
      head.dataset.sev = sev;
      const dot = document.createElement('span');
      dot.className = `dot dot-${sev}`;
      const h2 = document.createElement('h2');
      h2.textContent = sev;
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = `(${group.length} Tickets)`;
      head.append(dot, h2, count);
      detailWrap.appendChild(head);

      const container = document.createElement('div');
      container.className = 'cards';
      detailWrap.appendChild(container);

      group.forEach((t) => {
        const cardEl = buildCard(t);
        container.appendChild(cardEl);
        cards.push({ ticket: t, cardEl, rowEl: rowByTicket.get(t.id), severity: sev, headEl: head, container });
      });
    });
  }

  footEl.textContent = `${projectData.name} · Ideensammlung als Ticketsystem`;
  applyFilters();
  updateBmCount();
}

const STATUS_OPTIONS = ['Offen', 'In Arbeit', 'Erledigt', 'Zurückgestellt'];

// Kompaktes Status-Dropdown für die Übersichtstabelle – Status direkt ändern.
function makeStatusSelect(t) {
  const sel = document.createElement('select');
  sel.className = `ovw-status st-${slug(t.status)}`;
  STATUS_OPTIONS.forEach((s) => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = s;
    if (s === t.status) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('click', (e) => e.stopPropagation());
  sel.addEventListener('change', async (e) => {
    e.stopPropagation();
    const newStatus = sel.value;
    const prev = t.status;
    sel.disabled = true;
    try {
      await api.updateTicket(projectId, t.id, { status: newStatus });
      t.status = newStatus;
      const y = window.scrollY;
      await loadTickets();
      window.scrollTo(0, y);
    } catch (err) {
      alert('Status konnte nicht geändert werden: ' + err.message);
      sel.value = prev;
      sel.disabled = false;
    }
  });
  return sel;
}

function makeTag(cls, text) {
  const s = document.createElement('span');
  s.className = `tag ${cls}`;
  s.textContent = text;
  return s;
}

function buildCard(t) {
  const { num, rest } = splitNum(t.titel);
  const card = document.createElement('article');
  card.className = `ticket-card sev-${t.schweregrad}`;
  card.id = `card-${t.id}`;

  const head = document.createElement('div');
  head.className = 'cardhead';
  if (num) {
    const nt = document.createElement('span');
    nt.className = 'numtag';
    nt.textContent = num;
    head.appendChild(nt);
  }
  const h3 = document.createElement('h3');
  h3.textContent = rest;
  head.appendChild(h3);
  card.appendChild(head);

  const tr = tagRow(t);
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const bmBtn = document.createElement('button');
  bmBtn.className = 'bm-toggle' + (t.bmStatus ? ' on' : '');
  bmBtn.textContent = t.bmStatus ? '🟢 BM' : '⚪ BM';
  bmBtn.title = 'Boss-Move-Status umschalten';
  bmBtn.addEventListener('click', () => toggleBm(t, bmBtn));
  const editBtn = document.createElement('button');
  editBtn.textContent = 'Bearbeiten';
  editBtn.addEventListener('click', () => openModal(t));
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-danger';
  delBtn.textContent = 'Löschen';
  delBtn.addEventListener('click', () => deleteTicket(t));
  actions.append(bmBtn, editBtn, delBtn);
  tr.appendChild(actions);
  card.appendChild(tr);

  if (t.beschreibung) {
    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = t.beschreibung;
    card.appendChild(desc);
  }

  // Prompt-Bereich
  const box = document.createElement('div');
  box.className = 'prompt-box';
  const label = document.createElement('span');
  label.className = 'prompt-label';
  label.textContent = 'Claude-Code-Prompt';
  const ta = document.createElement('textarea');
  ta.rows = 4;
  ta.value = t.claudePrompt || '';
  ta.placeholder = 'Prompt manuell eintragen oder per Button generieren…';

  const pactions = document.createElement('div');
  pactions.className = 'prompt-actions';
  const genBtn = document.createElement('button');
  genBtn.textContent = '✨ Prompt generieren';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Speichern';
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Kopieren';
  const hint = document.createElement('span');
  hint.className = 'prompt-hint';

  genBtn.addEventListener('click', () => generate(t, ta, hint, genBtn));
  saveBtn.addEventListener('click', () => savePrompt(t, ta, hint));
  copyBtn.addEventListener('click', () => copyPrompt(ta, hint));

  pactions.append(genBtn, saveBtn, copyBtn, hint);
  box.append(label, ta, pactions);
  card.appendChild(box);

  return card;
}

async function toggleBm(t, btn) {
  const next = !t.bmStatus;
  btn.disabled = true;
  try {
    const updated = await api.updateTicket(projectId, t.id, { bmStatus: next });
    t.bmStatus = updated.bmStatus === true;
    btn.className = 'bm-toggle' + (t.bmStatus ? ' on' : '');
    btn.textContent = t.bmStatus ? '🟢 BM' : '⚪ BM';
    // Übersichtstabellen-Punkt aktualisieren
    const entry = cards.find((c) => c.ticket.id === t.id);
    if (entry && entry.rowEl) {
      const dot = entry.rowEl.querySelector('.bm-dot');
      if (dot) {
        dot.classList.toggle('on', t.bmStatus);
        dot.title = t.bmStatus ? 'Boss Move: grün' : 'nicht markiert';
      }
    }
    updateBmCount();
    applyFilters();
  } catch (err) {
    alert('Konnte BM-Status nicht speichern: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

// ── Filter ──────────────────────────────────────────────────────────
function applyFilters() {
  let visible = 0;
  const groupVisible = {};
  cards.forEach(({ ticket, cardEl, rowEl, severity }) => {
    const show = matches(ticket);
    cardEl.classList.toggle('hidden', !show);
    if (rowEl) rowEl.style.display = show ? '' : 'none';
    if (show) {
      visible++;
      groupVisible[severity] = true;
    }
  });
  // Schweregrad-Gruppenköpfe + Container ausblenden, wenn leer
  const seen = new Set();
  cards.forEach(({ severity, headEl, container }) => {
    if (seen.has(severity)) return;
    seen.add(severity);
    const anyVisible = !!groupVisible[severity];
    if (headEl) headEl.style.display = anyVisible ? '' : 'none';
    if (container) container.style.display = anyVisible ? '' : 'none';
  });
  counterEl.textContent = `${visible} / ${cards.length} Tickets sichtbar`;
}

// ── Stats ───────────────────────────────────────────────────────────
function renderStats() {
  const total = allTickets.length;
  const critHigh = allTickets.filter((t) => t.schweregrad === 'Kritisch' || t.schweregrad === 'Hoch').length;
  const count = (s) => allTickets.filter((t) => t.status === s).length;
  const items = [
    [total, 'Tickets gesamt'],
    [critHigh, 'Kritisch / Hoch'],
    [count('Offen'), 'Offen'],
    [count('In Arbeit'), 'In Arbeit'],
    [count('Erledigt'), 'Erledigt'],
    [count('Zurückgestellt'), 'Zurückgestellt'],
  ];
  statsEl.innerHTML = '';
  items.forEach(([n, l]) => {
    const div = document.createElement('div');
    div.className = 'stat';
    const nEl = document.createElement('div');
    nEl.className = 'n';
    nEl.textContent = n;
    const lEl = document.createElement('div');
    lEl.className = 'l';
    lEl.textContent = l;
    div.append(nEl, lEl);
    statsEl.appendChild(div);
  });
  const today = new Date().toLocaleDateString('de-DE');
  subEl.textContent = `Stand: ${today} · ${total} Tickets · nach Schweregrad gruppiert, nach Kategorie sortiert`;
}

// ── Prompt-Aktionen ─────────────────────────────────────────────────
async function savePrompt(t, ta, hint) {
  hint.className = 'prompt-hint';
  hint.textContent = 'Speichere…';
  try {
    const updated = await api.updateTicket(projectId, t.id, { claudePrompt: ta.value });
    t.claudePrompt = updated.claudePrompt;
    hint.className = 'prompt-hint ok';
    hint.textContent = 'Gespeichert ✓';
  } catch (err) {
    hint.className = 'prompt-hint error';
    hint.textContent = err.message;
  }
}

async function copyPrompt(ta, hint) {
  try {
    await copyToClipboard(ta.value);
    hint.className = 'prompt-hint ok';
    hint.textContent = 'Kopiert ✓';
  } catch (err) {
    hint.className = 'prompt-hint error';
    hint.textContent = 'Kopieren fehlgeschlagen';
  }
}

async function generate(t, ta, hint, btn) {
  hint.className = 'prompt-hint';
  hint.textContent = 'Generiere… (kann einen Moment dauern)';
  btn.disabled = true;
  try {
    const updated = await api.generatePrompt(projectId, t.id, modelSelect.value);
    t.claudePrompt = updated.claudePrompt;
    ta.value = updated.claudePrompt;
    hint.className = 'prompt-hint ok';
    hint.textContent = 'Generiert ✓';
  } catch (err) {
    hint.className = 'prompt-hint error';
    hint.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

// ── Modal / CRUD ────────────────────────────────────────────────────
function openModal(t) {
  formErrorEl.textContent = '';
  if (t) {
    modalTitleEl.textContent = 'Ticket bearbeiten';
    idInput.value = t.id;
    titelInput.value = t.titel;
    beschreibungInput.value = t.beschreibung || '';
    kategorieInput.value = t.kategorie || 'Frontend';
    schweregradInput.value = t.schweregrad || 'Mittel';
    statusInput.value = t.status || 'Offen';
    bmInput.checked = t.bmStatus === true;
  } else {
    modalTitleEl.textContent = 'Neues Ticket';
    idInput.value = '';
    titelInput.value = '';
    beschreibungInput.value = '';
    kategorieInput.value = 'Frontend';
    schweregradInput.value = 'Mittel';
    statusInput.value = 'Offen';
    bmInput.checked = false;
  }
  modalEl.classList.remove('hidden');
  titelInput.focus();
}
function closeModal() {
  modalEl.classList.add('hidden');
}

async function onSubmit(e) {
  e.preventDefault();
  formErrorEl.textContent = '';
  const data = {
    titel: titelInput.value.trim(),
    beschreibung: beschreibungInput.value.trim(),
    kategorie: kategorieInput.value,
    schweregrad: schweregradInput.value,
    status: statusInput.value,
    bmStatus: bmInput.checked,
  };
  try {
    if (idInput.value) {
      await api.updateTicket(projectId, idInput.value, data);
    } else {
      await api.createTicket(projectId, data);
    }
    closeModal();
    await loadTickets();
  } catch (err) {
    formErrorEl.textContent = err.message;
  }
}

async function deleteTicket(t) {
  if (!confirm(`Ticket "${splitNum(t.titel).rest}" wirklich löschen?`)) return;
  await api.deleteTicket(projectId, t.id);
  await loadTickets();
}

// ── Laden ───────────────────────────────────────────────────────────
async function loadProject() {
  try {
    projectData = await api.getProject(projectId);
  } catch (err) {
    alert('Projekt nicht gefunden.');
    window.location.href = 'index.html';
  }
}
async function loadTickets() {
  allTickets = await api.listTickets(projectId);
  allTickets.sort((a, b) => ticketSortValue(a) - ticketSortValue(b));
  renderStats();
  render();
}

async function loadModels() {
  let data;
  try {
    data = await api.getModels();
  } catch (err) {
    return;
  }
  const byProvider = {};
  data.models.forEach((m) => {
    (byProvider[m.provider] = byProvider[m.provider] || []).push(m);
  });
  modelSelect.innerHTML = '';
  Object.entries(byProvider).forEach(([provider, models]) => {
    const info = data.providers[provider] || {};
    const og = document.createElement('optgroup');
    og.label = (info.label || provider) + (info.configured ? '' : ' — kein Key');
    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label + (info.configured ? '' : ' (Key fehlt)');
      og.appendChild(opt);
    });
    modelSelect.appendChild(og);
  });
  const saved = localStorage.getItem('llmModel');
  const ids = data.models.map((m) => m.id);
  modelSelect.value = saved && ids.includes(saved) ? saved : data.default;
  modelSelect.addEventListener('change', () => localStorage.setItem('llmModel', modelSelect.value));
}

(async () => {
  await loadProject();
  if (projectData) {
    await loadModels();
    await loadTickets();
  }
})();
