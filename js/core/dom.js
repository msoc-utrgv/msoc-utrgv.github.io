// Small DOM helpers shared by the public pages and the editor.
import { cleanPageUrl } from './address.js';

/**
 * Create an element. Text children are inserted as text nodes, so content
 * coming from the JSON files can never be interpreted as HTML.
 *   h('a', { class: 'btn', href: url, onclick: fn }, 'Label')
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  const deferred = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'value' || key === 'checked') deferred[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  // Set after children exist so <select value> can find its <option>.
  Object.assign(el, deferred);
  return el;
}

/** Only allow links that cannot run script (no javascript: or data: URLs). */
export function safeUrl(url) {
  const value = String(url ?? '').trim();
  if (!value) return '';
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
  return value;
}

export function isExternal(url) {
  return /^https?:/i.test(url);
}

/** Anchor that opens external sites in a new tab. */
export function link(url, props, ...children) {
  const href = cleanPageUrl(safeUrl(url));
  const external = isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return h('a', { href: href || '#', ...external, ...props }, ...children);
}
