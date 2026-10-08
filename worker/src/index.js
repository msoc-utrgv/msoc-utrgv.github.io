// Backend for the Mathematical Society site editor (admin.html).
//
// Implements the same API as server.py, but for production:
//   - passwords are checked against salted PBKDF2 hashes kept in a Worker secret
//   - sign-in attempts are rate limited
//   - saving commits the file to the GitHub repository, and GitHub Pages republishes
//
//   POST /api/login            {"username", "password"} -> {"user", "token"}
//   POST /api/logout
//   GET  /api/session          -> {"user"}
//   GET  /api/content/<name>   -> the JSON currently in the repository
//   PUT  /api/content/<name>   JSON body, committed to content/<name>.json
//   POST /api/upload?folder=<images|photos|resources>&filename=<name>
//                              raw file body, committed to media/<folder>/
//
// Every call except login needs the header  Authorization: Bearer <token>.

const CONTENT_FILES = new Set(['site', 'home', 'people', 'events', 'resources']);
const UPLOAD_FOLDERS = new Set(['images', 'photos', 'resources']);
const UPLOAD_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.pdf']);
const MAX_CONTENT_BYTES = 1024 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const SESSION_SECONDS = 8 * 60 * 60;
const REQUIRED_SETTINGS = ['GITHUB_TOKEN', 'SESSION_SECRET', 'USERS', 'GITHUB_REPO', 'GITHUB_BRANCH', 'LOGIN_LIMITER'];

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      return json(200, await route(request, env), cors);
    } catch (error) {
      if (error instanceof ApiError) return json(error.status, { error: error.message }, cors);
      console.error(error);
      return json(500, { error: 'Unexpected server error.' }, cors);
    }
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const missing = REQUIRED_SETTINGS.filter((name) => !env[name]);
  if (missing.length) throw new ApiError(500, `The backend is not set up yet (missing ${missing.join(', ')}).`);

  // Browsers always send Origin on cross-site requests; refuse pages we do not know.
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins(env).includes(origin)) throw new ApiError(403, 'This website is not allowed to use the editor backend.');

  if (method === 'POST' && path === '/api/login') return login(request, env);
  if (method === 'POST' && path === '/api/logout') return { ok: true };

  const user = await requireUser(request, env);
  if (method === 'GET' && path === '/api/session') return { user };
  if (path.startsWith('/api/content/')) {
    const name = path.slice('/api/content/'.length);
    if (!CONTENT_FILES.has(name)) throw new ApiError(404, `Unknown content file: ${name}`);
    if (method === 'GET') return loadContent(env, name);
    if (method === 'PUT') return saveContent(request, env, name, user);
  }
  if (method === 'POST' && path === '/api/upload') return upload(request, env, url, user);
  throw new ApiError(404, 'Unknown API endpoint.');
}

// ---------- responses and CORS ----------

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(status, payload, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

// ---------- bytes and encodings ----------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text) {
  return Uint8Array.from(atob(text.replace(/\s/g, '')), (char) => char.charCodeAt(0));
}

const toBase64Url = (bytes) => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (text) => fromBase64(text.replace(/-/g, '+').replace(/_/g, '/'));

const toHex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/** Compare without stopping at the first difference, so timing reveals nothing. */
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function readBody(request, limit) {
  if (Number(request.headers.get('Content-Length') ?? 0) > limit) throw tooLarge(limit);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > limit) throw tooLarge(limit);
  return bytes;
}

function tooLarge(limit) {
  const megabytes = Math.round(limit / (1024 * 1024));
  return new ApiError(413, `File is too large (limit ${megabytes} MB). Add bigger files to the repository on GitHub and paste their path instead.`);
}

async function readJson(request, limit = MAX_CONTENT_BYTES) {
  try {
    return JSON.parse(decoder.decode(await readBody(request, limit)));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Request body is not valid JSON.');
  }
}

// ---------- passwords and sessions ----------

function users(env) {
  try {
    return JSON.parse(env.USERS);
  } catch {
    throw new ApiError(500, 'The USERS secret is not valid JSON. Create it again with make-users.mjs.');
  }
}

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

// Used when the username does not exist, so a wrong username takes as long as a wrong password.
const DUMMY_USER = { salt: 'AAAAAAAAAAAAAAAAAAAAAA==', hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', iterations: 100000 };

async function login(request, env) {
  const body = await readJson(request, 4096);
  const username = String(body?.username ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  const visitor = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  for (const key of [`ip:${visitor}`, `user:${username}`]) {
    const { success } = await env.LOGIN_LIMITER.limit({ key });
    if (!success) throw new ApiError(429, 'Too many sign-in attempts. Wait a minute and try again.');
  }

  const known = Object.hasOwn(users(env), username) ? users(env)[username] : null;
  const record = known ?? DUMMY_USER;
  const derived = await derivePassword(password, fromBase64(record.salt), record.iterations);
  if (!equalBytes(derived, fromBase64(record.hash)) || !known) throw new ApiError(401, 'Incorrect username or password.');

  return { user: username, token: await createSession(env, username) };
}

function sessionKey(env) {
  return crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** A session is "<payload>.<signature>"; only this Worker can produce a valid signature. */
async function createSession(env, user) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ user, expires: Date.now() + SESSION_SECONDS * 1000 })));
  const signature = await crypto.subtle.sign('HMAC', await sessionKey(env), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function requireUser(request, env) {
  const denied = new ApiError(401, 'Please sign in.');
  const [scheme, token] = (request.headers.get('Authorization') ?? '').split(' ');
  const [payload, signature, extra] = (token ?? '').split('.');
  if (scheme !== 'Bearer' || !payload || !signature || extra !== undefined) throw denied;
  try {
    const valid = await crypto.subtle.verify('HMAC', await sessionKey(env), fromBase64Url(signature), encoder.encode(payload));
    const session = JSON.parse(decoder.decode(fromBase64Url(payload)));
    // A user removed from USERS is locked out immediately, even with an unexpired session.
    if (!valid || session.expires < Date.now() || !Object.hasOwn(users(env), session.user)) throw denied;
    return session.user;
  } catch (error) {
    throw error instanceof ApiError && error.status !== 401 ? error : denied;
  }
}

// ---------- GitHub ----------

async function github(env, method, path, body) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const query = method === 'GET' ? `?ref=${encodeURIComponent(env.GITHUB_BRANCH)}` : '';
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodedPath}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'msoc-site-editor',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401 || response.status === 403) {
    console.error('GitHub refused the token', response.status, await response.text());
    throw new ApiError(502, 'GitHub refused the saved access token. It may have expired or lost access to the repository.');
  }
  return response;
}

/** Returns { sha, content } for a file in the repository, or null when it does not exist. */
async function readFile(env, path) {
  const response = await github(env, 'GET', path);
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError(502, `GitHub could not read ${path} (${response.status}).`);
  return response.json();
}

async function writeFile(env, path, bytes, message) {
  const content = toBase64(bytes);
  // Someone else may save between our read and write; GitHub then answers 409, so read again once.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await readFile(env, path);
    const response = await github(env, 'PUT', path, { message, content, branch: env.GITHUB_BRANCH, sha: existing?.sha });
    if (response.ok) return;
    if (attempt === 1 || ![409, 422].includes(response.status)) {
      console.error('GitHub write failed', response.status, await response.text());
      throw new ApiError(502, `GitHub could not save ${path} (${response.status}).`);
    }
  }
}

/** The id GitHub gives a file's contents, used to tell "same file again" from "different file, same name". */
async function gitBlobSha(bytes) {
  const header = encoder.encode(`blob ${bytes.length}\0`);
  const blob = new Uint8Array(header.length + bytes.length);
  blob.set(header);
  blob.set(bytes, header.length);
  return toHex(await crypto.subtle.digest('SHA-1', blob));
}

// ---------- content and uploads ----------

async function loadContent(env, name) {
  const file = await readFile(env, `content/${name}.json`);
  if (!file) throw new ApiError(404, `content/${name}.json does not exist in the repository.`);
  return JSON.parse(decoder.decode(fromBase64(file.content)));
}

async function saveContent(request, env, name, user) {
  const data = await readJson(request);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError(400, 'Content must be a JSON object.');
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(env, `content/${name}.json`, encoder.encode(text), `Update ${name} content (site editor: ${user})`);
  return { ok: true };
}

function safeFilename(name) {
  const base = String(name).replace(/\\/g, '/').split('/').pop();
  const dot = base.lastIndexOf('.');
  const extension = dot > 0 ? base.slice(dot).toLowerCase() : '';
  if (!UPLOAD_EXTENSIONS.has(extension)) {
    throw new ApiError(400, `That file type is not allowed. Allowed types: ${[...UPLOAD_EXTENSIONS].sort().join(', ')}`);
  }
  const stem = base.slice(0, dot).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
  return { stem: stem.slice(0, 80), extension };
}

async function upload(request, env, url, user) {
  const folder = url.searchParams.get('folder');
  if (!UPLOAD_FOLDERS.has(folder)) throw new ApiError(400, 'Unknown upload folder.');
  const { stem, extension } = safeFilename(url.searchParams.get('filename') ?? '');
  const bytes = await readBody(request, MAX_UPLOAD_BYTES);
  if (!bytes.length) throw new ApiError(400, 'The uploaded file is empty.');

  let path = `media/${folder}/${stem}${extension}`;
  const existing = await readFile(env, path);
  if (existing) {
    // Same file uploaded again: reuse it. Different file with the same name: keep both.
    if (existing.sha === await gitBlobSha(bytes)) return { path };
    const fingerprint = toHex(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 8);
    path = `media/${folder}/${stem}-${fingerprint}${extension}`;
    if (await readFile(env, path)) return { path };
  }
  await writeFile(env, path, bytes, `Add ${path} (site editor: ${user})`);
  return { path };
}
