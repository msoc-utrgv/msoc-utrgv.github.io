// Site editor: sign-in, section navigation, saving and previewing.
import { h } from '../core/dom.js';
import { saveDraft, clearDraft } from '../core/content.js';
import { showCleanAddress } from '../core/address.js';
import { api, isRemote } from './api.js';
import { sections } from './sections.js';
import { renderFields, validate, assignIds } from './forms.js';
import { hasFiles } from './uploads.js';

const $ = (id) => document.getElementById(id);

const state = { section: null, data: null, dirty: false, saving: false };

// ---------- messages ----------

function notify(message, type = 'info') {
  const alert = h('div', { class: `alert alert-${type} alert-dismissible`, role: type === 'danger' ? 'alert' : 'status' },
    [message].flat().length > 1
      ? h('ul', { class: 'mb-0' }, [message].flat().map((line) => h('li', {}, line)))
      : message,
    h('button', { type: 'button', class: 'btn-close', 'aria-label': 'Dismiss', onclick: () => alert.remove() }));
  $('alerts').replaceChildren(alert);
  if (type === 'success') setTimeout(() => alert.remove(), 5000);
}

function setDirty(dirty) {
  state.dirty = dirty;
  $('save-button').disabled = !dirty || state.saving;
  $('save-status').textContent = state.saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved';
  $('save-status').classList.toggle('save-status--dirty', dirty);
}

// ---------- sign-in ----------

function showLogin(message = '') {
  $('login-error').textContent = message;
  $('login-error').hidden = !message;
  $('login-view').hidden = false;
  $('login-username').focus();
}

async function showApp(user) {
  $('login-view').hidden = true;
  $('app-view').hidden = false;
  $('current-user').textContent = user;
  // After a session timeout the form is still on screen; keep the unsaved work.
  if (!state.section) await openSection(location.hash.slice(1) || sections[0].id);
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('login-button');
  button.disabled = true;
  try {
    const { user } = await api.login($('login-username').value, $('login-password').value);
    $('login-password').value = '';
    await showApp(user);
  } catch (error) {
    showLogin(error.message);
  } finally {
    button.disabled = false;
  }
});

$('logout-button').addEventListener('click', async () => {
  if (state.dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
  await api.logout().catch(() => {});
  setDirty(false);
  location.reload();
});

// ---------- sections ----------

function renderNav() {
  $('section-nav').replaceChildren(...sections.map((section) => h('button', {
    type: 'button',
    class: `nav-link${section === state.section ? ' active' : ''}`,
    'aria-current': section === state.section ? 'page' : null,
    onclick: () => openSection(section.id),
  }, section.label)));
}

async function openSection(id) {
  const section = sections.find((item) => item.id === id) ?? sections[0];
  if (section === state.section) return;
  if (state.dirty && !confirm('You have unsaved changes on this page. Leave without saving?')) return;

  try {
    state.data = await api.loadContent(section.file);
  } catch (error) {
    notify(error.message, 'danger');
    return;
  }
  state.section = section;
  history.replaceState(null, '', `#${section.id}`);
  $('section-title').textContent = section.label;
  $('view-link').href = section.page;
  $('alerts').replaceChildren();
  $('editor').replaceChildren(renderFields(section.fields, state.data, { onChange: () => setDirty(true), notify }));
  renderNav();
  setDirty(false);
  window.scrollTo(0, 0);
}

// ---------- save and preview ----------

async function save() {
  if (!state.dirty || state.saving) return;
  const { section, data } = state;
  const problems = validate(section.fields, data);
  if (problems.length) {
    notify(['Please fix these before saving:', ...problems], 'danger');
    return;
  }
  assignIds(section.fields, data);

  state.saving = true;
  setDirty(true);
  try {
    await api.saveContent(section.file, data);
    clearDraft(section.file);
    state.saving = false;
    setDirty(false);
    notify(isRemote
      ? 'Saved. The live website will show your changes in about a minute.'
      : 'Saved. The website now shows your changes.', 'success');
  } catch (error) {
    state.saving = false;
    setDirty(true);
    if (error.status === 401) showLogin('Your session expired. Sign in again, then press Save.');
    else notify(`Could not save: ${error.message}`, 'danger');
  }
}

function preview() {
  const { section, data } = state;
  assignIds(section.fields, data);
  saveDraft(section.file, data);
  const [page, hash] = section.page.split('#');
  window.open(`${page}?preview=1${hash ? `#${hash}` : ''}`, 'msoc-preview');
}

$('save-button').addEventListener('click', save);
$('preview-button').addEventListener('click', preview);
$('editor').addEventListener('submit', (event) => event.preventDefault());

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (state.dirty) event.preventDefault();
});

// A file dropped beside a drop zone should not make the browser open it.
for (const type of ['dragover', 'drop']) {
  window.addEventListener(type, (event) => { if (hasFiles(event)) event.preventDefault(); });
}

// ---------- start ----------

showCleanAddress();

try {
  const { user } = await api.session();
  await showApp(user);
} catch (error) {
  showLogin(error.status === 401 ? '' : error.message);
}
