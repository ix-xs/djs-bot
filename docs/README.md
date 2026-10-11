# Documentation site

An [Astro Starlight](https://starlight.astro.build) site for `@ix-xs/djs-bot`.

| Section | Source | Tracked |
| --- | --- | --- |
| Tutorial | `src/content/docs/tutorial/*.mdx`, written by hand | yes |
| Topic pages | `src/content/docs/{basics,commands,components,events,architecture,data,messages,production}/`, one page per topic, written by hand | yes |
| Errors, CLI | `src/content/docs/api/errors.md`, `api/cli.md`, written by hand | yes |
| All exports | `src/content/docs/api/exports.md`, generated from the source code | yes |
| Recipes, Help | `src/content/docs/recipes/`, `src/content/docs/help/` | yes |

Each topic has exactly one page, and each fact has one home: a page links to
the page that owns something instead of explaining it again. A page has the
same shape everywhere: a first example, one section per need, a `Reference`
section, limits and errors, then `See also`. The `description` in the
frontmatter is shown as the lead paragraph under the title.

When a page moves, add its old address to [`redirects.mjs`](./redirects.mjs).
`/api/errors/` must never move: published versions of the package print links
to its anchors.

The "All exports" page lists every symbol with the first sentence of its doc
comment. After adding or documenting an export, run `npm run docs:api` from the
repository root and commit the result; the test suite fails when the page is
out of date.

## Develop

```bash
cd docs
npm install
npm run dev        # serves http://localhost:4321/djs-bot
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
