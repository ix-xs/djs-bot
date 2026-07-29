# Documentation site

An [Astro Starlight](https://starlight.astro.build) site for `@ix-xs/djs-bot`.

The **Guide** pages are generated from the repo's [`USAGE.md`](../USAGE.md) by
[`scripts/generate.mjs`](./scripts/generate.mjs) - edit `USAGE.md`, not the
generated files (they live in `src/content/docs/guide/` and are gitignored).

## Develop

```bash
cd docs
npm install
npm run dev        # regenerates guide pages, then starts Astro at http://localhost:4321/djs-bot
```

## Build

```bash
npm run build      # → docs/dist  (static site, ready for GitHub Pages)
```

`base` is set to `/djs-bot` in `astro.config.mjs` for GitHub Pages under
`ix-xs.github.io/djs-bot`. Change `site`/`base` for a custom domain.

## Deploy (GitHub Pages)

Add a workflow that runs `npm ci && npm run build` in `docs/` and publishes
`docs/dist` with `actions/deploy-pages`.
