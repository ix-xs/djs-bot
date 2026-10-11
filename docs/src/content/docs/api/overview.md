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

There is no default export, no side-effectful import and no global state - every
symbol below is a plain function, class or type.

## Entry points

| Export | Kind | What it does | Reference |
| --- | --- | --- | --- |
| `defineBot(config)` | function | Creates and configures the bot | [Configuration](/api/configuration/) |
| `Bot` | class | The bot instance (`load`, `start`, `deploy`, `clear`, `shutdown`, `describe`) | [Configuration](/api/configuration/#the-bot-instance) |
| `isBot(value)` | guard | Cross-realm check that a value is a `Bot` | [Configuration](/api/configuration/#the-bot-instance) |
| `env(name, fallback?)` | function | Required env var, throws a clear error when missing | [Configuration](/api/configuration/#env) |
| `env.optional(name)` | function | Same, but returns `undefined` | [Configuration](/api/configuration/#envoptional) |
| `env.number`, `env.boolean`, `env.list` | functions | Typed readers that fail on a malformed value | [Configuration](/api/configuration/#envnumber-envboolean-envlist) |
| `loadEnvFile(path?)` | function | Loads a `.env` file into `process.env` | [Configuration](/api/configuration/#loadenvfile) |

## Authoring definitions

| Export | Creates | Reference |
| --- | --- | --- |
| `defineCommand` | A slash command | [Definitions](/api/definitions/#definecommand) |
| `subcommand` | One leaf of a subcommand tree | [Definitions](/api/definitions/#subcommand) |
| `defineUserCommand` | A user context-menu command | [Definitions](/api/definitions/#defineusercommand) |
| `defineMessageCommand` | A message context-menu command | [Definitions](/api/definitions/#definemessagecommand) |
| `defineEvent` | A gateway event listener | [Definitions](/api/definitions/#defineevent) |
| `defineTrigger` | A message auto-responder | [Definitions](/api/definitions/#definetrigger) |
| `defineButton` | A routed button | [Definitions](/api/definitions/#definebutton) |
| `defineSelectMenu` | A string select menu | [Definitions](/api/definitions/#defineselectmenu) |
| `defineUserSelect` | A user select menu | [Definitions](/api/definitions/#native-select-menus) |
| `defineRoleSelect` | A role select menu | [Definitions](/api/definitions/#native-select-menus) |
| `defineChannelSelect` | A channel select menu | [Definitions](/api/definitions/#native-select-menus) |
| `defineMentionableSelect` | A mentionable select menu | [Definitions](/api/definitions/#native-select-menus) |
| `defineModal` | A modal form | [Definitions](/api/definitions/#definemodal) |
| `defineService` | An injectable service | [Services](/api/services/) |
| `defineStore` | A `KVStore` registered as a service | [Store](/api/store/#definestore) |
| `defineJob` | A scheduled job | [Definitions](/api/definitions/#definejob) |
| `definePlugin` | A cross-cutting plugin | [Plugins](/api/plugins/) |
| `defineFeature` | A bundle of the above | [Definitions](/api/definitions/#definefeature) |

## Option, param & field schemas

| Export | What it is | Reference |
| --- | --- | --- |
| `s` | Slash-command option builders (`s.string`, `s.user`, …) | [Options & schemas](/api/options/#s---command-options) |
| `p`, `oneOf` | customId parameter codecs (`p.string`, `p.number`, `p.boolean`, `p.oneOf`) | [Options & schemas](/api/options/#p---customid-params) |
| `field` | Modal components: text, selects, pickers, uploads, radio, checkboxes | [Options & schemas](/api/options/#field---modal-components) |
| `InferOptions`, `InferParams`, `InferFields` | Type helpers | [Options & schemas](/api/options/#type-helpers) |

## Guards

`guard`, `pass`, `fail`, `inGuild`, `dmOnly`, `hasPermission`, `botHasPermission`,
`hasRole`, `inChannel`, `ownerOnly`, `guildOwnerOnly`, `cooldown`, and the
combinators `anyOf` and `not` - see [Guards](/api/guards/).

## Contexts

`describeInteraction` plus the types `BaseContext`, `CommandContext`,
`ButtonContext`, `SelectMenuContext`, `ModalContext`, `UserCommandContext`,
`MessageCommandContext`, `AutocompleteContext`, `DeferOption`, `ShowModalFn`,
`ReplyFn`, `UpdateFn` - see [The ctx object](/api/context/).

## Wording and theme

`DEFAULT_MESSAGES`, `DEFAULT_THEME` and the types `FrameworkMessages`,
`MessageKey`, `MessageVars`, `MessageValue`, `Theme` - see
[Messages](/api/configuration/#messages).

## Runtime services

| Export | Module | Reference |
| --- | --- | --- |
| `memoryStore`, `sqliteStore`, `createStore`, `defineStore` | Persistence | [Store](/api/store/) |
| `createI18n` | Translations | [i18n](/api/i18n/) |
| `createFeatureFlags`, `featureEnabled` | Feature flags | [Flags](/api/flags/) |
| `createAuditLog`, `memoryAuditSink`, `storeAuditSink`, `loggerAuditSink` | Audit trail | [Audit](/api/audit/) |
| `Logger`, `createLogger` | Logging | [Logger](/api/logger/) |
| `startHealthServer`, `toPrometheus` | Health & metrics | [Health](/api/health/) |
| `parseSchedule` | Job schedules | [Definitions](/api/definitions/#schedule-syntax) |
| `createRateLimiter`, `rateLimit`, `RateLimiter`, `createCircuitBreaker`, `CircuitBreaker`, `CircuitOpenError`, `retry`, `timeout` | Resilience | [Resilience](/api/resilience/) |
| `TTLCache`, `createCache`, `resolve` | Caching | [Cache](/api/cache/) |
| `Container` | Dependency injection | [Services](/api/services/#container) |

## Building messages

| Export | What it is | Reference |
| --- | --- | --- |
| `ui` | Rows, buttons and Components V2 builders | [UI & components](/api/ui/) |
| `ui.poll`, `ui.premiumButton` | Native polls and premium buttons | [UI & components](/api/ui/#polls) |
| `paginate`, `confirm` | Self-managing interactive helpers | [UI & components](/api/ui/#paginate) |
| `encodeCustomId`, `decodeCustomId`, `customIdKey` | The customId codec | [UI & components](/api/ui/#the-customid-codec) |
| `mention`, `emoji`, `timestamp`, `allowedMentions`, `TimestampStyles` | Markup helpers | [Formatting](/api/formatting/) |
| `assets` | Avatar/banner/icon URLs | [Formatting](/api/formatting/#assets) |
| `voice` | Voice-state helpers | [Formatting](/api/formatting/#voice) |

## Deployment & introspection

`deployCommands`, `clearCommands`, `planDeployment`, `buildCommandTree`,
`commandToJSON`, `commandsEqual`, `computeIntents`, `Registry`, `isShardChild`,
`normalizeSharding`, `launchShardManager` - see
[Deployment](/guide/ops/deploying-global-specific-guilds/) and
[Sharding](/guide/ops/sharding-scaling/).

## Errors & constants

`BotError`, `isBotError`, `ERROR_CATALOGUE`, `VERSION`, `FRAMEWORK_NAME`,
`CUSTOM_ID_MAX_LENGTH`, `DOCS_URL` - see [Errors](/api/errors/).

## Re-exported from discord.js

For convenience, so a simple bot needs only one import:

`ButtonStyle`, `TextInputStyle`, `ChannelType`, `PermissionFlagsBits`,
`GatewayIntentBits`, `Partials`, `Events`, `MessageFlags`, `ActivityType`, `Colors`, `EmbedBuilder`,
`AttachmentBuilder`, `ActionRowBuilder`, `Collection`.

:::note
These are the *same objects* discord.js exports - importing them from
`@ix-xs/djs-bot` or from `discord.js` is interchangeable.
:::
