---
title: "Configuration"
description: "The entry file of a bot: defineBot and every option it accepts, the env helpers that read your secrets, and the Bot object you get back."
sidebar:
  order: 2
---

Everything about a bot is declared in one place: the object you pass to
`defineBot`. This page lists every field of that object. Most of them have their
own page, linked from the [reference table](#botconfig).

## A first entry file

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),                   // throws a clear error if missing
  clientId: env.optional("DISCORD_CLIENT_ID"),   // needed to deploy commands
  features: `${import.meta.dirname}/features`,   // folder of definitions, discovered for you
  defaults: { defer: true },                     // acknowledge slow handlers automatically
});

export default bot;

// Start only when run directly (the CLI imports this file for tooling).
if (!process.env.DJSBOT_CLI) void bot.start();
```

Three things matter in this file:

- `defineBot` creates the bot but does not connect. `bot.start()` does, and the
  entry file has to call it: `djs-bot dev` and `djs-bot start` run this file,
  they do not start the bot for you.
- The bot is the **default export**. `deploy`, `clear`, `doctor` and `explain`
  import the file and look for it there. A named export called `bot` is
  accepted too.
- The `DJSBOT_CLI` test skips `start()` when one of those commands imports the
  file to inspect it. They set `DJSBOT_CLI=introspect`, and in that mode
  `start()` would only load the definitions and return without connecting.

Every field is optional. `token`, `clientId` and `deploy.devGuildId` fall back
to the `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and `DISCORD_DEV_GUILD` environment
variables, so `defineBot({ features })` is already a working configuration.

## Environment variables

Secrets do not belong in the source code. The `env` helpers read them from the
environment and fail at startup, with a readable message, instead of handing you
an `undefined` that breaks three layers deeper:

```
Missing required environment variable "DISCORD_TOKEN". Add it to your environment or a .env file.
```

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),                           // required
  clientId: env.optional("DISCORD_CLIENT_ID"),           // string | undefined
  owners: env.list("OWNER_IDS"),                         // "1, 2,3" -> ["1", "2", "3"]
  health: env.number("PORT", 3000),                      // throws if PORT is not a number
  logger: { level: env.boolean("DEBUG") ? "debug" : "info" },
});
```

| Helper | Returns | Variable missing | Value malformed |
| --- | --- | --- | --- |
| `env(name, fallback?)` | `string` | throws, or the fallback | - |
| `env.optional(name)` | `string \| undefined` | `undefined` | - |
| `env.number(name, fallback?)` | `number` | throws, or the fallback | throws |
| `env.boolean(name, fallback?)` | `boolean` | the fallback (default `false`) | throws |
| `env.list(name)` | `string[]` | `[]` | - |

An empty value counts as missing everywhere, so a stray `DISCORD_TOKEN=` fails
loudly instead of quietly authenticating as nobody.

The helpers read `process.env`. A `.env` file gets there through
`loadEnvFile()`, which every `djs-bot` command calls before it runs or imports
your entry file. Variables that are already set are never overwritten, so the
real environment always wins over the file, which is what you want in
production.

:::note[Starting without the CLI]
If you run the entry file yourself (`node dist/index.js`), nothing reads `.env`
for you. Call `loadEnvFile()` at the top of the file, before the first `env()`.
:::

:::danger[Never commit your token]
Keep `.env` in `.gitignore`. A leaked token lets anyone control your bot:
regenerate it immediately in the Developer Portal if that happens.
:::

## Discord client options

The framework creates the discord.js `Client` for you. `client` is passed
straight to it, so anything discord.js accepts is available: `allowedMentions`,
`sweepers`, `makeCache`, `rest`... The one exception is `intents`, which is
computed from your events and set through the option of the same name.

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  owners: env.list("OWNER_IDS"),
  client: {
    // Never let the bot ping @everyone by echoing user input.
    allowedMentions: { parse: ["users", "roles"], repliedUser: true },
    // Cap memory on a large bot: forget messages older than 30 minutes.
    sweepers: { messages: { interval: 3600, lifetime: 1800 } },
  },
});
```

Two fields of `client` are combined with the dedicated options rather than
replaced: `client.partials` is merged with the partials the framework derives,
and `client.presence` is used only when `presence` is not set.

`owners` is the list of user ids that own the bot. It is read back as
`ctx.owners` in every handler, and it is what the `ownerOnly()` guard checks
when it is called without ids: see [Guards](/commands/guards/).

## A complete configuration

A bot that uses most of what the framework offers. Each block is one line of
configuration here and a full page elsewhere.

```ts title="src/index.ts"
import { ActivityType, defineBot, env, loggerAuditSink, sqliteStore } from "@ix-xs/djs-bot";
import { antiSpam, commandLogger } from "@ix-xs/djs-bot/plugins";

const store = sqliteStore("data/bot.sqlite");

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env("DISCORD_CLIENT_ID"),
  owners: env.list("OWNER_IDS"),
  features: `${import.meta.dirname}/features`,
  intents: "auto",
  defaults: { defer: true },
  client: { allowedMentions: { parse: ["users"], repliedUser: true } },

  plugins: [antiSpam({ max: 5, window: "10s" }), commandLogger()],

  store,
  flags: { store, defaults: { economy: true } },
  audit: { sinks: [loggerAuditSink()], autoRecordCommands: true },
  i18n: {
    defaultLocale: "en",
    resources: { en: { hello: "Hello" }, fr: { hello: "Bonjour" } },
  },
  messages: { cooldown: "Patiente {seconds}s." },
  theme: { success: 0x57f287 },

  logger: { level: "info", pretty: process.env.NODE_ENV !== "production" },
  health: env.number("PORT", 3000),
  presence: { activities: [{ name: "/help", type: ActivityType.Listening }] },
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },

  onError(error, ctx) {
    ctx?.logger.error({ err: error }, "unhandled interaction error");
  },
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

## Using the bot object

`defineBot()` returns a `Bot`. In a normal project you export it, start it, and
never touch it again. It is still a regular object you can drive yourself.

Load and inspect without connecting, which is what `djs-bot explain` does:

```ts
await bot.load();                                    // discover, validate, resolve services
const { commands, intents } = await bot.describe();  // a structured snapshot
```

Change the presence or read the counters while the bot runs:

```ts
bot.setActivity("/help", { type: ActivityType.Watching });
const { interactions, errors, handlerAvgMs } = bot.stats();
```

Load a bot from another script. `isBot` is a type guard that keeps working when
two copies of the package are loaded (the CLI and your code, CommonJS and ESM),
where `instanceof Bot` would silently fail:

```ts title="scripts/inspect.ts"
import { isBot } from "@ix-xs/djs-bot";

const mod = await import("../src/index.js");
if (!isBot(mod.default)) throw new Error("The entry file must default-export defineBot().");

await mod.default.load();
console.dir(await mod.default.describe(), { depth: null });
```

Importing the entry file runs it. Start such a script with
`DJSBOT_CLI=introspect` in the environment, so that the guard at the bottom of
the entry file does not connect the bot.

What `load()`, `start()` and `shutdown()` do, step by step, is described in
[Lifecycle](/basics/lifecycle/).

## Reference

### `defineBot(config)`

```ts
function defineBot(config: BotConfig): Bot
```

Creates a [`Bot`](#bot) from a plain configuration object. It reads nothing from
disk and does not connect.

### `BotConfig`

Every field is optional.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `token` | `string` | `DISCORD_TOKEN` | The bot token from the Developer Portal. |
| `clientId` | `string` | `DISCORD_CLIENT_ID` | The application id. Required by `bot.deploy()`, `bot.clear()` and the CLI commands of the same name. The automatic deploy at startup reads it from the connected application when it is not set. |
| `owners` | `string[]` | `[]` | Bot owner user ids, read back as `ctx.owners` and used by `ownerOnly()`. |
| `features` | `FeatureSource \| FeatureSource[]` | none | Where definitions come from: a directory to discover, explicit definitions, or both. See [Project layout](/basics/project-layout/). |
| `plugins` | `PluginDefinition[]` | `[]` | Cross-cutting plugins. See [Plugins and hooks](/architecture/plugins/). |
| `intents` | `"auto" \| GatewayIntentBits[] \| { add?, remove? }` | `"auto"` | Gateway intents: derived from your events and triggers, adjusted, or listed by hand. See [Events and intents](/events/events-and-intents/). |
| `partials` | `Partials[]` | derived | Extra partials, merged with the derived ones. See [Events and intents](/events/events-and-intents/). |
| `client` | `Omit<ClientOptions, "intents">` | `{}` | Extra options for the discord.js `Client`. See [Discord client options](#discord-client-options). |
| `defaults` | `{ defer?: DeferOption }` | `{}` | Behaviour applied to every definition that does not set its own. |
| `defaults.defer` | `DeferOption` | off | Acknowledge slow handlers for you. See [Automatic deferral](/basics/automatic-deferral/). |
| `messages` | `FrameworkMessages` | English | Reword or translate what the framework itself says. See [Wording and theme](/basics/wording-and-theme/). |
| `theme` | `Partial<Theme>` | built-in palette | Colours of the `ctx.reply.success/error/info/warn` embeds. See [Wording and theme](/basics/wording-and-theme/). |
| `deploy` | `{ devGuildId?: string; autoDeploy?: boolean }` | `DISCORD_DEV_GUILD`, auto outside production | Command deployment settings. See [Deploying commands](/production/deploying/). |
| `logger` | `{ level?: LogLevel; pretty?: boolean }` | `"info"`, pretty outside production | Logger settings. See [Logging](/production/logging/). |
| `presence` | `PresenceData` | none | The initial gateway presence. See [Presence](/production/presence/). |
| `presenceRotation` | `{ interval: string \| number; items: PresenceData[] }` | none | Cycle through several presences. See [Presence](/production/presence/). |
| `sharding` | `boolean \| "auto" \| ShardingOptions` | off | Run the bot across several shards. See [Sharding](/production/sharding/). |
| `health` | `number \| HealthOptions` | off | An HTTP health and metrics server: a port, or full options. See [Health and metrics](/production/health/). |
| `i18n` | `I18nOptions` | off | Translations for the messages the bot sends, read with `ctx.t`. See [Internationalisation](/data/i18n/). |
| `store` | `KVStore` | none | A key-value store, registered as the `store` service. See [Store](/data/store/). |
| `audit` | `{ sink?, sinks?, autoRecordCommands? }` | off | Enables `ctx.audit(...)` and the `audit` service. See [Audit trail](/data/audit/). |
| `flags` | `FeatureFlagsOptions` | off | Enables the `featureEnabled()` guard and the `flags` service. See [Feature flags](/data/flags/). |
| `onError` | `(error, ctx?) => unknown` | none | Global error handler. See [Errors](/api/errors/). |

### `Bot`

The object returned by `defineBot()`.

| Property | Type | Description |
| --- | --- | --- |
| `config` | `BotConfig` | The configuration you passed. |
| `logger` | `Logger` | The root logger. |
| `registry` | `Registry` | Every loaded definition, grouped by kind. |
| `container` | `Container` | The dependency injection container. See [Services](/architecture/services/). |
| `client` | `Client<true>` | The connected discord.js client. Reading it before `start()` throws. |
| `devGuildId` | `string \| undefined` | The development guild: `deploy.devGuildId`, or `DISCORD_DEV_GUILD`. |

| Method | Returns | Description |
| --- | --- | --- |
| `use(...items)` | `this` | Registers extra definitions, on top of `features`. Chainable. Call it before the bot loads. |
| `load()` | `Promise<void>` | Discovers and registers everything, without connecting. Runs once: later calls return immediately. |
| `start()` | `Promise<void>` | Loads if needed, then connects. Further calls do nothing. |
| `shutdown()` | `Promise<void>` | Stops everything gracefully. Safe to call more than once. |
| `describe()` | `Promise<BotDescription>` | Loads if needed, then returns a snapshot of what is registered. |
| `stats()` | `BotStats` | The runtime counters, the numbers behind `/metrics`. |
| `deploy(options?)` | `Promise<DeployResult>` | Compares the commands with Discord and pushes the difference. Options: `{ guildId?, dryRun? }`. See [Deploying commands](/production/deploying/). |
| `clear(options?)` | `Promise<DeployTargetResult>` | Removes every command from one guild, or from the global scope. Options: `{ guildId?, dryRun? }`. See [Deploying commands](/production/deploying/). |
| `setPresence(presence)` | `void` | Replaces the gateway presence at runtime. See [Presence](/production/presence/). |
| `setActivity(name, options?)` | `void` | Shortcut for one activity. Options: `{ type?, url?, status? }`. See [Presence](/production/presence/). |

### `BotDescription`

What `describe()` resolves to, and what `djs-bot explain --json` prints.

| Field | Type | Description |
| --- | --- | --- |
| `version` | `string` | The framework version. |
| `intents` | `string[]` | Gateway intents the client connects with, by name. |
| `partials` | `string[]` | Partials enabled on the client, by name. |
| `privilegedIntents` | `string[]` | The intents that must be switched on in the Developer Portal. |
| `commands` | `string[]` | Slash command names. |
| `userCommands` | `string[]` | User context-menu command names. |
| `messageCommands` | `string[]` | Message context-menu command names. |
| `buttons` | `string[]` | Button routing ids. |
| `selectMenus` | `string[]` | Select menu routing ids. |
| `modals` | `string[]` | Modal routing ids. |
| `events` | `string[]` | The event of each registered listener. |
| `triggers` | `string[]` | Message trigger names. |
| `jobs` | `string[]` | Scheduled jobs, as `name (schedule)`. |
| `services` | `string[]` | Service tokens registered in the container. |
| `plugins` | `string[]` | Plugins, as `name@version`. |
| `features` | `string[]` | Feature names. |
| `deployment` | `{ global: string[]; guilds: Record<string, string[]> }` | The command names deployed globally, and per guild id. |

### `BotStats`

What `stats()` returns. Counters start at zero when the process creates the bot.

| Field | Type | Description |
| --- | --- | --- |
| `uptimeMs` | `number` | Milliseconds since this process created the bot. |
| `interactions` | `number` | Interactions received, of every kind. |
| `commands` | `number` | Slash and context-menu commands routed to a handler. |
| `components` | `number` | Button and select-menu interactions routed to a handler. |
| `modals` | `number` | Modal submissions routed to a handler. |
| `autocompletes` | `number` | Autocomplete requests answered. |
| `guardRejections` | `number` | Interactions refused by a guard. |
| `errors` | `number` | Handlers, events, triggers and jobs that threw. |
| `handlerAvgMs` | `number` | Average handler duration, in milliseconds. |
| `handlerMaxMs` | `number` | Slowest handler seen, in milliseconds. |

### `isBot(value)`

```ts
function isBot(value: unknown): value is Bot
```

Returns `true` for a `Bot`, including one created by another copy of the
package. Use it instead of `instanceof Bot`.

### `env(name, fallback?)`

```ts
function env(name: string, fallback?: string): string
```

Reads `process.env[name]`. The variants are properties of the same function:

| Call | Returns | Notes |
| --- | --- | --- |
| `env(name, fallback?)` | `string` | Throws when the variable is missing and there is no fallback. |
| `env.optional(name)` | `string \| undefined` | Never throws. For optional settings such as `DISCORD_DEV_GUILD`. |
| `env.number(name, fallback?)` | `number` | Throws when missing without a fallback, and when the value is not a number. |
| `env.boolean(name, fallback?)` | `boolean` | Accepts `true`, `1`, `yes`, `on` and `false`, `0`, `no`, `off`, in any case. Anything else throws. Missing gives `fallback`, `false` by default. |
| `env.list(name)` | `string[]` | Splits on commas, trims each entry and drops the empty ones. Missing gives `[]`. |

### `loadEnvFile(path?)`

```ts
function loadEnvFile(path?: string): void
```

Parses a `.env` file into `process.env`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `path` | `string` | `".env"` | The file to read. The default is `.env` in the working directory. |

- Variables that already exist are left untouched.
- Blank lines and lines starting with `#` are ignored. So are lines without `=`.
- A value wrapped in single or double quotes loses its quotes.
- A missing file is not an error: the call does nothing.

The CLI calls it for you. Call it yourself only from an entry point you start
without the CLI.

## Limits and errors

| Situation | Result |
| --- | --- |
| No `token` and no `DISCORD_TOKEN` when the bot starts, deploys or clears | [`DJSBOT_E001`](/api/errors/#djsbot_e001) |
| No `clientId` and no `DISCORD_CLIENT_ID` on `bot.deploy()` or `bot.clear()` | [`DJSBOT_E002`](/api/errors/#djsbot_e002) |
| `env("NAME")` with no value and no fallback | `Missing required environment variable "NAME". Add it to your environment or a .env file.` |
| `env.number("PORT")` with `PORT=abc` | `Environment variable "PORT" must be a number, got "abc".` |
| `env.boolean("DEBUG")` with `DEBUG=maybe` | `Environment variable "DEBUG" must be a boolean, got "maybe".` |
| `bot.client` read before `start()` | `Bot has not started yet - call bot.start() first.` |

The `env` errors are thrown while the entry file is evaluated, so a typo in
`.env` stops the process before anything connects.

## See also

- [Project layout](/basics/project-layout/): what the `features` folder contains and how it is discovered.
- [Lifecycle](/basics/lifecycle/): what happens between `start()` and `shutdown()`.
- [Automatic deferral](/basics/automatic-deferral/): the `defaults.defer` option.
- [Deploying commands](/production/deploying/): the `deploy` option, `bot.deploy()` and `bot.clear()`.
- [CLI](/api/cli/): the commands that import this file.
