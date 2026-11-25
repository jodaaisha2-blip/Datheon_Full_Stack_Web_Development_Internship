const STORAGE_KEY = 'daymark-tasks-v1';

const taskForm = document.querySelector('#task-form');
const taskTitleInput = document.querySelector('#task-title');
const taskCategoryInput = document.querySelector('#task-category');
const taskDateInput = document.querySelector('#task-date');
const taskList = document.querySelector('#task-list');
const emptyState = document.querySelector('#empty-state');
const searchInput = document.querySelector('#search-input');
const sortSelect = document.querySelector('#sort-select');
const editDialog = document.querySelector('#edit-dialog');
const editForm = document.querySelector('#edit-form');
const editTitleInput = document.querySelector('#edit-title');
const editCategoryInput = document.querySelector('#edit-category');
const editDateInput = document.querySelector('#edit-date');
const toast = document.querySelector('#toast');

let tasks = loadFromLocalStorage();
let currentFilter = 'all';
let currentCategory = null;
let editingTaskId = null;
let toastTimer;

function loadFromLocalStorage() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    const parsedTasks = savedTasks ? JSON.parse(savedTasks) : [];
    return Array.isArray(parsedTasks) ? parsedTasks : [];
  } catch (error) {
    console.error('Could not load saved tasks:', error);
    return [];
  }
}

function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error('Could not save tasks:', error);
    showToast('Could not save changes in this browser.');
  }
}

function createId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function isOverdue(task) {
  if (!task.dueDate || task.completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${task.dueDate}T00:00:00`) < today;
}

function addTask(title, category, dueDate) {
  tasks.unshift({
    id: createId(),
    title: title.trim(),
    category,
    dueDate,
    completed: false,
    createdAt: new Date().toISOString()
  });
  saveToLocalStorage();
  render();
  showToast('Task added to your list.');
}

function toggleTask(id) {
  tasks = tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task);
  saveToLocalStorage();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveToLocalStorage();
  render();
  showToast('Task deleted.');
}

function openEditDialog(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;
  editingTaskId = id;
  editTitleInput.value = task.title;
  editCategoryInput.value = task.category;
  editDateInput.value = task.dueDate || '';
  editDialog.showModal();
  editTitleInput.focus();
}

function closeEditDialog() {
  editDialog.close();
  editingTaskId = null;
}

function updateTask() {
  if (!editingTaskId) return;
  const title = editTitleInput.value.trim();
  if (!title) return;

  tasks = tasks.map(task => task.id === editingTaskId
    ? { ...task, title, category: editCategoryInput.value, dueDate: editDateInput.value }
    : task
  );
  saveToLocalStorage();
  closeEditDialog();
  render();
  showToast('Task updated.');
}

function getVisibleTasks() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = tasks.filter(task => {
    const matchesStatus = currentFilter === 'all'
      || (currentFilter === 'active' && !task.completed)
      || (currentFilter === 'completed' && task.completed);
    const matchesCategory = !currentCategory || task.category === currentCategory;
    const matchesSearch = task.title.toLowerCase().includes(query);
    return matchesStatus && matchesCategory && matchesSearch;
  });

  if (sortSelect.value === 'due') {
    visible.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sortSelect.value === 'alphabetical') {
    visible.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return visible;
}

function createTaskElement(task) {
  const article = document.createElement('article');
  article.className = `task-item${task.completed ? ' completed' : ''}`;

  const completeButton = document.createElement('button');
  completeButton.className = 'complete-toggle';
  completeButton.type = 'button';
  completeButton.setAttribute('aria-label', task.completed ? 'Mark task active' : 'Mark task completed');
  completeButton.textContent = task.completed ? '✓' : '';
  completeButton.addEventListener('click', () => toggleTask(task.id));

  const copy = document.createElement('div');
  copy.className = 'task-copy';

  const title = document.createElement('p');
  title.className = 'task-title';
  title.textContent = task.title;

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  const category = document.createElement('span');
  category.className = `category-tag ${task.category.toLowerCase()}`;
  category.textContent = task.category;
  meta.append(category);

  if (task.dueDate) {
    const due = document.createElement('span');
    due.className = `due-date${isOverdue(task) ? ' overdue' : ''}`;
    due.textContent = `${isOverdue(task) ? 'Overdue · ' : 'Due · '}${formatDate(task.dueDate)}`;
    meta.append(due);
  }

  copy.append(title, meta);

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editButton = document.createElement('button');
  editButton.className = 'icon-button';
  editButton.type = 'button';
  editButton.textContent = '✎';
  editButton.setAttribute('aria-label', `Edit ${task.title}`);
  editButton.addEventListener('click', () => openEditDialog(task.id));

  const deleteButton = document.createElement('button');
  deleteButton.className = 'icon-button delete';
  deleteButton.type = 'button';
  deleteButton.textContent = '⌫';
  deleteButton.setAttribute('aria-label', `Delete ${task.title}`);
  deleteButton.addEventListener('click', () => deleteTask(task.id));

  actions.append(editButton, deleteButton);
  article.append(completeButton, copy, actions);
  return article;
}

function updateCounts() {
  const completed = tasks.filter(task => task.completed).length;
  const active = tasks.length - completed;
  document.querySelector('#all-count').textContent = tasks.length;
  document.querySelector('#active-count').textContent = active;
  document.querySelector('#completed-count').textContent = completed;
  document.querySelector('#visible-count').textContent = getVisibleTasks().length;

  const percentage = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  document.querySelector('#progress-text').textContent = `${percentage}%`;
  document.querySelector('#progress-fill').style.width = `${percentage}%`;
  document.querySelector('#progress-caption').textContent = tasks.length
    ? `${completed} of ${tasks.length} tasks completed`
    : 'No tasks completed yet';
}

function updateFilterUI() {
  document.querySelectorAll('[data-filter]').forEach(button => {
    button.classList.toggle('active', button.dataset.filter === currentFilter);
  });
  document.querySelectorAll('[data-category]').forEach(button => {
    button.classList.toggle('active', button.dataset.category === currentCategory);
  });

  const title = currentCategory || ({
    all: 'All tasks',
    active: 'In progress',
    completed: 'Completed'
  }[currentFilter]);
  document.querySelector('#page-title').textContent = title;
}

function render() {
  const visibleTasks = getVisibleTasks();
  taskList.replaceChildren(...visibleTasks.map(createTaskElement));
  emptyState.hidden = visibleTasks.length > 0;
  updateCounts();
  updateFilterUI();
}

taskForm.addEventListener('submit', event => {
  event.preventDefault();
  const title = taskTitleInput.value.trim();
  if (!title) {
    taskTitleInput.focus();
    return;
  }
  addTask(title, taskCategoryInput.value, taskDateInput.value);
  taskForm.reset();
  taskCategoryInput.value = 'Work';
  taskTitleInput.focus();
});

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    currentCategory = null;
    render();
  });
});

document.querySelectorAll('[data-category]').forEach(button => {
  button.addEventListener('click', () => {
    currentCategory = currentCategory === button.dataset.category ? null : button.dataset.category;
    currentFilter = 'all';
    render();
  });
});

searchInput.addEventListener('input', render);
sortSelect.addEventListener('change', render);
editForm.addEventListener('submit', event => {
  event.preventDefault();
  updateTask();
});
document.querySelector('#close-dialog').addEventListener('click', closeEditDialog);
document.querySelector('#cancel-edit').addEventListener('click', closeEditDialog);
editDialog.addEventListener('click', event => {
  if (event.target === editDialog) closeEditDialog();
});

document.querySelector('#date-display').textContent = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric'
}).format(new Date());

render();
