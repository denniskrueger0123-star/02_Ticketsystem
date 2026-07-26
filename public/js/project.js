const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');

const ticketListEl = document.getElementById('ticket-list');
const projectTitleEl = document.getElementById('project-title');
const projectDescEl = document.getElementById('project-description');

const modalEl = document.getElementById('ticket-modal');
const formEl = document.getElementById('ticket-form');
const modalTitleEl = document.getElementById('ticket-modal-title');
const idInput = document.getElementById('ticket-id');
const titelInput = document.getElementById('ticket-titel');
const beschreibungInput = document.getElementById('ticket-beschreibung');
const kategorieInput = document.getElementById('ticket-kategorie');
const schweregradInput = document.getElementById('ticket-schweregrad');
const statusInput = document.getElementById('ticket-status');
const promptInput = document.getElementById('ticket-prompt');
const formErrorEl = document.getElementById('ticket-form-error');

const filterKategorie = document.getElementById('filter-kategorie');
const filterSchweregrad = document.getElementById('filter-schweregrad');
const filterStatus = document.getElementById('filter-status');

let allTickets = [];

if (!projectId) {
  window.location.href = 'index.html';
}

document.getElementById('new-ticket-btn').addEventListener('click', () => openModal());
document.getElementById('ticket-cancel-btn').addEventListener('click', closeModal);
formEl.addEventListener('submit', onSubmit);
[filterKategorie, filterSchweregrad, filterStatus].forEach((el) =>
  el.addEventListener('change', () => renderTickets(applyFilters(allTickets)))
);

function openModal(ticket) {
  formErrorEl.textContent = '';
  if (ticket) {
    modalTitleEl.textContent = 'Ticket bearbeiten';
    idInput.value = ticket.id;
    titelInput.value = ticket.titel;
    beschreibungInput.value = ticket.beschreibung || '';
    kategorieInput.value = ticket.kategorie || 'Frontend';
    schweregradInput.value = ticket.schweregrad || 'Mittel';
    statusInput.value = ticket.status || 'Offen';
    promptInput.value = ticket.claudePrompt || '';
  } else {
    modalTitleEl.textContent = 'Neues Ticket';
    idInput.value = '';
    titelInput.value = '';
    beschreibungInput.value = '';
    kategorieInput.value = 'Frontend';
    schweregradInput.value = 'Mittel';
    statusInput.value = 'Offen';
    promptInput.value = '';
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
    claudePrompt: promptInput.value,
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

async function deleteTicket(ticket) {
  if (!confirm(`Ticket "${ticket.titel}" wirklich löschen?`)) return;
  await api.deleteTicket(projectId, ticket.id);
  await loadTickets();
}

async function copyPrompt(ticket, btn) {
  try {
    await navigator.clipboard.writeText(ticket.claudePrompt || '');
    const original = btn.textContent;
    btn.textContent = 'Kopiert!';
    setTimeout(() => (btn.textContent = original), 1200);
  } catch (err) {
    alert('Kopieren fehlgeschlagen: ' + err.message);
  }
}

function applyFilters(tickets) {
  return tickets.filter((t) => {
    if (filterKategorie.value && t.kategorie !== filterKategorie.value) return false;
    if (filterSchweregrad.value && t.schweregrad !== filterSchweregrad.value) return false;
    if (filterStatus.value && t.status !== filterStatus.value) return false;
    return true;
  });
}

function slugify(value) {
  return value.replace(/\s/g, '-');
}

function renderTickets(tickets) {
  ticketListEl.innerHTML = '';
  if (tickets.length === 0) {
    ticketListEl.innerHTML = '<div class="empty-state">Keine Tickets gefunden.</div>';
    return;
  }
  for (const ticket of tickets) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3 class="card-title"></h3>
      <p class="card-desc"></p>
      <div class="card-meta">
        <span class="badge">${ticket.kategorie}</span>
        <span class="badge badge-sev-${slugify(ticket.schweregrad)}">${ticket.schweregrad}</span>
        <span class="badge badge-status-${slugify(ticket.status)}">${ticket.status}</span>
        <span class="card-actions">
          <button class="copy-btn">Prompt kopieren</button>
          <button class="edit-btn">Bearbeiten</button>
          <button class="btn-danger delete-btn">Löschen</button>
        </span>
      </div>
    `;
    card.querySelector('.card-title').textContent = ticket.titel;
    card.querySelector('.card-desc').textContent = ticket.beschreibung || '';

    card.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      copyPrompt(ticket, e.target);
    });
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(ticket);
    });
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTicket(ticket);
    });
    card.addEventListener('click', () => openModal(ticket));

    ticketListEl.appendChild(card);
  }
}

async function loadProject() {
  try {
    const project = await api.getProject(projectId);
    projectTitleEl.textContent = project.name;
    projectDescEl.textContent = project.description || '';
  } catch (err) {
    alert('Projekt nicht gefunden.');
    window.location.href = 'index.html';
  }
}

async function loadTickets() {
  allTickets = await api.listTickets(projectId);
  renderTickets(applyFilters(allTickets));
}

loadProject();
loadTickets();
