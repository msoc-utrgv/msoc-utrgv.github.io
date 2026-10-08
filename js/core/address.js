// Keeps ".html" out of addresses. GitHub Pages serves events.html at /events,
// so the short form is used everywhere a visitor can see it.

const HTML_PAGE = /^([^?#]*?)(index)?\.html(?=$|[?#])/i;

/** "events.html#x" -> "events#x", "index.html#contact" -> "./#contact". Other addresses are returned unchanged. */
export function cleanPageUrl(url) {
  const value = String(url ?? '');
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(value)) return value; // another website
  return value.replace(HTML_PAGE, (match, folder, index) => (index && !folder ? './' : folder));
}

/** If the visitor arrived through an old ".html" link or bookmark, show the short address instead. */
export function showCleanAddress() {
  const { pathname, search, hash } = location;
  const clean = pathname.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
  if (clean !== pathname) history.replaceState(history.state, '', clean + search + hash);
}
