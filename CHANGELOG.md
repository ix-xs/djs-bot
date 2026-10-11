# Changelog

All notable changes to `@ix-xs/djs-bot` are documented here. This project
adheres to [Semantic Versioning](https://semver.org).

## Unreleased

### Documentation

- **One page per topic.** The site documented everything twice, once as a guide
  and once as a reference. Both are merged: 58 pages instead of 82, grouped by
  what you are trying to do (Basics, Commands, Components, Events,
  Architecture, Data, Messages, Production). Every page has the same shape: a
  first example, one section per need, a reference, limits and errors.
- Every old address redirects to its new page. `/api/errors/` did not move.
- The pages were checked against the source while merging, which corrected a
  number of statements (how `.env` is read, who calls `bot.start()`, the
  defaults of `retry()`, when `DJSBOT_E041` is raised, and more).
- **A new design**: graphite and gold, editorial type, the section a page
  belongs to above its title, numbered sections, tables that scroll on a
  phone instead of breaking words, and motion only where it explains something.
- `USAGE.md` is now the table of contents of the site rather than a second
  copy of it.

## 1.1.0

A large, backwards-compatible release: the new modal components of discord.js
14.27, automatic deferral, a framework that can speak your language, a store
with atomic counters - and a full audit that fixed a dozen real defects.

**Requirements changed:** Node **22.13+** and discord.js **14.27+** (the previous
peer range, `^14.16.0`, was wrong: Components V2 already needed 14.19).

### Added

- **Modern modals.** `field` now covers every component a modal can hold:
  `field.select`, `field.users`, `field.roles`, `field.channels`,
  `field.mentionables`, `field.files` (upload), `field.radio`,
  `field.checkboxes`, `field.checkbox` and `field.text` (a block of markdown),
  on top of `short` and `paragraph`. Every field takes a `description`.
  `ctx.fields` is typed per kind: a string, an array, a `Collection`, a boolean.
- **`ctx.showModal(Modal, params?)`** on command, context-menu, button and select
  contexts. The params are checked against the modal's declaration.
- **Automatic deferral.** `defer: true | "ephemeral" | "update" | { after, ... }`
  on any definition, or `defineBot({ defaults: { defer: true } })` for all of
  them. A handler that has not answered after 2 s is acknowledged for you; a fast
  one is left alone. Deferral and replies share one queue, so they cannot collide.
- **`defineBot({ messages })`.** Every sentence the framework shows (guard
  refusals, the generic error, the `confirm()` buttons) can be reworded or
  translated, with a template string or a function receiving the `ctx`.
  `ctx.say(key, vars)` renders one from your own code.
- **`defineBot({ theme })`** sets the colours of the semantic replies.
- **`ctx.reply.warn`, `ctx.reply.ephemeral`, `ctx.reply.fetch`, `ctx.reply.delete`**,
  plus `ctx.channelId`.
- **Store:** `increment`, `update` (both safe under concurrency), `getMany`,
  `setMany`, `entries`, `size` and `close`. `createStore(backend)` builds a full
  store from four methods, which is now the way to write an adapter.
- **Typed services with no setup.** `ctx.services.store`, `.audit` and `.flags`
  are typed out of the box, and the `deps` a `defineService` factory receives are
  typed from your `ServiceMap`. `defineService({ dispose })` releases a service
  on shutdown, in reverse order of creation.
- **Guards:** `hasRole`, `guildOwnerOnly`, and the combinators `anyOf` and `not`.
- **Jobs:** macros (`@hourly`, `@daily`, ...), month and weekday names
  (`0 9 * * MON-FRI`), `7` for Sunday, standard day-of-month/day-of-week
  semantics, `shard: "first"` to run once on a sharded bot, and
  `ctx.correlationId`.
- **Intents:** `intents: { add, remove }` adjusts the automatic selection instead
  of replacing it. The autopilot now knows polls, auto moderation, soundboard,
  stage and thread-member events.
- **`defineBot({ client })`** passes any other option to the discord.js `Client`
  (`allowedMentions`, `sweepers`, `makeCache`, ...).
- **`env.number`, `env.boolean`, `env.list`.**
- **`p.oneOf("a", "b")`** types a customId param as a union.
- **`ui.poll`, `ui.premiumButton`**, and `ui.container({ accent, spoiler }, ...)`.
- **Metrics:** components, modals, autocompletes, guard rejections, handler
  latency, gateway ping and memory. `GET /metrics?format=prometheus` serves the
  Prometheus text format; `bot.stats()` returns the counters in code.
- **`describeInteraction(interaction)`** gives a kind and a readable name, for
  logging and metrics. `afterInteraction` hooks receive `{ durationMs }`.
- **Test harness:** `subcommand`/`group`, `userCommand`, `messageCommand`,
  `autocomplete`, `job`, and `permissions`, `botPermissions`, `roles`,
  `channelId`, `messages` inputs to exercise the guards for real.
- **CLI:** `init` generates a complete project (tsconfig, `.env.example`,
  `.gitignore`, `package.json`, a typed `ServiceMap` stub); `doctor` checks the
  discord.js version, the token's shape, the ids and that `.env` is git-ignored;
  `explain --json`; `generate plugin`; `version` prints the three versions a bug
  report needs.
- **`fileTypes`** on `s.attachment` and `field.files` restricts what a user may
  upload (`"image"`, `"video"`, `"audio"` or extensions), as Discord now allows.
- **Discord's limits are checked when you define things**, not when you deploy.
  `defineCommand` rejects a description outside 1-100 characters, more than 25
  options or choices, `choices` with `autocomplete`, an impossible range, a
  command over 8000 characters; `deploy` rejects a scope with too many commands;
  `defineModal` rejects a label, description, placeholder or value that is too
  long. Each failure names the field.
- **`isHiddenChannel(channel)`** recognises the channels Discord obfuscates for
  bots from November 16, 2026.
- Three error codes: `DJSBOT_E014` (invalid modal), `DJSBOT_E015` (invalid
  command) and `DJSBOT_E080` (invalid job schedule), all raised when the
  definition is created.
- `npm run live` runs the framework against the real Discord API (deploy diff,
  gateway, message payloads), and `examples/playground` is a bot that checks
  itself as you click through it.
- The antiSpam plugin accepts `allow` (ids that are never limited).
- **Autocomplete that depends on the other options.** The handler's `ctx` gains
  `options` (what the user has already filled in, by option name), `guildId` and
  `channelId`. `harness.autocomplete` takes the same `options`.
- **Autocomplete answers Discord cannot refuse.** One invalid suggestion used to
  make Discord reject the whole list. Names over 100 characters are now cut,
  values take the type of the option (numbers for `s.integer` / `s.number`),
  and what cannot be made valid is left out, with one warning per option.
  `toAutocompleteChoices()` exposes that logic.
- **Every option shows its description in the editor.** Each property you can
  type in a `define*()` call, in `s.*`, `field.*`, `ui.*` or read on a context
  now carries a doc comment, so hovering or completing explains it.
- **The docs list every export.** A new "All exports" page is generated from the
  source (`npm run docs:api`) and a test keeps it up to date.
- **VS Code snippets** for the 1.1 building blocks: `dauto`, `dslow`, `dform`,
  `dselectuser`, `dguard`, `dconfirm`, `dpaginate`, `dtest`.

### Changed

- **Middleware now wraps the guards.** `beforeInteraction` runs before the guards
  rather than after them, so a plugin can stop an interaction ahead of everything
  (maintenance mode) and time the whole of it. `afterInteraction` is no longer
  called when a guard refused.
- **`hasPermission` and `botHasPermission` are channel-aware.** They read the
  permissions Discord computed for the channel of the interaction, overwrites
  included, and name only what is missing ("Ban Members").
- **`onError` hooks see everything.** Errors thrown by event listeners, triggers
  and jobs now reach `defineBot({ onError })` and plugin `onError` hooks (without
  a `ctx`). They used to be logged only.
- **Registration is idempotent.** The same definition may be auto-discovered and
  listed in a `defineFeature` bundle; it is registered once.
- `inGuild()` relies on `guildId`, so it also passes for user-installed apps used
  in a server the bot is not a member of. `ctx.member` is `null` there instead of
  a raw API object typed as a `GuildMember`.
- `dmPermission` is marked deprecated, as Discord replaced it with `contexts`.
- **`autocomplete: true` leaves the answer to you.** The framework used to
  answer such an option with an empty list, which made the documented use (your
  own `interactionCreate` listener) impossible. Give the option a handler to
  have the framework answer.
- **Routing is about twice as fast.** An interaction now costs the framework
  roughly 4 µs end to end, down from 9 (p99 from 40 µs to 10): the reply helpers
  are built once per class rather than as a closure set per interaction, and
  correlation ids come from a counter instead of a random generator. Measured by
  the new `npm run bench:dispatch`.
- Command, subcommand and option names accept Discord's full alphabet (Thai and
  Devanagari included).
- Feature files are imported concurrently (registration order stays
  alphabetical), and per-guild deployments are reconciled a few at a time.
- Upgraded to `@ix-xs/node-comfort` 2.0 (prototype-pollution fix included).
- `KVStore` gained required methods. A custom adapter written for 1.0 keeps
  working at runtime (it is wrapped), but a TypeScript `implements KVStore` needs
  `createStore()` or the new methods.
- `BotError.docs` points at the error's entry on the documentation site.

### Fixed

- **Select menu options accept an emoji as text.** `Menu.build(params, { options })`
  refused `emoji: "💻"` at compile time although it works; the option type now
  matches what discord.js accepts.
- A malformed `choices` entry in plain JavaScript raised a raw `TypeError`; it is
  now a `DJSBOT_E015` that shows the entry.
- **`djs-bot init` after `npm init` produced a project that did not compile.**
  The existing `package.json` was left as CommonJS while the starter uses ES
  modules. `init` now completes it: missing scripts are added, and it is switched
  to `"type": "module"` when the project has no code yet.
- **Commands were redeployed on every start.** The diff took Discord's defaults
  (`dm_permission`, `integration_types`) and missing localization maps for
  changes, so untouched and localized commands were pushed again each time.
- **In a guild scope, any command setting `contexts` or `integrationTypes` was
  redeployed every time**, which is every restart in development. Discord drops
  those fields from guild commands, so they could never match what came back.
  Found by running the deployer against the live API.
- **Deploying failed for apps with Activities**, whose Entry Point command must
  be carried over in a bulk overwrite.
- **Optional options declared before required ones were rejected by Discord.**
  Required options are now sent first, whatever the declaration order.
- **Memory grew for the lifetime of the process** in `cooldown()`, in
  `RateLimiter` (and so in `antiSpam` and `rateLimit`) and in trigger cooldowns:
  one entry per user, never removed. Expired entries are now swept.
- **Expired store keys were never purged** unless read again, in memory and in
  SQLite, and `keys()` returned them.
- **`ctx.update(...)` threw after `ctx.update.defer()`.** It now edits the
  message once the interaction was acknowledged.
- **A `*.guard.ts` file crashed the loader** (`DJSBOT_E060`): the suffix was
  matched although a guard is not a definition. `.plugin` is now discovered.
- **An invalid job schedule surfaced as an unhandled rejection** when the bot
  became ready. It now fails in `defineJob`.
- **A cron job could fire up to 15 seconds late.** Jobs fire at the top of the
  minute.
- **A service factory that threw looked like a dependency cycle** on the next
  resolution.
- **`await ctx.services` or logging it threw `DJSBOT_E031`.**
- **Plugins received an empty `app.config`.** They get the real configuration.
- A trigger whose RegExp is sticky (`y`) could skip messages, as the pattern kept its position between them.
- Two concurrent `bot.load()` calls raced and failed with a duplicate-name error.
- Auto-deploy ran on every shard instead of once.
- **On Windows, the CLI could abort with a libuv assertion** when it exited right
  after talking to Discord, most visibly when a deploy failed. Closing the
  connection pool was not enough: the sockets finish closing a few milliseconds
  later. The CLI now waits for that, on every exit path.
- A failed `deploy` or `clear` explains the usual causes (rejected token, bot
  missing from the server or invited without `applications.commands`, daily
  creation limit) instead of printing the raw API error alone.

## 1.0.0

First **stable** release. The API is now considered stable and follows semver.
Consolidates the beta line and adds the improvements below, all shaped by building
two real bots on top of the framework (a full showcase bot and a production
community bot).

### Added

- **`paginate` supports full payload pages, including Components V2.** A page can
  be an `EmbedBuilder` **or** a `{ content?, embeds?, components?, files?, flags? }`
  payload - so you can paginate `ui.container(...)` / `MessageFlags.IsComponentsV2`
  messages, not just embeds. The nav row is appended for you. Exports `Page` /
  `PagePayload`, and `ContainerChild` (the accepted `ui.container` child type).

### Changed

- **`flags` reuses the bot's `store` by default.** `defineBot({ store, flags: {
  defaults } })` now shares the store automatically - no need to pass it twice.
- **`loggerAuditSink()` takes no required argument** - it defaults to a logger,
  so `audit: { sinks: [loggerAuditSink()] }` just works.

### Fixed

- **Deploy diff now sees nested subcommands.** The change-detector only
  canonicalised top-level options, so editing a **subcommand's** option (adding
  one, changing its description) was invisible and **never deployed**. It now
  recurses through subcommands and groups.
- **SQLite store namespaces are isolated even with `_`/`%` in the name.** `keys()`
  and `clear()` used `LIKE '<prefix>%'` without escaping SQL wildcards, so a
  namespace like `store.namespace("a_b")` could read/clear another namespace's
  keys. Wildcards are now escaped.
- **Errors are no longer lost in logs.** `logger.error({ err }, …)` serialised the
  nested `Error` as `{}` (message and stack gone) in both JSON and pretty output.
  Errors anywhere in the log fields are now serialised properly (incl. `BotError`'s
  `code`/`hint`).
- **The health server can't crash the bot.** A port conflict (`EADDRINUSE`) emitted
  an unhandled `error` that took the whole process down; it's now reported and
  non-fatal.
- **A failing audit sink can't break a command.** `ctx.audit(...)` used
  `Promise.all`, so one throwing sink propagated into the handler; it's now
  best-effort (`allSettled`).
- **`djs-bot deploy` / `clear` exit cleanly on Windows.** They no longer throw a
  libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`) on exit: the HTTP
  connection pool is closed and REST timers stopped before the process exits.
- **`deploy` warns about the dev-mirror duplicate footgun.** When a dev guild is
  configured, a global deploy now reminds you those commands are also mirrored in
  the dev guild (from `djs-bot dev`) and shows how to clear them.

### Added (validation & DX)

- **Definition-time validation.** `defineCommand`/`subcommand` reject invalid
  slash/option/subcommand/group names (`DJSBOT_E012`); component builders reject
  empty ids or ids containing the reserved `$` separator (`DJSBOT_E013`) - instead
  of a cryptic Discord 400 or a component that silently never routes.
- **`ownerOnly()` uses `defineBot({ owners })`.** Called with no arguments it now
  falls back to the configured owner ids (previously the `owners` config was
  unused). `ctx.owners` is exposed too.
- **Coded errors for missing credentials.** Starting without a token throws
  `DJSBOT_E001`; deploying without a client id throws `DJSBOT_E002`.

## 1.0.0-beta.3

> ⚠️ **Beta / real-world testing.** Published under the `beta` npm tag
> (`npm i @ix-xs/djs-bot@beta`).

### Fixed

- **`paginate` / `confirm` / any component collector now work.** The interaction
  router replied "This button/menu/form is no longer available." to any component
  whose customId didn't match a registered handler - which *acknowledged* the
  interaction and stole it from self-managed collectors (`paginate`, `confirm`,
  `awaitMessageComponent`, `awaitModalSubmit`), so their `interaction.update()`
  failed with `10062 Unknown interaction`. Unmatched components/modals are now
  left untouched (a debug log) so the owning collector can respond. A genuinely
  orphaned component simply falls through to Discord's default, as elsewhere.

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
