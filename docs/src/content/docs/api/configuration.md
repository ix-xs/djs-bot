---
title: "Configuration & environment"
description: "defineBot, every BotConfig field, the Bot instance, and the env helpers."
sidebar:
  order: 2
---

## `defineBot(config)`

Creates a [`Bot`](#the-bot-instance) from a plain configuration object. It does
**not** connect - call `.start()` (the CLI does that for you).

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env("DISCORD_CLIENT_ID"),
  features: "./features",
  intents: "auto",
});
```

Export it as the **default export** of your entry file: every CLI command
(`dev`, `start`, `deploy`, `doctor`, `explain`) imports that file and looks for it.

## `BotConfig`

Every field is optional. Fields with an env fallback can be omitted entirely.

### Identity

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `token` | `string` | `DISCORD_TOKEN` | The bot token from the Developer Portal. Missing → [`DJSBOT_E001`](/api/errors/#djsbot_e001). |
| `clientId` | `string` | `DISCORD_CLIENT_ID` | The application id. Required to deploy commands. Missing → [`DJSBOT_E002`](/api/errors/#djsbot_e002). |
| `owners` | `string[]` | `[]` | User ids treated as owners. Readable as `ctx.owners`, and used by `ownerOnly()` when it is called with no arguments. |

### Loading & gateway

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `features` | `string \| Registrable \| Registrable[]` (or an array of those) | - | Where definitions come from: a **directory** to auto-discover, and/or explicit definitions. Mix freely: `["./features", MyCommand]`. |
| `intents` | `"auto" \| GatewayIntentBits[] \| { add?, remove? }` | `"auto"` | See [Intents](#intents). |
| `partials` | `Partials[]` | derived | Extra partials, merged with the auto-derived ones. |
| `client` | `Omit<ClientOptions, "intents">` | `{}` | Anything else the discord.js `Client` accepts: `allowedMentions`, `sweepers`, `makeCache`, `rest`... |
| `plugins` | `PluginDefinition[]` | `[]` | Cross-cutting plugins. See [Plugins](/api/plugins/). |
| `sharding` | `boolean \| "auto" \| ShardingOptions` | `false` | `true` or `"auto"` lets Discord decide the shard count. |

### Intents

`"auto"` derives the minimum intent set from the events and triggers you
registered, and warns at startup when a privileged one is involved.

```ts
intents: "auto",                                                  // the default
intents: { add: [GatewayIntentBits.DirectMessages] },             // auto, plus DMs
intents: { remove: [GatewayIntentBits.MessageContent] },          // auto, minus a privileged one
intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers], // fully manual
```

The object form keeps the autopilot and adjusts its result: `add` for what it
cannot guess (it does not assume you want DMs), `remove` for what you can do
without (a `messageCreate` listener that only reacts to mentions does not need
the privileged `MessageContent`).

### Client options

`client` is passed straight to discord.js. Two settings are worth knowing:

```ts
client: {
  // Never let the bot ping @everyone by echoing user input.
  allowedMentions: { parse: ["users", "roles"], repliedUser: true },
  // Cap memory on a large bot: forget messages older than 30 minutes.
  sweepers: { messages: { interval: 3600, lifetime: 1800 } },
}
```

### Presence

| Field | Type | Description |
| --- | --- | --- |
| `presence` | `PresenceData` | The initial gateway presence. |
| `presenceRotation` | `{ interval: string \| number; items: PresenceData[] }` | Cycles through statuses. `interval` accepts a duration string (`"30s"`, `"5m"`) or milliseconds. |

```ts
presenceRotation: {
  interval: "30s",
  items: [
    { activities: [{ name: "/help", type: ActivityType.Listening }] },
    { activities: [{ name: "your server", type: ActivityType.Watching }] },
  ],
}
```

### Deployment

`deploy` is a `DeployConfig`:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `devGuildId` | `string` | `DISCORD_DEV_GUILD` | A guild that mirrors **all** commands during development, so they appear instantly instead of taking up to an hour to propagate globally. |
| `autoDeploy` | `boolean` | `true` in development | Deploy on startup. |

:::caution[Seeing every command twice?]
While `devGuildId` is set in development your commands exist **twice** in that
one guild: once as guild commands, once globally (if you also ran
`djs-bot deploy`). That is expected. Remove the mirror with
`npx djs-bot clear --guild <id>`.
:::

### Observability

| Field | Type | Description |
| --- | --- | --- |
| `logger` | `{ level?: LogLevel; pretty?: boolean }` | See [Logger](/api/logger/). |
| `health` | `number \| HealthOptions` | A port number, or full options. See [Health](/api/health/). |
| `audit` | `{ sink?, sinks?, autoRecordCommands? }` | See [Audit](/api/audit/). |
| `onError` | `(error, ctx?) => unknown` | Global error handler. `ctx` is set for an interaction error, and absent when an event listener, a trigger or a job threw. For an interaction, return any value to mark the error handled and suppress the default reply. |

### Behaviour

| Field | Type | Description |
| --- | --- | --- |
| `defaults.defer` | `DeferOption` | Acknowledge slow handlers automatically. `true` defers only when a handler has not answered after 2 s. Each definition can override it. See [automatic deferral](/api/context/#automatic-deferral). |
| `messages` | `FrameworkMessages` | Reword or translate what the framework itself says. See [Messages](#messages). |
| `theme` | `Partial<Theme>` | Colours of the semantic replies. See [Theme](#theme). |

### Messages

Every sentence the framework shows to a user - guard refusals, the generic
error, the confirm dialog buttons - is overridable. The defaults are English.

```ts
messages: {
  error: "Une erreur est survenue. L'équipe a été prévenue.",
  guildOnly: "Cette commande s'utilise sur un serveur.",
  missingPermissions: "Il te manque : {permissions}.",
  cooldown: "Patiente {seconds}s avant de recommencer.",
  confirm: "Confirmer",
  cancel: "Annuler",
}
```

A value is a template with `{placeholders}`, or a function for full control. The
function receives the variables and, when there is one, the `ctx` - so it can
translate per user:

```ts
messages: {
  cooldown: ({ seconds }, ctx) => ctx?.t("errors.cooldown", { seconds }) ?? `Wait ${seconds}s.`,
}
```

| Key | Placeholders | Shown when |
| --- | --- | --- |
| `error` | | A handler threw and nothing handled it. |
| `unknownCommand`, `unknownSubcommand` | `{name}` | A command reached the bot that is no longer registered. |
| `guardDenied` | | A guard failed without giving a reason. |
| `guildOnly`, `dmOnly` | | `inGuild()`, `dmOnly()`. |
| `missingPermissions`, `botMissingPermissions` | `{permissions}` | `hasPermission()`, `botHasPermission()`. |
| `missingRole` | | `hasRole()`. |
| `wrongChannel` | | `inChannel()`. |
| `ownerOnly`, `guildOwnerOnly` | | The owner guards. |
| `cooldown` | `{seconds}` | `cooldown()`. |
| `rateLimited` | `{seconds}` | `rateLimit()`. |
| `slowDown` | `{seconds}` | The `antiSpam` plugin. |
| `featureDisabled` | `{feature}` | `featureEnabled()`. |
| `confirm`, `cancel` | | The buttons of `confirm()`. |

`DEFAULT_MESSAGES` is exported if you want to read the built-in wording, and
`ctx.say(key, vars)` renders a message from your own code.

### Theme

```ts
theme: { success: 0x57f287, error: 0xed4245, info: 0x5865f2, warn: 0xfee75c }
```

| Key | Used by | Default |
| --- | --- | --- |
| `success` | `ctx.reply.success` | `0x22c55e` |
| `error` | `ctx.reply.error` | `0xef4444` |
| `info` | `ctx.reply.info` | `0x3b82f6` |
| `warn` | `ctx.reply.warn` | `0xf59e0b` |

### Data & features

| Field | Type | Description |
| --- | --- | --- |
| `store` | `KVStore` | Registered as the `store` service, so `ctx.services.store` works everywhere. See [Store](/api/store/). |
| `i18n` | `I18nOptions` | Enables `ctx.t(...)`. See [i18n](/api/i18n/). |
| `flags` | `FeatureFlagsOptions` | Registers the `flags` service and enables the `featureEnabled()` guard. See [Flags](/api/flags/). |

### A fully-loaded example

```ts title="src/index.ts"
import { defineBot, env, sqliteStore, loggerAuditSink, ActivityType } from "@ix-xs/djs-bot";
import { antiSpam, commandLogger } from "@ix-xs/djs-bot/plugins";

const store = sqliteStore("data/bot.sqlite");

export default defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env("DISCORD_CLIENT_ID"),
  owners: env.list("OWNER_IDS"),
  features: "./features",
  intents: "auto",
  defaults: { defer: true },
  client: { allowedMentions: { parse: ["users"], repliedUser: true } },

  plugins: [antiSpam({ max: 5, window: "10s" }), commandLogger()],

  store,
  flags: { store, defaults: { economy: true } },
  audit: { sinks: [loggerAuditSink()], autoRecordCommands: true },
  i18n: {
    defaultLocale: "en",
    resources: { en: { hello: "Hello!" }, fr: { hello: "Bonjour !" } },
  },

  logger: { level: "info" },
  health: env.number("PORT", 3000),
  presence: { activities: [{ name: "/help", type: ActivityType.Listening }] },
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },

  onError(error, ctx) {
    ctx?.logger.error({ err: error }, "unhandled interaction error");
  },
});
```

## The `Bot` instance

`defineBot()` returns a `Bot`. You rarely touch it directly - the CLI does - but
it is a normal object you can drive yourself.

### Properties

| Property | Type | Description |
| --- | --- | --- |
| `registry` | `Registry` | Every loaded definition, grouped by kind. |
| `container` | `Container` | The DI container. See [Services](/api/services/#container). |
| `logger` | `Logger` | The root logger. |
| `config` | `BotConfig` | The configuration you passed. |
| `client` | `Client<true>` | The connected discord.js client. **Throws** before `start()`. |
| `devGuildId` | `string \| undefined` | The resolved dev guild. |

### Methods

| Method | Returns | Description |
| --- | --- | --- |
| `use(...items)` | `this` | Registers extra definitions programmatically, on top of `config.features`. Chainable. |
| `load()` | `Promise<void>` | Discovers features, resolves services, validates contracts. Called by `start()`. |
| `start()` | `Promise<void>` | Loads, computes intents, logs in, deploys if configured, starts jobs and the health server. |
| `deploy(options?)` | `Promise<DeployResult>` | Diff-deploys commands. Options: `{ guildId?, dryRun? }`. |
| `clear(options?)` | `Promise<DeployTargetResult>` | Removes commands from a scope. Options: `{ guildId?, dryRun? }`. |
| `setPresence(presence)` | `void` | Updates the gateway presence at runtime. |
| `setActivity(name, options?)` | `void` | Shortcut for a single activity. |
| `shutdown()` | `Promise<void>` | Waits for running jobs, runs shutdown hooks, tears down plugins, disposes services, closes the store and the client. Safe to call twice. |
| `stats()` | `BotStats` | The runtime counters behind `/metrics`: interactions, commands, components, errors, guard rejections, handler latency. |
| `describe()` | `Promise<BotDescription>` | A structured snapshot - what `djs-bot explain` prints. |

```ts
import bot from "./index.js";

await bot.load();
console.dir(await bot.describe(), { depth: null });
```

### `isBot(value)`

A cross-realm type guard - it keeps working across duplicated copies of the
package, where `instanceof` would silently fail:

```ts
import { isBot } from "@ix-xs/djs-bot";
if (!isBot(mod.default)) throw new Error("entry file must default-export defineBot()");
```

## Environment helpers

### `env()`

```ts
function env(name: string, fallback?: string): string
```

Reads `process.env[name]`, falling back to a `.env` file. Returns `fallback` when
unset, and otherwise **throws a readable error** instead of handing you
`undefined` that explodes three layers deeper:

```
Missing required environment variable "DISCORD_TOKEN".
Add it to your environment or a .env file.
```

```ts
const token = env("DISCORD_TOKEN");            // required - throws if missing
const level = env("LOG_LEVEL", "info");        // optional with a default
```

An empty string counts as missing, so a stray `DISCORD_TOKEN=` in `.env` fails
loudly instead of quietly authenticating as nobody.

### `env.optional()`

```ts
env.optional(name: string): string | undefined
```

The same lookup, but returns `undefined` instead of throwing - for genuinely
optional configuration:

```ts
deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
```

### `env.number()`, `env.boolean()`, `env.list()`

Typed readers, so a typo in `.env` fails at startup instead of becoming `NaN`
somewhere later.

```ts
health: env.number("PORT", 3000),          // throws if PORT is set but not a number
const debug = env.boolean("DEBUG");        // true/1/yes/on, false/0/no/off, any case
owners: env.list("OWNER_IDS"),             // "1, 2,3" -> ["1", "2", "3"]
```

| | Returns | Variable missing | Value malformed |
| --- | --- | --- | --- |
| `env(name, fallback?)` | `string` | throws, or the fallback | - |
| `env.optional(name)` | `string \| undefined` | `undefined` | - |
| `env.number(name, fallback?)` | `number` | throws, or the fallback | throws |
| `env.boolean(name, fallback?)` | `boolean` | the fallback (default `false`) | throws |
| `env.list(name)` | `string[]` | `[]` | - |

An empty string counts as missing everywhere.

### `loadEnvFile()`

```ts
loadEnvFile(path = ".env"): void
```

Parses a `.env` file into `process.env` **without overwriting** variables that
are already set - so real environment variables always win over the file, which
is what you want in production. Handles `#` comments, blank lines and quoted
values. Safe to call when the file does not exist.

The CLI calls it for you; call it yourself only from a custom entry point.

:::danger[Never commit your token]
Keep `.env` in `.gitignore`. A leaked token lets anyone control your bot -
regenerate it immediately in the Developer Portal if that happens.
:::
