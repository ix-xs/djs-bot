# Changelog

All notable changes to `@ix-xs/djs-bot` are documented here. This project
adheres to [Semantic Versioning](https://semver.org).

## 1.0.0-beta.2

> ⚠️ **Beta / real-world testing.** Published under the `beta` npm tag
> (`npm i @ix-xs/djs-bot@beta`).

### Fixed

- **`ui.container(...)` typing.** It accepted only `AnyComponentBuilder` (action-row
  children) even though it builds a Components V2 container from display builders.
  `ui.container(ui.text(...), ui.section(...), ...)` now type-checks. Added a
  `ContainerChild` export for the accepted union.
- **Feature/plugin `requires` now recognises config-provided services.** A feature
  declaring `requires: ["store"]` (or `"audit"` / `"flags"`) failed contract
  validation with `DJSBOT_E040` even though the bot provided them, because the
  check only inspected `registry.services` and not container-registered values.
  It now also consults the DI container.

## 1.0.0-beta.1

> ⚠️ **Beta / real-world testing.** Published under the `beta` npm tag
> (`npm i @ix-xs/djs-bot@beta`).

### Fixed

- **Loader now runs the `init` starter (and any project) under `tsx`.** When the
  framework resolved to its CommonJS build (which is what `tsx` / `node --import
  tsx` does), `await import()` of a feature file double-wrapped the definition as
  `{ default: { __esModule: true, default: <def> } }`. The loader only unwrapped
  one level, so every discovered file looked empty and threw
  `DJSBOT_E060 - matched a convention suffix but exports no define*() result`.
  `collectDefinitions` now descends through the interop wrapper (and nested
  arrays). Fixes a hard crash on `npx djs-bot dev` right after `npx djs-bot init`.
- **`explain` / `deploy` / `doctor` / `clear`** hit the same interop wrapper on
  the entry file and failed with *"must default-export a bot from defineBot()"*.
  A shared `interopDefault` helper now unwraps the entry the same way.
- **`init` starter** no longer emits the removed `deploy.mode` field; it scaffolds
  `deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") }`.
- **`doctor`** now checks for Node >= 22 (matching `engines`), not >= 20.

### Changed

- **Requires Node >= 22.** A dependency (`@ix-xs/node-comfort`) loads the built-in
  `node:sqlite`, which does not exist on Node 20. `engines`, the CI matrix and the
  docs were updated. (This also corrects the `beta.0` tarball, which wrongly
  advertised `>= 20`.)

## 1.0.0-beta.0

> ⚠️ **Beta / real-world testing.** Published under the `beta` npm tag
> (`npm i @ix-xs/djs-bot@beta`). The API is close to stable but may still change,
> and bugs are expected. Pin an exact version and report issues.

Complete rewrite - from a component-composition toolkit into a full,
production-minded bot framework. **Breaking:** the entire API is new (previous
published line was `0.1.4`).

### Added

- **`defineBot`** orchestrator with an explicit lifecycle: discover → validate →
  resolve DI → connect → route → drain → shutdown.
- **Typed slash commands** (`defineCommand`) with the `s` option builders and a
  fully-typed `ctx.options`.
- **Subcommands & groups** - `subcommand()` helper with per-subcommand typed
  options; automatic routing (no `getSubcommand()` switch) and nested deploy JSON.
- **Context menu commands** - `defineUserCommand` / `defineMessageCommand` with
  `ctx.targetUser` / `ctx.targetMember` / `ctx.targetMessage`, deployed as the
  correct application-command type.
- **Install & interaction contexts** - `integrationTypes` (`"guild"`/`"user"`)
  and `contexts` on every command type, for user-installable apps; emitted as
  `integration_types`/`contexts` and diffed on deploy.
- **Message triggers** - `defineTrigger` auto-responders (keyword / RegExp /
  predicate) with per-author cooldowns; message intents derived automatically.
- **Formatting helpers** - `mention.*`, `emoji.*`, `timestamp`, `allowedMentions`.
- **`ui` builders** - terse factories for action rows and Components V2
  (container, section, text, separator, gallery, thumbnail, file, linkButton).
- **Smart caching** - `TTLCache` / `createCache` (TTL + LRU + single-flight +
  stale-while-revalidate) and `resolve.*` cache-first entity fetching.
- **Autocomplete** - per-option async `autocomplete` handlers (string/integer/
  number, incl. inside subcommands) with automatic routing and error handling.
- **Native select menus** - `defineUserSelect` / `defineRoleSelect` /
  `defineChannelSelect` / `defineMentionableSelect`, with `ctx.users` /
  `ctx.members` / `ctx.roles` / `ctx.channels` resolved for you.
- **Command localizations** - `nameLocalizations` / `descriptionLocalizations`
  on commands, options, subcommands and context menus (part of the deploy diff).
- **Sharding** - `sharding: "auto" | true | { totalShards, mode, respawn }`; the
  manager spawns shard children automatically, `bot.client.shard` for cross-shard.
- **Pagination & dialogs** - `paginate()` (nav buttons + collector, eager or lazy
  pages) and `confirm()` (yes/no → boolean), self-managed, no global handler.
- **Presence** - `presence`, `presenceRotation`, and runtime `bot.setPresence()` /
  `bot.setActivity()`.
- **Asset URLs** - `assets.avatar/banner/guildIcon/guildBanner/guildSplash/emoji`.
- **Voice-state helpers** - `voice.channelOf/isConnected/membersIn/move/
  disconnect/mute/deafen` (no `@discordjs/voice` dependency).
- **Internationalisation** - `createI18n` + `i18n` config; `ctx.t(key, vars)` /
  `ctx.locale` per user, with nested keys, `{var}` interpolation, `{count}`
  pluralization and locale fallback.
- **Persistence** - async `KVStore` with `memoryStore()` and `sqliteStore()`
  adapters (TTL, `namespace()`, `getOrSet()`), `defineStore`, and a `store`
  config auto-registered as `ctx.services.store`.
- **Resilience** - `rateLimit` guard + `createRateLimiter`, `createCircuitBreaker`
  (`CircuitOpenError`), and `retry` / `timeout` helpers.
- **Audit trail** - `createAuditLog` with memory/store/logger sinks, filtered
  `query()`, `ctx.audit(action, details)`, and optional auto-recording of
  commands; registered as the `audit` service.
- **Feature flags** - `createFeatureFlags` (global + per-guild overrides over a
  `KVStore`), the `featureEnabled()` guard, and a `flags` service.
- **Health & metrics** - `startHealthServer` / `health` config exposing
  `/healthz`, `/readyz` and `/metrics` (interaction/command/error counts,
  uptime, guilds, shard).
- **Typed customId router** - `defineButton` / `defineSelectMenu` / `defineModal`
  encode/decode typed params into the customId (`p` codecs, `field` builders),
  with a hard 100-char guard (`DJSBOT_E020`).
- **Intent autopilot** (`intents: "auto"`) - derives gateway intents & partials
  from your events and warns about privileged intents.
- **Error boundaries** - every interaction is wrapped, logged with a correlation
  id, and always answered.
- **Command diff deployer** - `djs-bot deploy` pushes only what changed, with
  `--dry-run`. **Per-command scoping**: a command with no `guilds` is global; a
  command listing `guilds: [...]` deploys only to those servers. Mix global and
  server-specific commands freely (and target multiple guilds); each target is
  diffed and pushed independently. `djs-bot explain` prints the full plan.
  Deployment is **declarative**: adds/updates/**removes** automatically to match
  your code. Guilds you stop targeting are **auto-pruned** (tracked in a
  gitignored `.djs-bot/deploy-state.json`). New `djs-bot clear`
  (`--global`/`--guild`) and `bot.clear()` wipe a scope entirely.
- **Guards** - composable preconditions (`inGuild`, `hasPermission`,
  `botHasPermission`, `inChannel`, `ownerOnly`, `cooldown`, custom `guard()`).
- **Lightweight DI** (`defineService`) with explicit deps and an augmentable
  `ServiceMap`.
- **Jobs** (`defineJob`) with cron + duration schedules, concurrency limits and
  an abort signal on shutdown.
- **Plugins** (`definePlugin`) and **features** (`defineFeature`) with a
  validated capability graph (`requires` / `provides` / `conflicts`).
- **Structured logger**, typed **config** (`env`, `.env` loading), and coded
  errors (`BotError`, `DJSBOT_Exxx`).
- **CLI** `djs-bot`: `dev`, `start`, `deploy`, `doctor`, `explain`, `generate`,
  `init`.
- **Test harness** (`@ix-xs/djs-bot/testing`) to invoke handlers with no token
  and no network.
- Dual **ESM/CJS** build with generated `.d.ts`, Node ≥ 20, discord.js v14 as a
  peer dependency.

### Correctness & packaging

- **Type-correct `required`** - `s.string({ required: true })` (and every option
  builder) now makes `ctx.options.<name>` non-optional, via overloads that also
  keep inline `autocomplete` callbacks fully typed.
- **Dual-package types** - `exports` map now serves ESM type declarations
  (`.d.mts`) to ESM importers and CJS (`.d.ts`) to CJS importers; verified green
  by `@arethetypeswrong/cli` for node10, node16 (CJS & ESM) and bundler, for both
  `@ix-xs/djs-bot` and `@ix-xs/djs-bot/testing`.
- **CommonJS feature files** - the loader de-duplicates the `default` /
  `module.exports` aliasing so `module.exports = defineCommand(...)` in a plain
  `.js` project loads exactly once.
- Verified end to end in real consumer projects: JS (CommonJS `require`), JS
  (ESM `import`), TS (`NodeNext`), and TS (`Bundler`).

### Tests, examples & CI

- **Type-level tests** (`npm run test:types`) that assert the public type
  contracts - including that `required: true` yields non-optional options - so
  the typing paradigm can't silently regress.
- **35 unit tests** across customId, harness, commands, i18n, stores, resilience,
  audit, flags, and the health server (real HTTP requests).
- **Examples** for TypeScript (`examples/minimal`), plain JavaScript
  (`examples/javascript`), and a full production wiring (`examples/production`:
  sharding + health + store + audit + flags + i18n + presence + an economy
  feature using pagination).
- **CI** (`.github/workflows/ci.yml`) runs typecheck, type tests, build and unit
  tests on Node 20 & 22, plus `@arethetypeswrong/cli` to guard the published
  types. Aggregate `npm run check` script.

### Ecosystem

- **Official plugins** at the `@ix-xs/djs-bot/plugins` subpath: `antiSpam`,
  `commandLogger`, `errorReporter`, `maintenance` - with tests.
- **VS Code snippets** (`editors/vscode`) for every `define*` block, in TS & JS.
- **Docs site** (`docs/`) - Astro Starlight, with the Guide auto-generated from
  `USAGE.md` and a GitHub Pages deploy workflow.
- **Benchmarks** (`benchmarks/`, `npm run bench`) for the loader and routing hot
  paths - per-interaction routing overhead measures ~1.4 µs.
- **Lean package** - no source maps shipped (only `dist` + docs files), ~168 kB
  tarball. Verified end to end in a fresh consumer: CJS `require`, ESM `import`,
  TS `NodeNext`, the CLI, and the `/plugins` and `/testing` subpaths.

[1.0.0]: https://www.npmjs.com/package/@ix-xs/djs-bot
