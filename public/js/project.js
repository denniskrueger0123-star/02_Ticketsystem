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
const formErrorEl = document.getElementById('ticket-form-error');

let projectData = null;
let allTickets = [];
const state = { cat: 'all', sev: 'all', st: 'all' };
let cards = []; // { ticket, cardEl, rowEl, severity }

document.getElementById('new-ticket-btn').addEventListener('click', () => openModal());
document.getElementById('ticket-cancel-btn').addEventListener('click', closeModal);
formEl.addEventListener('submit', onSubmit);
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const dim = chip.dataset.dim;
    state[dim] = chip.dataset.val;
    document.querySelectorAll(`.chip[data-dim="${dim}"]`).forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    applyFilters();
  });
});

function slug(s) {
  return s.replace(/\s/g, '');
}
function splitNum(titel) {
  const m = titel.match(/^(#\d+)\s+(.*)$/s);
  return m ? { num: m[1], rest: m[2] } : { num: '', rest: titel };
}

function matches(t) {
  return (
    (state.cat === 'all' || t.kategorie === state.cat) &&
    (state.sev === 'all' || t.schweregrad === state.sev) &&
    (state.st === 'all' || t.status === state.st)
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
    tdSt.appendChild(makeTag(`tag-st-${slug(t.status)}`, t.status));
    tr.append(tdNum, tdTitle, tdCat, tdSev, tdSt);
    tr.addEventListener('click', () => {
      const el = document.getElementById(`card-${t.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    ovwBody.appendChild(tr);
    rowByTicket.set(t.id, tr);
  });

  // Detailkarten nach Schweregrad gruppiert
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

  footEl.textContent = `${projectData.name} · Ideensammlung als Ticketsystem`;
  applyFilters();
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
  const editBtn = document.createElement('button');
  editBtn.textContent = 'Bearbeiten';
  editBtn.addEventListener('click', () => openModal(t));
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-danger';
  delBtn.textContent = 'Löschen';
  delBtn.addEventListener('click', () => deleteTicket(t));
  actions.append(editBtn, delBtn);
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
    headEl.style.display = anyVisible ? '' : 'none';
    container.style.display = anyVisible ? '' : 'none';
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
    await navigator.clipboard.writeText(ta.value);
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
    const updated = await api.generatePrompt(projectId, t.id);
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
  } else {
    modalTitleEl.textContent = 'Neues Ticket';
    idInput.value = '';
    titelInput.value = '';
    beschreibungInput.value = '';
    kategorieInput.value = 'Frontend';
    schweregradInput.value = 'Mittel';
    statusInput.value = 'Offen';
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
  renderStats();
  render();
}

(async () => {
  await loadProject();
  if (projectData) await loadTickets();
})();
