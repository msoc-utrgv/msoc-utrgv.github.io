// Loads the JSON files in /content that hold everything editable on the site.

const DRAFT_PREFIX = 'msoc-draft:';

/** True when the editor opened this page with ?preview to show unsaved changes. */
export const isPreview = new URLSearchParams(location.search).has('preview');

const cache = new Map();

export function loadContent(name) {
  if (!cache.has(name)) cache.set(name, fetchContent(name));
  return cache.get(name);
}

async function fetchContent(name) {
  if (isPreview) {
    const draft = readDraft(name);
    if (draft) return draft;
  }
  const response = await fetch(`content/${name}.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load content/${name}.json (${response.status})`);
  return response.json();
}

function readDraft(name) {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_PREFIX + name));
  } catch {
    return null;
  }
}

export function saveDraft(name, data) {
  localStorage.setItem(DRAFT_PREFIX + name, JSON.stringify(data));
}

export function clearDraft(name) {
  localStorage.removeItem(DRAFT_PREFIX + name);
}
