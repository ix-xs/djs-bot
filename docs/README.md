# Documentation site

An [Astro Starlight](https://starlight.astro.build) site for `@ix-xs/djs-bot`.

| Section | Source | Tracked |
| --- | --- | --- |
| Tutorial | `src/content/docs/tutorial/*.mdx`, written by hand | yes |
| Guides | generated from [`USAGE.md`](../USAGE.md) into `src/content/docs/guide/` | no (gitignored) |
| API reference | `src/content/docs/api/*.md`, written by hand | yes |
| Recipes, Help | `src/content/docs/recipes/`, `src/content/docs/help/` | yes |

To change a guide, edit `USAGE.md`: the pages are rebuilt from it by
[`scripts/generate.mjs`](./scripts/generate.mjs) on every `dev` and `build`.

## Develop

```bash
cd docs
npm install
npm run dev        # regenerates the guides, then serves http://localhost:4321/djs-bot
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
[the store](/api/store/#namespaces)
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
