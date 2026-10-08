// Resources page: groups of downloadable files and links.
import { h, link } from '../core/dom.js';
import { loadContent } from '../core/content.js';
import { markdown } from '../core/markdown.js';
import { mountPage, pageIntro } from '../core/layout.js';

function resourceGroup(group) {
  return h('article', { class: 'card resource-card', id: group.id },
    h('div', { class: 'card-body' },
      h('h2', { class: 'card-title h4' }, group.title),
      group.description && markdown(group.description, 'card-text'),
      h('div', { class: 'resource-card__links' },
        (group.links ?? []).filter((item) => item.url).map((item) =>
          link(item.url, { class: 'btn btn-primary' }, item.label || 'Open')))));
}

mountPage('resources', async (main) => {
  const content = await loadContent('resources');
  main.append(
    pageIntro('Resources', markdown(content.intro, 'lead')),
    h('section', { class: 'container page-section resource-list' },
      (content.groups ?? []).map(resourceGroup)));
});
