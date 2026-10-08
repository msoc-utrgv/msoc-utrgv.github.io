// Creates the value for the Worker's USERS secret: usernames with salted
// password hashes. Passwords themselves are never stored anywhere.
//
//   node make-users.mjs
//
// Then paste the printed line when this asks for it:
//   npx wrangler@latest secret put USERS
//
// Run it again with ALL current usernames whenever someone is added, removed
// or changes their password; the new value replaces the old one.

import readline from 'node:readline';

// Cloudflare Workers allow at most 100,000 PBKDF2 iterations, so long passwords matter.
const ITERATIONS = 100000;
const MIN_PASSWORD_LENGTH = 14;

const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: process.stdin.isTTY });

// Typed characters are echoed by readline; swallow them while a password is being entered.
let hideInput = false;
const writeToOutput = rl._writeToOutput.bind(rl);
rl._writeToOutput = (text) => { if (!hideInput || /[\r\n]/.test(text)) writeToOutput(text); };

// Lines are queued so answers also work when piped in from a file.
const lines = [];
const waiting = [];
let closed = false;
rl.on('line', (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
rl.on('close', () => { closed = true; waiting.forEach((resolve) => resolve(null)); });

/** Resolves with the typed line, or null when input has ended. */
function ask(question, { hidden = false } = {}) {
  process.stderr.write(question);
  hideInput = hidden;
  const answer = lines.length ? Promise.resolve(lines.shift())
    : closed ? Promise.resolve(null)
    : new Promise((resolve) => waiting.push(resolve));
  return answer.finally(() => { hideInput = false; });
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  const base64 = (bytes) => Buffer.from(bytes).toString('base64');
  return { salt: base64(salt), hash: base64(new Uint8Array(bits)), iterations: ITERATIONS };
}

const users = {};
console.error(`Add each person who may use the site editor. Passwords need at least ${MIN_PASSWORD_LENGTH} characters;`);
console.error('several random words work well. Press Enter on an empty username when finished.\n');

for (;;) {
  const username = (await ask('Username: '))?.trim().toLowerCase();
  if (!username) break;
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) {
    console.error('  Use 2-40 letters, digits, dots, dashes or underscores.\n');
    continue;
  }
  const password = await ask('Password (hidden): ', { hidden: true }) ?? '';
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`  Too short: use at least ${MIN_PASSWORD_LENGTH} characters.\n`);
    continue;
  }
  if (process.stdin.isTTY && password !== await ask('Repeat password:   ', { hidden: true })) {
    console.error('  The two passwords did not match.\n');
    continue;
  }
  users[username] = await hashPassword(password);
  console.error(`  Added ${username}.\n`);
}
rl.close();

if (!Object.keys(users).length) {
  console.error('No users entered; nothing to do.');
  process.exit(1);
}
console.error('\nPaste the following line as the USERS secret:\n');
console.log(JSON.stringify(users));
