// Math Corner page: tabs of problems, challenges, puzzles and hints.
import { h } from '../core/dom.js';
import { loadContent } from '../core/content.js';
import { markdown } from '../core/markdown.js';
import { mountPage, pageIntro } from '../core/layout.js';

function entryCard(entry) {
  return h('article', { class: 'card corner-card' },
    h('div', { class: 'card-body' },
      h('h2', { class: 'card-title h4' }, entry.title),
      entry.body && markdown(entry.body, 'card-text'),
      entry.reveal && h('details', { class: 'corner-reveal' },
        h('summary', {}, entry.revealLabel || 'Show hint'),
        markdown(entry.reveal))));
}

function tabButton(tab, active) {
  return h('li', { class: 'nav-item', role: 'presentation' },
    h('button', {
      class: `nav-link${active ? ' active' : ''}`, type: 'button', role: 'tab',
      id: `${tab.id}-tab`, 'data-bs-toggle': 'tab', 'data-bs-target': `#${tab.id}`,
      'aria-controls': tab.id, 'aria-selected': String(active),
      // Keeps the open tab in the address so it can be shared or bookmarked.
      onclick: () => history.replaceState(history.state, '', `#${tab.id}`),
    }, tab.title));
}

function tabPane(tab, active) {
  const entries = (tab.entries ?? []).filter((entry) => !entry.hidden);
  return h('div', {
    class: `tab-pane fade${active ? ' show active' : ''}`, id: tab.id,
    role: 'tabpanel', 'aria-labelledby': `${tab.id}-tab`, tabindex: '0',
  },
    tab.intro && markdown(tab.intro, 'corner-intro'),
    entries.length > 0
      ? h('div', { class: 'corner-list' }, entries.map(entryCard))
      : h('p', { class: 'corner-empty' }, 'Nothing here yet. Check back soon.'));
}

mountPage('math-corner', async (main) => {
  const content = await loadContent('mathcorner');
  const tabs = (content.tabs ?? []).filter((tab) => tab.id && !tab.hidden);
  const open = tabs.find((tab) => `#${tab.id}` === location.hash) ?? tabs[0];
  main.append(
    pageIntro('Math Corner', markdown(content.intro, 'lead')),
    h('section', { class: 'container page-section' },
      h('ul', { class: 'nav nav-tabs corner-tabs', role: 'tablist' }, tabs.map((tab) => tabButton(tab, tab === open))),
      h('div', { class: 'tab-content' }, tabs.map((tab) => tabPane(tab, tab === open)))));
});
