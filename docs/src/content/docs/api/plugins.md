---
title: "Plugins, hooks & middleware"
description: "The official plugins, every lifecycle hook, and how to write and publish your own."
sidebar:
  order: 8
---

A plugin is cross-cutting behaviour that is not tied to one command: rate
limiting, logging, error reporting, maintenance mode, metrics, a database
connection shared by everything.

```ts title="src/index.ts"
import { defineBot } from "@ix-xs/djs-bot";
import { antiSpam, commandLogger, errorReporter } from "@ix-xs/djs-bot/plugins";

export default defineBot({
  plugins: [antiSpam({ max: 5, window: "10s" }), commandLogger()],
});
```

Plugins run **in the order you list them**, so put a rate limiter before an
expensive logger.

## Official plugins

They live on the `@ix-xs/djs-bot/plugins` subpath. Each is small enough to read
in a minute and doubles as a worked example of the plugin API.

### `antiSpam(options?)`

Rejects interactions from users who exceed a per-window rate limit - a blanket
guard against interaction spam, applied to every interaction.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `max` | `number` | `5` | Interactions allowed per window, per user. |
| `window` | `number \| string` | `"10s"` | Window length, ms or a duration. |
| `message` | `string` | the `slowDown` [message](/api/configuration/#messages) | Shown to a limited user. |
| `allow` | `string[]` | `[]` | User ids that are never limited (owners, staff). |

```ts
antiSpam({ max: 10, window: "30s", allow: env.list("OWNER_IDS") })
```

### `commandLogger(options?)`

Logs one structured line per interaction, through the correlation-scoped logger,
so every line can be tied back to a single interaction.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `timing` | `boolean` | `true` | Also log the duration in ms (guards included). |

```
14:22:07 INFO  interaction handled correlationId=8f3a kind=command name="config set" guildId=123 ms=143
```

### `errorReporter(options)`

Forwards every unhandled interaction error to your reporter - Sentry, a webhook,
whatever you use. It runs **alongside** the framework error boundary, so the
user still gets a friendly reply.

| Option | Type | Description |
| --- | --- | --- |
| `report` | `(error, ctx?) => void \| Promise<void>` | **Required.** Where to send it. |

```ts
errorReporter({
  report: (error, ctx) => Sentry.captureException(error, {
    tags: { command: ctx?.interaction.type, guild: ctx?.guildId },
  }),
})
```

A throwing reporter is swallowed - reporting must never take the bot down.

### `maintenance(options?)`

Blocks every interaction with a notice, except for allow-listed users.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean \| (() => boolean)` | `true` | Pass a **function** to toggle it live without a restart. |
| `message` | `string` | "🔧 The bot is under maintenance…" | Shown to blocked users. |
| `allow` | `string[]` | `[]` | Ids that can keep using the bot. |

```ts
let down = false;
plugins: [maintenance({ enabled: () => down, allow: ownerIds })]
```

## Writing your own

```ts
definePlugin({
  name: string,
  version?: string,
  requires?: string[],
  provides?: string[],
  conflicts?: string[],
  setup: (app: PluginApp) => unknown | Promise<unknown>,
  teardown?: (app: PluginApp) => unknown | Promise<unknown>,
})
```

| Field | Description |
| --- | --- |
| `name` | Unique plugin name, shown in logs and `djs-bot explain`. |
| `version` | Informational. |
| `requires` | Capabilities that must exist, else [`DJSBOT_E040`](/api/errors/#djsbot_e040) at boot. |
| `provides` | Capabilities this plugin offers to others. |
| `conflicts` | Capabilities it refuses to coexist with → [`DJSBOT_E041`](/api/errors/#djsbot_e041). |
| `setup` | Runs once at boot. Register hooks and services here. |
| `teardown` | Runs during graceful shutdown. Close connections here. |

### `PluginApp`

The restricted façade handed to `setup` and `teardown`:

| Member | Type | Description |
| --- | --- | --- |
| `app.logger` | `Logger` | A logger tagged with the plugin name. |
| `app.hooks` | `HookRegistrar` | The lifecycle hooks below. |
| `app.config` | `Readonly<BotConfig>` | The configuration passed to `defineBot()`, read-only. |
| `app.services.register(token, value)` | `void` | Registers a built value in the container. |
| `app.services.has(token)` | `boolean` | Whether a token already exists. |

### Hooks

| Hook | Signature | When it runs |
| --- | --- | --- |
| `beforeInteraction(fn)` | `(ctx, next) => unknown` | Around **every** interaction: before the guards and the handler. Middleware - see below. |
| `afterInteraction(fn)` | `(ctx, { durationMs }) => unknown` | After a handler completes successfully. Not called when a guard refused or a middleware stopped the interaction. |
| `onError(fn)` | `(error, ctx?) => unknown` | Whenever something the framework runs throws: an interaction handler (`ctx` is set), an event listener, a trigger or a job (`ctx` is absent). |
| `onReady(fn)` | `(client) => unknown` | Once the gateway connection is ready. |
| `onShutdown(fn)` | `() => unknown` | During graceful shutdown. |

### Middleware

`beforeInteraction` is real middleware: call `next()` to continue, or **do not**
call it to stop the interaction there. It wraps the guards as well as the
handler, so it runs first and sees the whole duration.

```ts
app.hooks.beforeInteraction(async (ctx, next) => {
  if (isBanned(ctx.user.id)) {
    await ctx.reply.error("You are banned from using this bot.");
    return;                       // short-circuit: no guard, no handler
  }
  const started = performance.now();
  await next();                   // guards, then the handler
  const { kind, name } = describeInteraction(ctx.interaction);
  metrics.observe(kind, name, performance.now() - started);
});
```

Everything around `await next()` is your before/after logic - timing, metrics,
transactions, tracing. Several middlewares nest in the order their plugins are
listed.

### A complete example

```ts title="src/plugins/postgres.ts"
import { definePlugin } from "@ix-xs/djs-bot";
import { Pool } from "pg";

export function postgres(url: string) {
  const pool = new Pool({ connectionString: url });

  return definePlugin({
    name: "postgres",
    version: "1.0.0",
    provides: ["db"],
    async setup(app) {
      await pool.query("select 1");
      app.services.register("db", pool);
      app.logger.info("postgres connected");
    },
    teardown: () => pool.end(),
  });
}
```

```ts
plugins: [postgres(env("DATABASE_URL"))],
```

Any feature can now declare `requires: ["db"]` and use `ctx.services.db`.

:::tip
For a plain shared resource with nothing cross-cutting about it, a
[`defineService`](/api/services/) with a `dispose` hook is shorter. Reach for a
plugin when you also need hooks.
:::

## Publishing a plugin

A plugin is a plain object, so a published plugin is an ordinary npm package:

```ts title="index.ts"
import { definePlugin, type PluginDefinition } from "@ix-xs/djs-bot";

export interface MyPluginOptions { apiKey: string }

export function myPlugin(options: MyPluginOptions): PluginDefinition {
  return definePlugin({ name: "my-plugin", setup(app) { /* … */ } });
}
```

Guidelines that keep third-party plugins pleasant to use:

- Export a **factory function** taking options, not a pre-built plugin.
- Keep `@ix-xs/djs-bot` a `peerDependency`, never a `dependency`.
- Declare `provides` when you register a service, so consumers can `requires` it.
- Clean up in `teardown` - sockets, timers, pools.
- Never let your own error handling throw.

Need commands and events too, not just hooks? Ship a
[`defineFeature`](/api/definitions/#definefeature) instead - or both,
with the feature bundling the plugin.

## Plugins vs guards vs features

| Use | When |
| --- | --- |
| **Guard** | A rule for *some* commands: permissions, cooldowns, premium checks. |
| **Plugin** | Behaviour for *every* interaction, or a shared resource: logging, rate limits, a database. |
| **Feature** | A bundle of commands/events/services shipped as one unit. |
