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
  await api.deleteProject(project.id);
  await loadProjects();
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
      <div class="pactions">
        <button class="edit-btn">Bearbeiten</button>
        <button class="btn-danger delete-btn">Löschen</button>
      </div>
    `;
    card.querySelector('h3').textContent = project.name;
    card.querySelector('.pdesc').textContent = project.description || '';

    card.addEventListener('click', () => {
      window.location.href = `project.html?id=${encodeURIComponent(project.id)}`;
    });
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(project);
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
