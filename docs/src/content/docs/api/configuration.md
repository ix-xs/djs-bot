---
title: "Configuration & environment"
description: "defineBot, every BotConfig field, the Bot instance, env() and env.optional()."
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
| `token` | `string` | `DISCORD_TOKEN` | The bot token from the Developer Portal. Missing → [`DJSBOT_E001`](/djs-bot/api/errors/#djsbot_e001). |
| `clientId` | `string` | `DISCORD_CLIENT_ID` | The application id. Required to deploy commands. Missing → [`DJSBOT_E002`](/djs-bot/api/errors/#djsbot_e002). |
| `owners` | `string[]` | `[]` | User ids treated as owners. Readable as `ctx.owners`, and used by `ownerOnly()` when it is called with no arguments. |

### Loading & gateway

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `features` | `string \| Registrable \| Registrable[]` (or an array of those) | - | Where definitions come from: a **directory** to auto-discover, and/or explicit definitions. Mix freely: `["./features", MyCommand]`. |
| `intents` | `"auto" \| GatewayIntentBits[]` | `"auto"` | `"auto"` derives the minimum intent set from the events, triggers and guards you registered. Pass an array to take control. |
| `partials` | `Partials[]` | derived | Extra partials, merged with the auto-derived ones. |
| `plugins` | `PluginDefinition[]` | `[]` | Cross-cutting plugins. See [Plugins](/djs-bot/api/plugins/). |
| `sharding` | `boolean \| "auto" \| ShardingOptions` | `false` | `true` or `"auto"` lets Discord decide the shard count. |

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
| `logger` | `{ level?: LogLevel; pretty?: boolean }` | See [Logger](/djs-bot/api/logger/). |
| `health` | `number \| HealthOptions` | A port number, or full options. See [Health](/djs-bot/api/health/). |
| `audit` | `{ sink?, sinks?, autoRecordCommands? }` | See [Audit](/djs-bot/api/audit/). |
| `onError` | `(error, ctx?) => unknown` | Global interaction error handler. Return any value to mark the error handled and suppress the default reply. |

### Data & features

| Field | Type | Description |
| --- | --- | --- |
| `store` | `KVStore` | Registered as the `store` service, so `ctx.services.store` works everywhere. See [Store](/djs-bot/api/store/). |
| `i18n` | `I18nOptions` | Enables `ctx.t(...)`. See [i18n](/djs-bot/api/i18n/). |
| `flags` | `FeatureFlagsOptions` | Registers the `flags` service and enables the `featureEnabled()` guard. See [Flags](/djs-bot/api/flags/). |

### A fully-loaded example

```ts title="src/index.ts"
import { defineBot, env, sqliteStore, loggerAuditSink, ActivityType } from "@ix-xs/djs-bot";
import { antiSpam, commandLogger } from "@ix-xs/djs-bot/plugins";

const store = sqliteStore("data/bot.sqlite");

export default defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env("DISCORD_CLIENT_ID"),
  owners: [env("OWNER_ID")],
  features: "./features",
  intents: "auto",

  plugins: [antiSpam({ max: 5, window: "10s" }), commandLogger()],

  store,
  flags: { store, defaults: { economy: true } },
  audit: { sinks: [loggerAuditSink()], autoRecordCommands: true },
  i18n: {
    defaultLocale: "en",
    resources: { en: { hello: "Hello!" }, fr: { hello: "Bonjour !" } },
  },

  logger: { level: "info" },
  health: 3000,
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
| `container` | `Container` | The DI container. See [Services](/djs-bot/api/services/#container). |
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
| `shutdown()` | `Promise<void>` | Drains jobs, tears down plugins, closes the client. |
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

const port = env.optional("PORT");
health: port ? Number(port) : undefined,
```

| | `env()` | `env.optional()` |
| --- | --- | --- |
| Variable missing | throws | `undefined` |
| Empty string | throws, or uses the fallback | `undefined` |
| Return type | `string` | `string \| undefined` |

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
