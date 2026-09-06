---
title: "API overview"
description: "Every symbol the framework exports, what it is for, and where it is documented."
sidebar:
  order: 1
  badge:
    text: Reference
    variant: note
---

Everything below is exported from the package root:

```ts
import { defineBot, defineCommand, s, guard /* … */ } from "@ix-xs/djs-bot";
```

Only the official plugins live on a subpath:

```ts
import { antiSpam, commandLogger } from "@ix-xs/djs-bot/plugins";
```

There is no default export, no side-effectful import and no global state — every
symbol below is a plain function, class or type.

## Entry points

| Export | Kind | What it does | Reference |
| --- | --- | --- | --- |
| `defineBot(config)` | function | Creates and configures the bot | [Configuration](/djs-bot/api/configuration/) |
| `Bot` | class | The bot instance (`load`, `start`, `deploy`, `clear`, `shutdown`, `describe`) | [Configuration](/djs-bot/api/configuration/#the-bot-instance) |
| `isBot(value)` | guard | Cross-realm check that a value is a `Bot` | [Configuration](/djs-bot/api/configuration/#the-bot-instance) |
| `env(name, fallback?)` | function | Required env var, throws a clear error when missing | [Configuration](/djs-bot/api/configuration/#env) |
| `env.optional(name)` | function | Same, but returns `undefined` | [Configuration](/djs-bot/api/configuration/#envoptional) |
| `loadEnvFile(path?)` | function | Loads a `.env` file into `process.env` | [Configuration](/djs-bot/api/configuration/#loadenvfile) |

## Authoring definitions

| Export | Creates | Reference |
| --- | --- | --- |
| `defineCommand` | A slash command | [Definitions](/djs-bot/api/definitions/#definecommand) |
| `subcommand` | One leaf of a subcommand tree | [Definitions](/djs-bot/api/definitions/#subcommand) |
| `defineUserCommand` | A user context-menu command | [Definitions](/djs-bot/api/definitions/#defineusercommand) |
| `defineMessageCommand` | A message context-menu command | [Definitions](/djs-bot/api/definitions/#definemessagecommand) |
| `defineEvent` | A gateway event listener | [Definitions](/djs-bot/api/definitions/#defineevent) |
| `defineTrigger` | A message auto-responder | [Definitions](/djs-bot/api/definitions/#definetrigger) |
| `defineButton` | A routed button | [Definitions](/djs-bot/api/definitions/#definebutton) |
| `defineSelectMenu` | A string select menu | [Definitions](/djs-bot/api/definitions/#defineselectmenu) |
| `defineUserSelect` | A user select menu | [Definitions](/djs-bot/api/definitions/#native-select-menus) |
| `defineRoleSelect` | A role select menu | [Definitions](/djs-bot/api/definitions/#native-select-menus) |
| `defineChannelSelect` | A channel select menu | [Definitions](/djs-bot/api/definitions/#native-select-menus) |
| `defineMentionableSelect` | A mentionable select menu | [Definitions](/djs-bot/api/definitions/#native-select-menus) |
| `defineModal` | A modal form | [Definitions](/djs-bot/api/definitions/#definemodal) |
| `defineService` | An injectable service | [Services](/djs-bot/api/services/) |
| `defineStore` | A `KVStore` registered as a service | [Store](/djs-bot/api/store/#definestore) |
| `defineJob` | A scheduled job | [Definitions](/djs-bot/api/definitions/#definejob) |
| `definePlugin` | A cross-cutting plugin | [Plugins](/djs-bot/api/plugins/) |
| `defineFeature` | A bundle of the above | [Definitions](/djs-bot/api/definitions/#definefeature) |

## Option, param & field schemas

| Export | What it is | Reference |
| --- | --- | --- |
| `s` | Slash-command option builders (`s.string`, `s.user`, …) | [Options & schemas](/djs-bot/api/options/#s--command-options) |
| `p` | customId parameter codecs (`p.string`, `p.number`, `p.boolean`) | [Options & schemas](/djs-bot/api/options/#p--customid-params) |
| `field` | Modal text inputs (`field.short`, `field.paragraph`) | [Options & schemas](/djs-bot/api/options/#field--modal-inputs) |
| `InferOptions`, `InferParams`, `InferFields` | Type helpers | [Options & schemas](/djs-bot/api/options/#type-helpers) |

## Guards

`guard`, `pass`, `fail`, `inGuild`, `dmOnly`, `hasPermission`, `botHasPermission`,
`inChannel`, `ownerOnly`, `cooldown` — see [Guards](/djs-bot/api/guards/).

## Runtime services

| Export | Module | Reference |
| --- | --- | --- |
| `memoryStore`, `sqliteStore`, `defineStore` | Persistence | [Store](/djs-bot/api/store/) |
| `createI18n` | Translations | [i18n](/djs-bot/api/i18n/) |
| `createFeatureFlags`, `featureEnabled` | Feature flags | [Flags](/djs-bot/api/flags/) |
| `createAuditLog`, `memoryAuditSink`, `storeAuditSink`, `loggerAuditSink` | Audit trail | [Audit](/djs-bot/api/audit/) |
| `Logger`, `createLogger` | Logging | [Logger](/djs-bot/api/logger/) |
| `startHealthServer` | Health & metrics | [Health](/djs-bot/api/health/) |
| `createRateLimiter`, `rateLimit`, `RateLimiter`, `createCircuitBreaker`, `CircuitBreaker`, `CircuitOpenError`, `retry`, `timeout` | Resilience | [Resilience](/djs-bot/api/resilience/) |
| `TTLCache`, `createCache`, `resolve` | Caching | [Cache](/djs-bot/api/cache/) |
| `Container` | Dependency injection | [Services](/djs-bot/api/services/#container) |

## Building messages

| Export | What it is | Reference |
| --- | --- | --- |
| `ui` | Rows, buttons and Components V2 builders | [UI & components](/djs-bot/api/ui/) |
| `paginate`, `confirm` | Self-managing interactive helpers | [UI & components](/djs-bot/api/ui/#paginate) |
| `encodeCustomId`, `decodeCustomId`, `customIdKey` | The customId codec | [UI & components](/djs-bot/api/ui/#the-customid-codec) |
| `mention`, `emoji`, `timestamp`, `allowedMentions`, `TimestampStyles` | Markup helpers | [Formatting](/djs-bot/api/formatting/) |
| `assets` | Avatar/banner/icon URLs | [Formatting](/djs-bot/api/formatting/#assets) |
| `voice` | Voice-state helpers | [Formatting](/djs-bot/api/formatting/#voice) |

## Deployment & introspection

`deployCommands`, `clearCommands`, `planDeployment`, `buildCommandTree`,
`commandToJSON`, `computeIntents`, `Registry`, `isShardChild`,
`normalizeSharding`, `launchShardManager` — see
[Deployment](/djs-bot/guide/ops/deploying-global-specific-guilds/) and
[Sharding](/djs-bot/guide/ops/sharding-scaling/).

## Errors & constants

`BotError`, `isBotError`, `ERROR_CATALOGUE`, `VERSION`, `FRAMEWORK_NAME`,
`CUSTOM_ID_MAX_LENGTH` — see [Errors](/djs-bot/api/errors/).

## Re-exported from discord.js

For convenience, so a simple bot needs only one import:

`ButtonStyle`, `TextInputStyle`, `ChannelType`, `PermissionFlagsBits`,
`GatewayIntentBits`, `MessageFlags`, `ActivityType`, `Colors`, `EmbedBuilder`,
`AttachmentBuilder`, `ActionRowBuilder`, `Collection`.

:::note
These are the *same objects* discord.js exports — importing them from
`@ix-xs/djs-bot` or from `discord.js` is interchangeable.
:::
