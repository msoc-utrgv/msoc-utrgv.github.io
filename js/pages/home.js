// Home page: slideshow, about text, officers, advisors and contact details.
import { h, link, safeUrl } from '../core/dom.js';
import { loadContent } from '../core/content.js';
import { markdown } from '../core/markdown.js';
import { mountPage } from '../core/layout.js';

const ALIGN_CLASS = { left: 'text-start', center: 'text-center', right: 'text-end' };

function slideshow(slides) {
  if (!slides.length) return null;
  const id = 'home-carousel';
  const element = h('div', { class: 'carousel slide hero', id },
    slides.length > 1 && h('div', { class: 'carousel-indicators' },
      slides.map((slide, index) => h('button', {
        type: 'button', 'data-bs-target': `#${id}`, 'data-bs-slide-to': String(index),
        class: index === 0 ? 'active' : null, 'aria-current': index === 0 ? 'true' : null,
        'aria-label': `Slide ${index + 1}: ${slide.title}`,
      }))),
    h('div', { class: 'carousel-inner' },
      slides.map((slide, index) => h('div', { class: `carousel-item${index === 0 ? ' active' : ''}` },
        h('img', { class: 'hero__image', src: safeUrl(slide.image), alt: '', loading: index === 0 ? 'eager' : 'lazy' }),
        h('div', { class: `carousel-caption hero__caption ${ALIGN_CLASS[slide.align] ?? ALIGN_CLASS.left}` },
          h(index === 0 ? 'h1' : 'h2', { class: 'hero__title' }, slide.title),
          slide.text && h('p', {}, slide.text),
          slide.buttonUrl && h('p', { class: 'mb-0' },
            link(slide.buttonUrl, { class: 'btn btn-lg btn-primary' }, slide.buttonLabel || 'Learn more')))))),
    slides.length > 1 && ['prev', 'next'].map((direction) => h('button', {
      class: `carousel-control-${direction}`, type: 'button', 'data-bs-target': `#${id}`, 'data-bs-slide': direction,
    },
      h('span', { class: `carousel-control-${direction}-icon`, 'aria-hidden': 'true' }),
      h('span', { class: 'visually-hidden' }, direction === 'prev' ? 'Previous' : 'Next'))));
  new window.bootstrap.Carousel(element, { ride: 'carousel' });
  return element;
}

function personCard(person) {
  return h('li', { class: 'person' },
    person.photo && h('img', { class: 'person__photo', src: safeUrl(person.photo), alt: `Portrait of ${person.name}`, loading: 'lazy' }),
    h('h3', { class: 'person__name' }, person.name),
    person.role && h('p', { class: 'person__role' }, person.role),
    person.email && h('p', { class: 'person__email' }, h('a', { href: `mailto:${person.email}` }, person.email)));
}

function peopleGrid(people, modifier) {
  if (!people?.length) return null;
  return h('ul', { class: `people people--${modifier}` }, people.map(personCard));
}

function about(people) {
  return h('section', { class: 'container page-section', id: 'about' },
    h('h2', { class: 'section-title section-title--ruled' }, 'About'),
    markdown(people.about, 'lead'),
    peopleGrid(people.officers, 'officers'),
    peopleGrid(people.advisors, 'advisors'));
}

function contact(info = {}) {
  return h('section', { class: 'container page-section', id: 'contact' },
    h('h2', { class: 'section-title section-title--ruled' }, 'Contact'),
    h('div', { class: 'row g-4 align-items-center' },
      info.image && h('div', { class: 'col-lg-6' },
        h('img', { class: 'contact__image', src: safeUrl(info.image), alt: info.imageAlt ?? '', loading: 'lazy' })),
      h('div', { class: 'col-lg-6 text-center' },
        (info.blocks ?? []).map((block) => h('div', { class: 'contact__block' },
          h('h3', {}, block.heading),
          markdown(block.text, 'lead'))),
        h('div', { class: 'contact__buttons' },
          (info.buttons ?? []).filter((button) => button.url).map((button) =>
            link(button.url, { class: 'btn btn-primary btn-lg' }, button.label))))));
}

mountPage('home', async (main) => {
  const [home, people] = await Promise.all([loadContent('home'), loadContent('people')]);
  main.append(...[slideshow(home.slides ?? []), about(people), contact(home.contact)].filter(Boolean));

  // The sections are drawn after the browser's own #anchor jump, so repeat it.
  if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
});
