# Mathematical Society at UTRGV — website

The website of the Mathematical Society (msocutrgv.com). It is a static site
(plain HTML, CSS and JavaScript, no build step) hosted on GitHub Pages, plus a
browser-based **site editor** so officers can update events, resources, the
home page and the officer list without touching code.

## Run it on your computer

You need Python 3 (nothing else to install).

```
python3 server.py
```

Then open:

- Website: http://localhost:8000/
- Editor: http://localhost:8000/admin.html — sign in with `admin` / `msoc-local-preview`

Opening the `.html` files by double-clicking will **not** work; browsers only
load JavaScript modules and JSON over `http://`.

> **Prototype login.** The username/password above is a plain placeholder so the
> editor can be tried locally. `server.py` only listens on your own computer.
> Do not expose it to the internet. See "Going live" below.

## Using the editor

| Section | What you can change |
| --- | --- |
| Events | Add / remove / reorder events; name, date, start and end time, location, summary, markdown description, flyers, button link; hide an event; intro text; calendar link |
| Resources | Groups of files — drop a PDF in, give the button a label |
| Home & Contact | Slideshow slides, contact photo, questions and buttons |
| About & Officers | About text, officers and faculty advisors (name, position, email, photo) |
| Site settings | Organization name, logo, and the footer: logo, tagline, contact email, location, social media links (icon + link), small print |

- **Images and files:** drag them from your computer onto a dashed box (or click it).
  Large photos are automatically shrunk and converted to WebP before upload.
- **Reorder:** drag the ⠿ handle, or use the ↑ ↓ buttons. Drag flyers to reorder them; the first is the cover.
- **Descriptions** use Markdown, with a live preview beside the text box.
- **Preview** opens the page with your unsaved changes. **Save** (or Ctrl+S) publishes them.
- Events that have a date move to "Past events" by themselves once the day is over.

## How it is organised

```
index.html, events.html, resources.html   Page shells (title, description, scripts)
admin.html                                The site editor
content/*.json                            ALL editable text and settings
media/images, media/photos, media/resources   Pictures and files
css/site.css                              Site styles        css/admin.css   Editor styles
js/core/     Shared helpers: DOM builder, content loader, markdown, dates, icons, nav + footer
js/pages/    One file per public page; turns content/*.json into the page
js/admin/    Editor: api.js (server calls), config.js (Worker address), sections.js (what is editable),
             forms.js (form controls), sortable.js, uploads.js, main.js
vendor/      Third-party libraries, unmodified (see Credits)
server.py    Local preview server + editor API (not used on GitHub Pages)
worker/      Cloudflare Worker: the editor's production backend (see Going live)
```

To make something new editable, add a field to `js/admin/sections.js` and read
it in the matching file in `js/pages/`.

## Going live

The public pages work on GitHub Pages as they are. The editor needs a backend
to sign in and save; in production that is the Cloudflare Worker in `worker/`
(free plan). It checks passwords against salted hashes, rate-limits sign-in
attempts, and saves by committing to this repository, after which GitHub Pages
republishes in about a minute.

One-time setup, from the `worker/` folder (needs Node.js 20 or newer):

1. `npx wrangler@latest login`
2. `npx wrangler@latest deploy` — prints the Worker's address.
3. Set the three secrets (each command asks for the value; nothing is stored in this repo):
   - `npx wrangler@latest secret put GITHUB_TOKEN` — a GitHub fine-grained token limited to
     this repository with "Contents: Read and write".
   - `npx wrangler@latest secret put SESSION_SECRET` — long random text, e.g. from `openssl rand -base64 48`.
   - `npx wrangler@latest secret put USERS` — the line printed by `node make-users.mjs`.
4. Put the Worker's address in `js/admin/config.js`.
5. Commit and push the site. The editor is then at `https://msocutrgv.com/admin.html`.

Maintenance:

- **Add / remove an editor or change a password:** run `node make-users.mjs` again with
  everyone who should have access, then `secret put USERS` again.
- **GitHub token expired or its owner left:** create a new token, `secret put GITHUB_TOKEN`.
- **Sign everyone out:** set a new `SESSION_SECRET`.
- **Site served from another address:** add it to `ALLOWED_ORIGINS` in `worker/wrangler.toml` and deploy.
- To try the Worker from your own computer, open `http://localhost:8000/admin.html?backend=worker`.
  Saving there changes the real repository.

Limits: uploads through the editor are capped at 8 MB; add larger files to
`media/` on GitHub directly and paste their path into the editor.

## Credits

Third-party work used by this site. The files in `vendor/` are unmodified copies.

| What | Version | Used for | License |
| --- | --- | --- | --- |
| [Bootstrap](https://getbootstrap.com/) — The Bootstrap Authors | 5.3.3 | Layout, components (navbar, carousel, cards, modal) — `vendor/bootstrap.min.css`, `vendor/bootstrap.bundle.min.js` | MIT |
| [Popper](https://popper.js.org/) — Federico Zivolo and contributors | 2.11.8 | Bundled inside `bootstrap.bundle.min.js` | MIT |
| [marked](https://github.com/markedjs/marked) — Christopher Jeffrey and contributors | 12.0.2 | Markdown → HTML — `vendor/marked.min.js` | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) — Cure53 and contributors | 3.1.6 | Sanitising rendered Markdown — `vendor/purify.min.js` | Apache-2.0 / MPL-2.0 |
| [Bootstrap Icons](https://icons.getbootstrap.com/) — The Bootstrap Authors | 1.11.3 | Calendar, clock, location, email and social media icon shapes in `js/core/icons.js` | MIT |
| [Work Sans](https://fonts.google.com/specimen/Work+Sans) — Wei Huang | — | Headings and body text, loaded from Google Fonts | SIL Open Font License 1.1 |
| [Sofia Sans](https://fonts.google.com/specimen/Sofia+Sans) — Lettersoup | — | Slideshow captions, loaded from Google Fonts | SIL Open Font License 1.1 |
| Google Calendar embed | — | Calendar on the Events page | Google terms of service |

`server.py` uses only the Python standard library. The Worker in `worker/` has no
dependencies; it is deployed with Cloudflare's [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (MIT / Apache-2.0)
and runs on Cloudflare Workers.

**AI assistance:** the 2026 restructuring of this site (JSON content files, the
JavaScript modules in `js/`, `css/`, the site editor, `server.py` and the Worker in `worker/`) was written
with [Claude Code](https://claude.com/claude-code) (Anthropic's Claude Opus 5.5),
directed and reviewed by Mathematical Society contributors.

Site content, photos and flyers © Mathematical Society at UTRGV and their respective authors.

## Contact

Recommendations, comments or bugs: raul.marq@yahoo.com
