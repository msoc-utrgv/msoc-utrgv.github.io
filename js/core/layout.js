// Navigation bar and footer shared by every public page.
import { h, link, safeUrl } from './dom.js';
import { icon, hasIcon } from './icons.js';
import { loadContent, isPreview } from './content.js';

// GitHub Pages serves events.html at /events, so links leave the extension off.
const NAV_LINKS = [
  { id: 'events', label: 'Events', href: 'events' },
  { id: 'resources', label: 'Resources', href: 'resources' },
  { id: 'contact', label: 'Contact', href: './#contact' },
];

function renderHeader(site, activePage) {
  return h('nav', { class: 'navbar navbar-expand-md site-nav', 'aria-label': 'Main' },
    h('div', { class: 'container-fluid' },
      h('a', { class: 'navbar-brand', href: './' },
        h('img', { src: site.logo, alt: site.name, height: '50' })),
      h('button', {
        class: 'navbar-toggler', type: 'button',
        'data-bs-toggle': 'collapse', 'data-bs-target': '#site-nav-links',
        'aria-controls': 'site-nav-links', 'aria-expanded': 'false', 'aria-label': 'Toggle navigation',
      }, h('span', { class: 'navbar-toggler-icon' })),
      h('div', { class: 'collapse navbar-collapse justify-content-end', id: 'site-nav-links' },
        h('ul', { class: 'navbar-nav nav-underline' },
          NAV_LINKS.map((item) => h('li', { class: 'nav-item' },
            h('a', {
              class: `nav-link${item.id === activePage ? ' active' : ''}`,
              href: item.href,
              'aria-current': item.id === activePage ? 'page' : null,
            }, item.label)))))));
}

/** Names shown to screen readers and in the editor's platform menu. */
export const SOCIAL_PLATFORMS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  discord: 'Discord',
  tiktok: 'TikTok',
  github: 'GitHub',
  website: 'Website',
  link: 'Other link',
};

function renderFooter(site) {
  const social = (site.social ?? []).filter((item) => safeUrl(item.url));
  const year = new Date().getFullYear();
  return [
    h('div', { class: 'container site-footer__main' },
      h('div', { class: 'site-footer__brand' },
        site.footerLogo && h('img', { class: 'site-footer__logo', src: safeUrl(site.footerLogo), alt: '', loading: 'lazy' }),
        h('div', {},
          h('p', { class: 'site-footer__name' }, site.name),
          site.tagline && h('p', { class: 'site-footer__tagline' }, site.tagline))),
      h('nav', { class: 'site-footer__links', 'aria-label': 'Footer' },
        NAV_LINKS.map((item) => h('a', { href: item.href }, item.label))),
      h('div', { class: 'site-footer__contact' },
        site.email && h('a', { class: 'site-footer__line', href: `mailto:${site.email}` }, icon('email'), site.email),
        site.location && h('p', { class: 'site-footer__line' }, icon('pin'), site.location),
        social.length > 0 && h('ul', { class: 'site-footer__social' },
          social.map((item) => {
            const platform = hasIcon(item.platform) ? item.platform : 'link';
            const label = item.label || SOCIAL_PLATFORMS[platform];
            return h('li', {}, link(item.url, { 'aria-label': label, title: label }, icon(platform)));
          })))),
    h('p', { class: 'site-footer__bottom' }, [`© ${year} ${site.name}`, site.footer].filter(Boolean).join(' · ')),
  ];
}

function previewBanner() {
  return h('div', { class: 'preview-banner', role: 'status' },
    'Preview of unsaved changes. Visitors do not see this until you press Save in the editor.');
}

/**
 * Draw the shared layout, then run the page's own render function.
 * render(main) receives the empty <main> element to fill.
 */
export async function mountPage(activePage, render) {
  const main = document.getElementById('app');
  try {
    const site = await loadContent('site');
    document.getElementById('site-header').replaceChildren(renderHeader(site, activePage));
    document.getElementById('site-footer').replaceChildren(...renderFooter(site));
    main.replaceChildren();
    if (isPreview) main.before(previewBanner());
    await render(main);
  } catch (error) {
    console.error(error);
    main.replaceChildren(h('div', { class: 'container py-5 text-center' },
      h('h1', { class: 'h3' }, 'This page could not be loaded'),
      h('p', {}, 'Please try again in a moment. If the problem continues, contact the Mathematical Society.')));
  }
}

/** Standard page title block used by Events and Resources. */
export function pageIntro(title, introNode) {
  return h('section', { class: 'container page-intro text-center' },
    h('h1', { class: 'section-title' }, title),
    introNode);
}
