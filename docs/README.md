# Documentation site

An [Astro Starlight](https://starlight.astro.build) site for `@ix-xs/djs-bot`.

| Section | Source | Tracked |
| --- | --- | --- |
| The guide's path | `src/content/docs/index.mdx`, `start/`, `bot/`: one bot built page by page, written by hand | yes |
| Topic pages | `src/content/docs/{basics,commands,components,events,architecture,data,messages,production}/`, one page per topic, written by hand | yes |
| Errors, CLI | `src/content/docs/api/errors.md`, `api/cli.md`, written by hand | yes |
| API reference | `src/pages/reference/`, one page per export, built from `src/data/api.json` | yes (the JSON) |
| Complete examples, Help | `src/content/docs/recipes/`, `src/content/docs/help/` | yes |

The sidebar of the guide is written out in `astro.config.mjs`, in reading
order. The guide's path comes first and is read in order; the topic pages are
read when needed. Each fact has one home: a page links to the page that owns
something instead of explaining it again.

A page of the path opens with its own first paragraph (the `description` is
then used only for search engines and link previews). A topic page shows its
`description` as the lead, then a first example, one section per need, a short
`Reference` section that lists its exports with a link to each in the API
reference, limits and errors, then `See also`.

The animated Discord and terminal scenes are `src/components/demo/`: a page
describes what happens in a few steps (`DiscordDemo`, `TerminalDemo`). What
they print must be what the program prints. `/dev/worst/` on the dev server
shows them with the worst realistic data (`fixtures.ts`); it is never built.

When a page moves, add its old address to [`redirects.mjs`](./redirects.mjs).
`/api/errors/` must never move: published versions of the package print links
to its anchors.

## The API reference

`src/data/api.json` describes every export of the package: its kind, its
signature, its doc comment, its parameters, properties and methods, and the
types they mention, each linked to its page (or to discord.js.org). It is
written from the TypeScript declarations by `scripts/api-model.mjs`; which
page of the guide explains each export is set in `scripts/api-pages.mjs`.

After adding or documenting an export, run `npm run docs:api` from the
repository root and commit the result; `npm test` fails when the JSON is out of
date, or when an export has no doc comment or no page of the guide.

In the guide, a name of the API written in code (`defineCommand()`,
`ctx.reply`) links to its reference page by itself (`plugins/api-links.mjs`).

## Languages

English is the original and sits at the root of `src/content/docs/`. A
translation mirrors it in a folder named after its language: the French page of
`commands/options.md` is `fr/commands/options.md`, served at `/fr/commands/options/`.
A page that has no translation yet falls back to English, with a notice.

A translation changes the prose and nothing else:

- **Links** are written exactly as in English (`/data/store/#namespaces`). The
  build adds the language.
- **Headings** stay in the same number and order. The build gives each one the
  id of its English counterpart, so anchors are the same in every language.
- **Code blocks** are copied as they are; only comments are translated.
- In an `.mdx` page, a relative import gains one `../`.

`npm run check-translation` compares every translated page with its original
(frontmatter keys, headings, code, link targets) and the deploy workflow runs
it. After changing an English page, change its translations in the same commit.

The words of the interface (header, search suggestions, demos) are in
`src/i18n.ts` and the demo components; Starlight translates its own. The
texts of the search results are in `src/content/i18n/<language>.json`: the
search library leaves them in English otherwise.

The API reference is translated sentence by sentence: `src/data/api.<language>.json`
holds each sentence of the doc comments with its translation, used only while
the English is unchanged. When a doc comment changes or an export is added,
`npm test` fails and names what is to translate;
`npm run docs:api -- --pending` prints the entries to fill in.

What a translated page still says in English is deliberate: code, the messages
a program prints (error messages, what Discord shows), and names of things.

To add a language, add it to `LOCALES` in `plugins/base-links.mjs`, to
`locales` in `astro.config.mjs`, to `LANGUAGES` and the dictionary in
`src/i18n.ts`, to `TRANSLATIONS` in `scripts/api-model.mjs` (with its
`src/data/api.<language>.json`), to the words of `src/reference/model.ts`, to `LABELS` in `plugins/wrap-tables.mjs`, add
`src/content/i18n/<language>.json`, then translate the pages, `404.md`
included: a missing address under a language is sent to that language's own
"not found" page.

The site icon is drawn in `public/favicon.svg`. After changing it, run
`node scripts/icons.mjs` and commit the two PNG files it writes.

## Develop

```bash
cd docs
npm install
npm run dev        # serves http://localhost:4321/djs-bot/
```

## Build and check

```bash
npm run build         # static site in docs/dist
npm run check-links   # every internal link and #anchor must resolve
```

The deploy workflow runs both, so a renamed heading that breaks an anchor fails
the build instead of shipping.

## Writing links

Write internal links **root-relative, without the base path**:

```md
[the store](/data/store/#namespaces-and-bulk-access)
```

[`plugins/base-links.mjs`](./plugins/base-links.mjs) prepends the base at build
time, in Markdown links and in the `href` of MDX components alike.

## Hosting it somewhere else

The site URL and base path come from two environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DOCS_SITE` | `https://ix-xs.github.io` | The origin the site is served from |
| `DOCS_BASE` | `/djs-bot` | The path under that origin (`/` for the root) |

```bash
DOCS_SITE=https://docs.example.dev DOCS_BASE=/ npm run build
```

On GitHub, set them as repository variables (Settings > Secrets and variables >
Actions > Variables): [the workflow](../.github/workflows/docs.yml) passes them
through, and falls back to the defaults when they are unset. No content has to
change.
