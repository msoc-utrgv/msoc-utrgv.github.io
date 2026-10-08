// Events page: cards for upcoming events, a details dialog, past events and the calendar.
import { h, link, safeUrl } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { loadContent } from '../core/content.js';
import { markdown } from '../core/markdown.js';
import { formatDate, formatTimeRange, isPast, parseDate } from '../core/format.js';
import { mountPage, pageIntro } from '../core/layout.js';

function metaList(event) {
  const rows = [
    ['calendar', event.when || formatDate(event.date)],
    ['clock', formatTimeRange(event.startTime, event.endTime)],
    ['pin', event.location],
  ].filter(([, text]) => text);
  if (!rows.length) return null;
  return h('ul', { class: 'event-meta' }, rows.map(([name, text]) => h('li', {}, icon(name), text)));
}

function hasDetails(event) {
  return Boolean(event.description?.trim() || event.images?.length);
}

function linkButton(event, className) {
  if (!event.linkUrl) return null;
  return link(event.linkUrl, { class: className }, event.linkLabel || 'Learn more');
}

function eventCard(event, openDetails) {
  const open = () => openDetails(event);
  const cover = event.images?.[0];
  return h('div', { class: 'col' },
    h('article', { class: 'card event-card h-100', id: event.id },
      cover && h('button', { class: 'event-card__cover', type: 'button', onclick: open, 'aria-label': `Open details for ${event.title}` },
        h('img', { src: safeUrl(cover), alt: '', loading: 'lazy' })),
      h('div', { class: 'card-body d-flex flex-column' },
        h('h3', { class: 'card-title h4' }, event.title),
        metaList(event),
        event.summary && h('p', { class: 'card-text' }, event.summary),
        h('div', { class: 'event-card__actions mt-auto' },
          hasDetails(event) && h('button', { class: 'btn btn-primary', type: 'button', onclick: open },
            event.images?.length ? 'See flyer and details' : 'More information'),
          linkButton(event, hasDetails(event) ? 'btn btn-outline-primary' : 'btn btn-primary')))));
}

/** One dialog reused for every event instead of a hand-written modal per event. */
function createDetailsDialog() {
  const title = h('h2', { class: 'modal-title h4', id: 'event-dialog-title' });
  const body = h('div', { class: 'modal-body' });
  const element = h('div', { class: 'modal fade', tabindex: '-1', 'aria-labelledby': 'event-dialog-title', 'aria-hidden': 'true' },
    h('div', { class: 'modal-dialog modal-lg modal-dialog-scrollable' },
      h('div', { class: 'modal-content' },
        h('div', { class: 'modal-header' },
          title,
          h('button', { class: 'btn-close', type: 'button', 'data-bs-dismiss': 'modal', 'aria-label': 'Close' })),
        body)));
  document.body.append(element);
  const modal = new window.bootstrap.Modal(element);

  element.addEventListener('hidden.bs.modal', () => {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  });

  return function open(event) {
    const images = event.images ?? [];
    title.textContent = event.title;
    body.replaceChildren(...[
      metaList(event),
      event.description?.trim() && markdown(event.description),
      images.length && h('div', { class: `event-images${images.length > 1 ? ' event-images--grid' : ''}` },
        images.map((src) => h('a', { href: safeUrl(src), target: '_blank', rel: 'noopener', title: 'Open full size' },
          h('img', { src: safeUrl(src), alt: `${event.title} flyer`, loading: 'lazy' })))),
      linkButton(event, 'btn btn-primary mt-3'),
    ].filter(Boolean));
    history.replaceState(null, '', `#${event.id}`);
    modal.show();
  };
}

function grid(events, openDetails) {
  return h('div', { class: 'row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4' },
    events.map((event) => eventCard(event, openDetails)));
}

function calendar(url) {
  const src = safeUrl(url);
  if (!/^https:/i.test(src)) return null;
  return h('section', { class: 'container page-section text-center' },
    h('h2', { class: 'section-title' }, 'Calendar'),
    h('iframe', { class: 'calendar-frame', src, title: 'Mathematical Society calendar', loading: 'lazy' }));
}

mountPage('events', async (main) => {
  const content = await loadContent('events');
  const visible = (content.events ?? []).filter((event) => !event.hidden);
  // Upcoming events keep the order chosen in the editor; dated events move to "Past" on their own.
  const upcoming = visible.filter((event) => !isPast(event.date));
  const past = visible.filter((event) => isPast(event.date))
    .sort((a, b) => parseDate(b.date) - parseDate(a.date));
  const openDetails = createDetailsDialog();

  main.append(...[
    pageIntro('Events', markdown(content.intro, 'lead')),
    h('section', { class: 'container page-section' },
      upcoming.length
        ? grid(upcoming, openDetails)
        : h('p', { class: 'text-center text-secondary' }, 'No upcoming events are posted right now. Check back soon!')),
    past.length && h('section', { class: 'container page-section' },
      h('details', { class: 'past-events' },
        h('summary', {}, `Past events (${past.length})`),
        grid(past, openDetails))),
    calendar(content.calendarUrl),
  ].filter(Boolean));

  // Allow sharing a link straight to one event: /events#event-id
  const linked = visible.find((event) => `#${event.id}` === location.hash);
  if (linked && hasDetails(linked)) openDetails(linked);
});
