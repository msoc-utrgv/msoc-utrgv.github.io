// Builds the editing forms from the field descriptions in sections.js.
// Every control writes straight into the plain data object it was given and
// then calls ctx.onChange(), so saving is just "send the object as JSON".
import { h, safeUrl } from '../core/dom.js';
import { renderMarkdown } from '../core/markdown.js';
import { sortable, moveItem } from './sortable.js';
import { uploadFile, displayUrl, hasFiles, isImagePath, IMAGE_TYPES } from './uploads.js';

let idCounter = 0;
const nextId = () => `field-${++idCounter}`;

export function renderFields(fields, data, ctx) {
  return h('div', { class: 'row g-3' },
    fields.map((field) => h('div', { class: `col-12 col-md-${field.width ?? 12}` },
      RENDERERS[field.type](field, data, ctx))));
}

function labelled(field, id, control) {
  return [
    h('label', { class: 'form-label', for: id }, field.label, field.required && h('span', { class: 'text-danger', title: 'Required' }, ' *')),
    control,
    field.help && h('div', { class: 'form-text' }, field.help),
  ];
}

// ---------- simple inputs ----------

const INPUT_TYPES = { text: 'text', url: 'text', date: 'date', time: 'time' };

function inputField(field, data, ctx) {
  const id = nextId();
  const input = h('input', {
    class: 'form-control', id,
    type: field.inputType ?? INPUT_TYPES[field.type],
    inputmode: field.type === 'url' ? 'url' : null,
    placeholder: field.placeholder,
    value: data[field.key] ?? '',
    oninput: () => { data[field.key] = input.value; ctx.onChange(); },
  });
  return labelled(field, id, input);
}

function textareaField(field, data, ctx) {
  const id = nextId();
  const input = h('textarea', {
    class: 'form-control', id, rows: String(field.rows ?? 3), placeholder: field.placeholder,
    value: data[field.key] ?? '',
    oninput: () => { data[field.key] = input.value; ctx.onChange(); },
  });
  return labelled(field, id, input);
}

function selectField(field, data, ctx) {
  const id = nextId();
  const select = h('select', {
    class: 'form-select', id,
    value: data[field.key] ?? field.options[0][0],
    onchange: () => { data[field.key] = select.value; ctx.onChange(); },
  }, field.options.map(([value, label]) => h('option', { value }, label)));
  return labelled(field, id, select);
}

function checkboxField(field, data, ctx) {
  const id = nextId();
  const input = h('input', {
    class: 'form-check-input', type: 'checkbox', id,
    checked: Boolean(data[field.key]),
    onchange: () => { data[field.key] = input.checked; ctx.onChange(); },
  });
  return h('div', { class: 'form-check' }, input, h('label', { class: 'form-check-label', for: id }, field.label));
}

/** A boxed set of fields. "group" keeps them in a nested object, "section" does not. */
function groupField(field, data, ctx) {
  const value = field.type === 'section' ? data : (data[field.key] ??= {});
  return h('fieldset', { class: 'group-field' },
    h('legend', {}, field.label),
    renderFields(field.fields, value, ctx));
}

// ---------- markdown editor ----------

function wrapSelection(textarea, before, after, placeholder) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end) || placeholder;
  textarea.setRangeText(before + selected + after, start, end, 'end');
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
}

function prefixLines(textarea, prefix) {
  const { selectionStart, selectionEnd, value } = textarea;
  const start = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const end = selectionEnd;
  const lines = value.slice(start, end).split('\n');
  const text = lines.map((line, index) => (typeof prefix === 'function' ? prefix(index) : prefix) + line).join('\n');
  textarea.setRangeText(text, start, end, 'select');
}

const MARKDOWN_TOOLS = [
  { label: 'B', title: 'Bold', class: 'fw-bold', run: (t) => wrapSelection(t, '**', '**', 'bold text') },
  { label: 'I', title: 'Italic', class: 'fst-italic', run: (t) => wrapSelection(t, '*', '*', 'italic text') },
  { label: 'H', title: 'Heading', run: (t) => prefixLines(t, '### ') },
  { label: 'Link', title: 'Link', run: (t) => wrapSelection(t, '[', '](https://)', 'link text') },
  { label: '• List', title: 'Bulleted list', run: (t) => prefixLines(t, '- ') },
  { label: '1. List', title: 'Numbered list', run: (t) => prefixLines(t, (index) => `${index + 1}. `) },
  { label: '“ Quote', title: 'Quote', run: (t) => prefixLines(t, '> ') },
];

function markdownField(field, data, ctx) {
  const id = nextId();
  const textarea = h('textarea', {
    class: 'form-control md-editor__input', id, rows: String(field.rows ?? 6),
    value: data[field.key] ?? '',
  });
  const preview = h('div', { class: 'md md-editor__preview', 'aria-label': 'Preview' });

  const sync = () => {
    data[field.key] = textarea.value;
    preview.innerHTML = renderMarkdown(textarea.value);
    preview.classList.toggle('md-editor__preview--empty', !textarea.value.trim());
  };
  const changed = () => { sync(); ctx.onChange(); };
  textarea.addEventListener('input', changed);

  // Dropping a picture on the text uploads it and inserts the markdown for it.
  textarea.addEventListener('dragover', (event) => { if (hasFiles(event)) event.preventDefault(); });
  textarea.addEventListener('drop', async (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    for (const file of [...event.dataTransfer.files].filter((item) => item.type.startsWith('image/'))) {
      try {
        const path = await uploadFile(file, { folder: 'images' });
        textarea.setRangeText(`![](${encodeURI(path)})\n`, textarea.selectionStart, textarea.selectionEnd, 'end');
        changed();
      } catch (error) {
        ctx.notify(error.message, 'danger');
      }
    }
  });

  const toolbar = h('div', { class: 'md-editor__toolbar', role: 'toolbar', 'aria-label': 'Formatting' },
    MARKDOWN_TOOLS.map((tool) => h('button', {
      type: 'button', class: `btn btn-sm btn-outline-secondary ${tool.class ?? ''}`, title: tool.title,
      onclick: () => { tool.run(textarea); textarea.focus(); changed(); },
    }, tool.label)),
    h('span', { class: 'md-editor__hint' }, 'Markdown · preview on the right'));

  sync();
  return labelled(field, id, h('div', { class: 'md-editor' }, toolbar, h('div', { class: 'md-editor__panes' }, textarea, preview)));
}

// ---------- files and images ----------

/** A click-or-drop target. onFiles receives an array of File objects. */
function dropzone({ label, accept, multiple = false, onFiles }) {
  const text = h('span', {}, label);
  const input = h('input', {
    type: 'file', accept, multiple, hidden: true,
    onchange: () => { handle([...input.files]); input.value = ''; },
  });
  const zone = h('div', {
    class: 'dropzone', role: 'button', tabindex: '0',
    onclick: (event) => { if (event.target !== input) input.click(); },
    onkeydown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    },
    ondragover: (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      zone.classList.add('dropzone--over');
    },
    ondragleave: () => zone.classList.remove('dropzone--over'),
    ondrop: (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove('dropzone--over');
      handle([...event.dataTransfer.files]);
    },
  }, text, input);

  async function handle(files) {
    if (!files.length) return;
    zone.classList.add('dropzone--busy');
    text.textContent = 'Uploading…';
    try {
      await onFiles(multiple ? files : files.slice(0, 1));
    } finally {
      zone.classList.remove('dropzone--busy');
      text.textContent = label;
    }
  }
  return zone;
}

function fileField(field, data, ctx) {
  const id = nextId();
  const isImage = field.type === 'image';
  const preview = h('div', { class: 'file-field__preview' });
  const pathInput = h('input', {
    class: 'form-control form-control-sm', id, type: 'text',
    placeholder: isImage ? 'Image path or web address' : 'File path or web address',
    value: data[field.key] ?? '',
    oninput: () => { data[field.key] = pathInput.value.trim(); refresh(); ctx.onChange(); },
  });

  function refresh() {
    const value = safeUrl(data[field.key]);
    preview.replaceChildren(...[
      value && (isImage || isImagePath(value)) && h('img', { src: displayUrl(data[field.key]), alt: '' }),
      value && !isImage && !isImagePath(value) && h('a', { href: value, target: '_blank', rel: 'noopener' }, 'Open file'),
    ].filter(Boolean));
  }

  const zone = dropzone({
    label: isImage ? 'Drop an image here, or click to choose one' : 'Drop a file here, or click to choose one',
    accept: isImage ? IMAGE_TYPES : `${IMAGE_TYPES},application/pdf`,
    onFiles: async ([file]) => {
      try {
        data[field.key] = await uploadFile(file, field);
        pathInput.value = data[field.key];
        refresh();
        ctx.onChange();
      } catch (error) {
        ctx.notify(error.message, 'danger');
      }
    },
  });

  refresh();
  return labelled(field, id, h('div', { class: 'file-field' }, preview, h('div', { class: 'file-field__controls' }, zone, pathInput)));
}

function imagesField(field, data, ctx) {
  const images = (data[field.key] ??= []);
  const grid = h('div', { class: 'image-grid' });

  function render() {
    grid.replaceChildren(...images.map((path, index) => h('div', { class: 'image-tile', draggable: 'true', title: 'Drag to reorder' },
      h('img', { src: displayUrl(path), alt: '', draggable: 'false' }),
      index === 0 && images.length > 1 && h('span', { class: 'image-tile__badge' }, 'Cover'),
      h('button', {
        type: 'button', class: 'image-tile__remove', 'aria-label': 'Remove image', title: 'Remove',
        onclick: () => { images.splice(index, 1); render(); ctx.onChange(); },
      }, '×'))));
  }

  sortable(grid, {
    handle: '.image-tile',
    horizontal: true,
    onMove: (from, to) => { moveItem(images, from, to); render(); ctx.onChange(); },
  });

  const zone = dropzone({
    label: 'Drop images here, or click to choose',
    accept: IMAGE_TYPES,
    multiple: true,
    onFiles: async (files) => {
      for (const file of files) {
        try {
          images.push(await uploadFile(file, field));
          render();
          ctx.onChange();
        } catch (error) {
          ctx.notify(`${file.name}: ${error.message}`, 'danger');
        }
      }
    },
  });

  render();
  return [
    h('div', { class: 'form-label' }, field.label),
    h('div', { class: 'images-field' }, grid, zone),
    field.help && h('div', { class: 'form-text' }, field.help),
  ];
}

// ---------- repeatable lists ----------

function emptyItem(fields) {
  const item = {};
  for (const field of fields) {
    if (field.type === 'list' || field.type === 'images') item[field.key] = [];
    else if (field.type === 'group') item[field.key] = emptyItem(field.fields);
    else if (field.type === 'checkbox') item[field.key] = false;
    else if (field.type === 'select') item[field.key] = field.options[0][0];
    else item[field.key] = '';
  }
  return item;
}

function listField(field, data, ctx) {
  const items = (data[field.key] ??= []);
  const open = new Set();
  const list = h('div', { class: 'item-list' });

  const titleOf = (item) => item[field.titleKey]?.trim() || `New ${field.itemLabel}`;
  const thumbOf = (item) => displayUrl([item[field.thumbKey]].flat()[0]);

  function change(structural) {
    if (structural) render();
    ctx.onChange();
  }

  function itemCard(item, index) {
    const title = h('span', { class: 'item__title' });
    const summary = h('span', { class: 'item__summary' });
    const thumb = h('span', { class: 'item__thumb' });
    const body = h('div', { class: 'item__body' });
    let built = false;

    function refreshHeader() {
      title.textContent = titleOf(item);
      summary.textContent = field.summary?.(item) ?? '';
      thumb.hidden = !field.thumbKey;
      thumb.replaceChildren(...(thumbOf(item) ? [h('img', { src: thumbOf(item), alt: '' })] : []));
    }

    function setOpen(isOpen) {
      if (isOpen && !built) {
        built = true;
        body.append(renderFields(field.fields, item, { ...ctx, onChange: () => { refreshHeader(); ctx.onChange(); } }));
      }
      isOpen ? open.add(item) : open.delete(item);
      body.hidden = !isOpen;
      toggle.setAttribute('aria-expanded', String(isOpen));
      card.classList.toggle('item--open', isOpen);
    }

    const toggle = h('button', { type: 'button', class: 'item__toggle', onclick: () => setOpen(!open.has(item)) },
      thumb, h('span', { class: 'item__text' }, title, summary), h('span', { class: 'item__chevron', 'aria-hidden': 'true' }, '▾'));

    const action = (label, symbol, handler, disabled = false) => h('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary', title: label, 'aria-label': `${label}: ${titleOf(item)}`,
      disabled, onclick: handler,
    }, symbol);

    const card = h('div', { class: 'item' },
      h('div', { class: 'item__header' },
        h('span', { class: 'item__handle', draggable: 'true', title: 'Drag to reorder', 'aria-hidden': 'true' }, '⠿'),
        toggle,
        h('div', { class: 'item__actions' },
          action('Move up', '↑', () => { moveItem(items, index, index - 1); change(true); }, index === 0),
          action('Move down', '↓', () => { moveItem(items, index, index + 1); change(true); }, index === items.length - 1),
          action('Delete', '🗑', () => {
            if (!confirm(`Delete “${titleOf(item)}”?`)) return;
            items.splice(index, 1);
            change(true);
          }))),
      body);

    refreshHeader();
    setOpen(open.has(item));
    return card;
  }

  function render() {
    list.replaceChildren(...items.map(itemCard));
    empty.hidden = items.length > 0;
  }

  const empty = h('p', { class: 'text-secondary small mb-2' }, `No ${field.itemLabel}s yet.`);

  sortable(list, {
    handle: '.item__handle',
    onMove: (from, to) => { moveItem(items, from, to); change(true); },
  });

  const addButton = h('button', {
    type: 'button', class: 'btn btn-sm btn-primary',
    onclick: () => {
      const item = emptyItem(field.fields);
      field.addAt === 'start' ? items.unshift(item) : items.push(item);
      open.add(item);
      change(true);
      const card = list.children[items.indexOf(item)];
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      card.querySelector('.item__body input')?.focus({ preventScroll: true });
    },
  }, `+ Add ${field.itemLabel}`);

  render();
  return h('div', { class: 'list-field' },
    h('div', { class: 'list-field__header' }, h('h2', { class: 'list-field__title' }, field.label), addButton),
    field.help && h('div', { class: 'form-text mb-2' }, field.help),
    empty,
    list);
}

const RENDERERS = {
  text: inputField,
  url: inputField,
  date: inputField,
  time: inputField,
  textarea: textareaField,
  select: selectField,
  checkbox: checkboxField,
  markdown: markdownField,
  image: fileField,
  file: fileField,
  images: imagesField,
  list: listField,
  group: groupField,
  section: groupField,
};

// ---------- checks before saving ----------

/** Returns a list of human-readable problems; empty when everything is fine. */
export function validate(fields, data, trail = '') {
  const problems = [];
  for (const field of fields) {
    const value = data?.[field.key];
    if (field.type === 'list') {
      (value ?? []).forEach((item, index) => {
        const name = item[field.titleKey]?.trim() || `${field.itemLabel} ${index + 1}`;
        problems.push(...validate(field.fields, item, `${trail}${field.label} → ${name} → `));
      });
    } else if (field.type === 'group' || field.type === 'section') {
      problems.push(...validate(field.fields, field.type === 'section' ? data : value, `${trail}${field.label} → `));
    } else if (field.required && !String(value ?? '').trim()) {
      problems.push(`${trail}${field.label} is required.`);
    }
  }
  return problems;
}

const slug = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/** Give new list items a stable id so they can be linked to (events.html#id). */
export function assignIds(fields, data) {
  for (const field of fields) {
    const value = data?.[field.key];
    if (field.type === 'group') assignIds(field.fields, value);
    if (field.type === 'section') assignIds(field.fields, data);
    if (field.type !== 'list') continue;
    const used = new Set((value ?? []).map((item) => item.id).filter(Boolean));
    for (const item of value ?? []) {
      if (field.autoId && !item.id) {
        const base = slug(item[field.titleKey]) || field.itemLabel;
        let id = base;
        for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
        used.add(id);
        item.id = id;
      }
      assignIds(field.fields, item);
    }
  }
}
