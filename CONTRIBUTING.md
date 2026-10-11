# Contributing to `@ix-xs/djs-bot`

Thanks for helping out! Everything below runs **from the repository root** - you
never need to `cd` into a subfolder.

## What ships to npm vs what's repo-only

`npm install @ix-xs/djs-bot` only downloads the compiled library and docs:

| Published to npm | Repo-only (never installed by users) |
| --- | --- |
| `dist/` (built JS + `.d.ts`) | `src/`, `test/` |
| `README.md`, `USAGE.md`, `CHANGELOG.md`, `LICENSE` | `docs/`, `examples/`, `benchmarks/`, `editors/` |

So end users interact with just three things: the **CLI** (`npx djs-bot …`), the
**docs website**, and `README`/`USAGE`. They never navigate `node_modules`.

## Prerequisites

- Node.js ≥ 22 (a dependency uses the built-in `node:sqlite`)
- `npm install` (installs dev deps: TypeScript, tsup, vitest, tsx, …)

## Everyday commands (all from the repo root)

| Command | What it does |
| --- | --- |
| `npm run check` | Typecheck + type-level tests + build + unit tests (run this before pushing) |
| `npm test` | Unit tests (vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:types` | Type-level tests (`tsconfig.test.json`) |
| `npm run typecheck` | `tsc --noEmit` on `src/` |
| `npm run build` | Build dual ESM/CJS + `.d.ts` into `dist/` |
| `npm run attw` | `@arethetypeswrong/cli` - verify published types resolve (CJS/ESM/node10/bundler) |
| `npm run bench` | Run the loader/routing benchmarks |
| `npm run bench:dispatch` | Time one interaction through the real router |
| `npm run live` | Check the framework against the real Discord API (needs a test bot in `.env`) |
| `npm run playground` | Run the self-checking playground bot |
| `npm run example` | Run the minimal example bot (needs `DISCORD_TOKEN` in `.env`) |
| `npm run docs` | Serve the docs site locally |
| `npm run docs:build` | Build the static docs site into `docs/dist/` |

`npm run docs` / `docs:build` transparently install the docs' own dependencies
(Astro/Starlight) the first time - you don't manage them separately.

## Where things live

```
src/            framework source (published as dist/)
test/           unit + type-level tests
examples/       minimal (TS), javascript (CJS), production - reference bots
docs/           Astro Starlight site, one Markdown page per topic
benchmarks/     tinybench performance suites
editors/vscode  VS Code snippets + extension manifest
.github/        CI (test + attw) and docs-deploy workflows
```

- **Docs content** lives in `docs/src/content/docs/`, one page per topic. A fact
  has one home: link to the page that owns it rather than explaining it twice.
  `USAGE.md` is only the table of contents shipped with the package; update it
  when a page is added, renamed or removed (and add the old address to
  `docs/redirects.mjs`).
- **Public API** is guarded by type-level tests in `test/types.test-d.ts`; if you
  change typings, update those assertions.
- **Every export needs a doc comment**, and so does every property a user can
  type or read: it is what their editor shows. After adding an export, run
  `npm run docs:api` to refresh the "All exports" page of the docs.

## Releasing

```bash
npm run check          # everything green
npm version <patch|minor|major>
git push --follow-tags origin main
npm publish            # prepublishOnly rebuilds dist automatically
```

The docs site redeploys to GitHub Pages automatically on push to `main`
(`.github/workflows/docs.yml`).
