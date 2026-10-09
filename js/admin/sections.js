// Describes every editable part of the site. The editor builds its forms from
// this file, so adding a field here is all it takes to make it editable.
//
// Field types: text, textarea, markdown, date, time, url, select, checkbox,
//              image, file, images (several images), list (repeatable items),
//              group (fields stored in a nested object), section (a visual box
//              around fields that are stored alongside their neighbours).
import { formatDate } from '../core/format.js';
import { SOCIAL_PLATFORMS } from '../core/layout.js';

const person = (itemLabel) => ({
  type: 'list',
  itemLabel,
  titleKey: 'name',
  thumbKey: 'photo',
  summary: (item) => item.role,
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'role', label: 'Position', type: 'text' },
    { key: 'email', label: 'Email', type: 'text', inputType: 'email' },
    { key: 'photo', label: 'Photo', type: 'image', folder: 'photos' },
  ],
});

export const sections = [
  {
    id: 'events',
    label: 'Events',
    file: 'events',
    page: 'events',
    fields: [
      {
        key: 'events', label: 'Events', type: 'list', itemLabel: 'event', titleKey: 'title',
        thumbKey: 'images', autoId: true, addAt: 'start',
        help: 'Drag the ⠿ handle to reorder. Events with a date move to “Past events” on their own once the day is over.',
        summary: (item) => [item.when || formatDate(item.date), item.hidden && 'Hidden'].filter(Boolean).join(' · '),
        fields: [
          { key: 'title', label: 'Event name', type: 'text', required: true },
          { key: 'images', label: 'Flyers and photos', type: 'images', folder: 'images',
            help: 'The first image is shown on the event card.' },
          { key: 'date', label: 'Date', type: 'date', width: 4 },
          { key: 'startTime', label: 'Starts', type: 'time', width: 4 },
          { key: 'endTime', label: 'Ends', type: 'time', width: 4 },
          { key: 'when', label: 'Custom date text', type: 'text', width: 6,
            placeholder: 'e.g. Every Thursday',
            help: 'Optional. Shown instead of the date, for recurring or unscheduled events.' },
          { key: 'location', label: 'Location', type: 'text', width: 6, placeholder: 'e.g. EMAGC 2.312' },
          { key: 'summary', label: 'Short summary', type: 'textarea', rows: 3,
            help: 'One or two sentences shown on the event card.' },
          { key: 'description', label: 'Full description', type: 'markdown',
            help: 'Shown when a visitor opens the event.' },
          { key: 'linkLabel', label: 'Button text', type: 'text', width: 4, placeholder: 'e.g. RSVP' },
          { key: 'linkUrl', label: 'Button link', type: 'url', width: 8, placeholder: 'https://…' },
          { key: 'hidden', label: 'Hide this event from the website', type: 'checkbox' },
        ],
      },
      { key: 'intro', label: 'Text at the top of the page', type: 'markdown' },
      { key: 'calendarUrl', label: 'Google Calendar embed link', type: 'url',
        help: 'In Google Calendar: Settings → Integrate calendar → copy the address from “Embed code”.' },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    file: 'resources',
    page: 'resources',
    fields: [
      { key: 'intro', label: 'Text at the top of the page', type: 'markdown' },
      {
        key: 'groups', label: 'Resource groups', type: 'list', itemLabel: 'group', titleKey: 'title', autoId: true,
        summary: (item) => `${item.links?.length ?? 0} file(s)`,
        fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'description', label: 'Description', type: 'markdown' },
          {
            key: 'links', label: 'Files and links', type: 'list', itemLabel: 'file', titleKey: 'label',
            fields: [
              { key: 'label', label: 'Button text', type: 'text', required: true, placeholder: 'e.g. Fall 2025' },
              { key: 'url', label: 'File or link', type: 'file', folder: 'resources',
                help: 'Drop a PDF here, or paste a web address.' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mathcorner',
    label: 'Math Corner',
    file: 'mathcorner',
    page: 'math-corner',
    fields: [
      { key: 'intro', label: 'Text at the top of the page', type: 'markdown' },
      {
        key: 'tabs', label: 'Tabs', type: 'list', itemLabel: 'tab', titleKey: 'title', autoId: true,
        help: 'Each tab is a section of the page, e.g. “Week 2”, “Challenges”. Drag the ⠿ handle to reorder; the first tab opens by default.',
        summary: (item) => [`${item.entries?.length ?? 0} entr${item.entries?.length === 1 ? 'y' : 'ies'}`, item.hidden && 'Hidden'].filter(Boolean).join(' · '),
        fields: [
          { key: 'title', label: 'Tab name', type: 'text', required: true, placeholder: 'e.g. Week 2' },
          { key: 'intro', label: 'Text at the top of the tab', type: 'markdown' },
          {
            key: 'entries', label: 'Problems, puzzles or hints', type: 'list', itemLabel: 'entry', titleKey: 'title', autoId: true,
            summary: (item) => [item.reveal && 'Has hidden text', item.hidden && 'Hidden'].filter(Boolean).join(' · '),
            fields: [
              { key: 'title', label: 'Title', type: 'text', required: true },
              { key: 'body', label: 'Text', type: 'markdown' },
              { key: 'revealLabel', label: 'Hidden text button', type: 'text', width: 4, placeholder: 'Show hint',
                help: 'e.g. Show hint, Show solution.' },
              { key: 'reveal', label: 'Hidden text', type: 'markdown',
                help: 'Optional. Visitors see this only after clicking the button above.' },
              { key: 'hidden', label: 'Hide this entry from the website', type: 'checkbox' },
            ],
          },
          { key: 'hidden', label: 'Hide this tab from the website', type: 'checkbox' },
        ],
      },
    ],
  },
  {
    id: 'home',
    label: 'Home & Contact',
    file: 'home',
    page: './',
    fields: [
      {
        key: 'slides', label: 'Slideshow', type: 'list', itemLabel: 'slide', titleKey: 'title', thumbKey: 'image',
        fields: [
          { key: 'image', label: 'Background image', type: 'image', folder: 'images', required: true },
          { key: 'title', label: 'Heading', type: 'text', required: true },
          { key: 'text', label: 'Text', type: 'textarea', rows: 2 },
          { key: 'buttonLabel', label: 'Button text', type: 'text', width: 4 },
          { key: 'buttonUrl', label: 'Button link', type: 'url', width: 5, placeholder: 'https://… or events' },
          { key: 'align', label: 'Text alignment', type: 'select', width: 3,
            options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] },
        ],
      },
      {
        key: 'contact', label: 'Contact section', type: 'group',
        fields: [
          { key: 'image', label: 'Photo', type: 'image', folder: 'images', width: 6 },
          { key: 'imageAlt', label: 'Photo description (for screen readers)', type: 'text', width: 6 },
          {
            key: 'blocks', label: 'Questions and answers', type: 'list', itemLabel: 'question', titleKey: 'heading',
            fields: [
              { key: 'heading', label: 'Heading', type: 'text', required: true },
              { key: 'text', label: 'Text', type: 'markdown' },
            ],
          },
          {
            key: 'buttons', label: 'Buttons', type: 'list', itemLabel: 'button', titleKey: 'label',
            fields: [
              { key: 'label', label: 'Button text', type: 'text', required: true, width: 4 },
              { key: 'url', label: 'Link', type: 'url', required: true, width: 8 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'people',
    label: 'About & Officers',
    file: 'people',
    page: './#about',
    fields: [
      { key: 'about', label: 'About text', type: 'markdown' },
      { key: 'officers', label: 'Officers', ...person('officer') },
      { key: 'advisors', label: 'Faculty advisors', ...person('advisor') },
    ],
  },
  {
    id: 'site',
    label: 'Site settings',
    file: 'site',
    page: './',
    fields: [
      { key: 'name', label: 'Organization name', type: 'text', required: true },
      { key: 'logo', label: 'Logo (top of every page)', type: 'image', folder: 'images', required: true, keepOriginal: true },
      {
        key: 'footer-group', label: 'Footer', type: 'section',
        fields: [
          { key: 'footerLogo', label: 'Footer logo', type: 'image', folder: 'images', keepOriginal: true, width: 6,
            help: 'Shown in a white circle, so a seal or square logo works best.' },
          { key: 'tagline', label: 'Tagline', type: 'text', width: 6 },
          { key: 'email', label: 'Contact email', type: 'text', inputType: 'email', width: 6, placeholder: 'msoc@utrgv.edu' },
          { key: 'location', label: 'Location', type: 'text', width: 6 },
          { key: 'footer', label: 'Small print', type: 'text', help: 'Shown after the copyright line.' },
          {
            key: 'social', label: 'Social media links', type: 'list', itemLabel: 'link', titleKey: 'label',
            summary: (item) => [SOCIAL_PLATFORMS[item.platform], item.url].filter(Boolean).join(' · '),
            help: 'Each link appears as an icon in the footer. Drag to reorder.',
            fields: [
              { key: 'platform', label: 'Icon', type: 'select', width: 3, options: Object.entries(SOCIAL_PLATFORMS) },
              { key: 'label', label: 'Name', type: 'text', width: 3, placeholder: 'e.g. Instagram',
                help: 'Read aloud by screen readers.' },
              { key: 'url', label: 'Link', type: 'url', required: true, width: 6, placeholder: 'https://…' },
            ],
          },
        ],
      },
    ],
  },
];
