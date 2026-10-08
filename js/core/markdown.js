// Markdown -> safe HTML. marked does the parsing and DOMPurify strips anything
// that could run script, so text typed into the editor cannot inject code.
import { h } from './dom.js';
import { cleanPageUrl } from './address.js';

const { marked, DOMPurify } = window;

marked.setOptions({ gfm: true, breaks: true });

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) node.setAttribute('href', cleanPageUrl(node.getAttribute('href')));
  if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') ?? '')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
});

export function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(String(text ?? '')), { USE_PROFILES: { html: true } });
}

/** A <div class="md"> holding the rendered markdown. */
export function markdown(text, className = '') {
  const el = h('div', { class: `md ${className}`.trim() });
  el.innerHTML = renderMarkdown(text);
  return el;
}
