// Client for the editor's backend.
//   On your own computer (localhost) it talks to server.py.
//   Everywhere else it talks to the Cloudflare Worker in worker/.
// Add ?backend=worker to the editor's address on localhost to try the Worker from there.
import { WORKER_URL } from './config.js';

const onLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);

/** True when saving goes through the Worker to GitHub (the live site updates about a minute later). */
export const isRemote = !onLocalhost || new URLSearchParams(location.search).get('backend') === 'worker';

const API_BASE = isRemote ? `${WORKER_URL.replace(/\/+$/, '')}/api` : '/api';

// The Worker hands out a session token at sign-in; server.py uses a cookie instead.
// sessionStorage forgets the token when the tab is closed.
const TOKEN_KEY = 'msoc-editor-session';
const session = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, { json, body, headers = {} } = {}) {
  if (isRemote && WORKER_URL.includes('YOUR-SUBDOMAIN')) {
    throw new ApiError(0, 'The editor backend address has not been set yet (js/admin/config.js).');
  }
  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'msoc-admin',
        ...(session.get() ? { Authorization: `Bearer ${session.get()}` } : {}),
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : body,
    });
  } catch {
    throw new ApiError(0, isRemote
      ? 'Could not reach the editor backend. Check your internet connection and try again.'
      : 'Could not reach the editor server. Is server.py running?');
  }
  const isJson = response.headers.get('Content-Type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;
  if (response.status === 401) session.clear();
  if (!response.ok || !payload) {
    throw new ApiError(response.status, payload?.error ?? `The editor backend is not available here (${response.status}).`);
  }
  return payload;
}

export const api = {
  session: () => request('GET', '/session'),

  async login(username, password) {
    const result = await request('POST', '/login', { json: { username, password } });
    if (result.token) session.set(result.token);
    return result;
  },

  async logout() {
    try {
      await request('POST', '/logout');
    } finally {
      session.clear();
    }
  },

  /** Read through the backend so the editor always sees the latest saved version. */
  loadContent: (name) => request('GET', `/content/${encodeURIComponent(name)}`),

  saveContent: (name, data) => request('PUT', `/content/${encodeURIComponent(name)}`, { json: data }),

  /** Returns the site-relative path of the stored file, e.g. "media/images/flyer.webp". */
  async upload(folder, file) {
    const query = new URLSearchParams({ folder, filename: file.name });
    const { path } = await request('POST', `/upload?${query}`, {
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
    return path;
  },
};
