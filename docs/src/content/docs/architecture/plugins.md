---
title: "Plugins and hooks"
description: "A plugin adds behaviour that applies to every interaction, or a resource shared by the whole bot: rate limiting, logging, error reporting, maintenance mode, a database connection. Use the four official plugins, or write your own with definePlugin."
sidebar:
  order: 2
---

A plugin never patches the framework. It receives a small `app` object and uses
it to register hooks (functions the framework calls at fixed moments) and
services. Everything it does is therefore visible in one `setup` function.

## Use an official plugin

Four plugins ship with the framework, on the `@ix-xs/djs-bot/plugins` subpath:
`antiSpam`, `commandLogger`, `errorReporter` and `maintenance`. Each is a
function that takes options and returns a plugin, which you list in `plugins`.

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";
import { antiSpam, commandLogger, errorReporter } from "@ix-xs/djs-bot/plugins";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  plugins: [
    antiSpam({ max: 5, window: "10s", allow: env.list("OWNER_IDS") }),
    commandLogger(),
    errorReporter({ report: (error, ctx) => console.error(ctx?.correlationId, error) }),
  ],
});

export default bot;

if (!process.env.DJSBOT_CLI) void bot.start();
```

Plugins run in the order you list them, and the first one wraps the next. Here
`antiSpam` comes first, so an interaction it rejects never reaches
`commandLogger` and is not logged. Swap them to log rejected interactions too.

The options of the four plugins are in the [reference](#reference). Each one is
short enough to read in a minute and is a worked example of the plugin API.

## Write a plugin

```ts title="src/plugins/request-timer.ts"
import { definePlugin, describeInteraction } from "@ix-xs/djs-bot";

export const requestTimer = definePlugin({
  name: "request-timer",
  version: "1.0.0",
  setup(app) {
    app.hooks.beforeInteraction(async (ctx, next) => {
      const started = performance.now();
      await next(); // the guards, then the handler
      const { kind, name } = describeInteraction(ctx.interaction);
      ctx.logger.info({ kind, name, ms: Math.round(performance.now() - started) }, "handled");
    });

    app.hooks.onReady((client) => {
      app.logger.info({ guilds: client.guilds.cache.size }, "request timer active");
    });
  },
});
```

`setup` runs once at startup, before the bot connects. It receives `app`:

- `app.hooks` registers middleware and lifecycle hooks;
- `app.services` registers a value in the [service](/architecture/services/)
  container;
- `app.config` is the configuration passed to `defineBot`, read-only (for
  example `app.config.owners`);
- `app.logger` is a logger tagged with the plugin name.

A plugin can reach the bot in three ways: in the `plugins` array of `defineBot`,
exported from a file whose name ends with `.plugin` inside your features folder,
or listed in the `plugins` of a [feature](/architecture/features/). Plugins that
come from features and discovered files are set up first, then the `plugins`
array, in order.

### Plugin, guard or feature

| Use | When |
| --- | --- |
| A [guard](/commands/guards/) | A rule for some commands: permissions, cooldowns, premium checks. |
| A plugin | Behaviour for every interaction, or a shared resource: logging, rate limits, a database. |
| A [feature](/architecture/features/) | A bundle of commands, events and services shipped as one unit. |

## Middleware

`beforeInteraction` registers a middleware: a function that wraps the handling
of an interaction. It receives the `ctx` and a `next` function. Call
`await next()` to continue, or do not call it to stop the interaction there.

```ts
app.hooks.beforeInteraction(async (ctx, next) => {
  if (blocked.has(ctx.user.id)) {
    await ctx.reply.error("You cannot use this bot.");
    return; // stop here: no guard, no handler
  }
  const started = performance.now();
  await next(); // the guards, then the handler
  metrics.observe(performance.now() - started);
});
```

Middleware wraps the guards as well as the handler. It therefore runs before
everything else, which is what a maintenance mode needs, and it sees the whole
duration, which is what timing and metrics need. The code before `await next()`
is your "before" logic, the code after it your "after" logic: timing,
transactions, tracing.

- Several middlewares nest in the order their plugins were set up.
- Middleware runs for slash commands, context menus, buttons, select menus and
  modal submissions. Autocomplete requests, events, triggers and jobs do not go
  through it.
- `ctx` is the base context shared by every interaction. It has no
  `ctx.options`. Use `describeInteraction(ctx.interaction)` to know what is
  being handled (see [The ctx object](/basics/context/)).
- If you stop an interaction, answer the user yourself, otherwise they see a
  failed interaction.
- `next()` can be called once. A second call throws.
- A middleware that throws is handled like a handler that throws: the error
  boundary logs it and answers the user.

## Lifecycle hooks

The other hooks do not wrap anything. They are called at one moment each.

```ts
setup(app) {
  app.hooks.afterInteraction((ctx, { durationMs }) => {
    if (durationMs > 2000) ctx.logger.warn({ durationMs }, "slow interaction");
  });

  app.hooks.onError((error, ctx) => {
    // ctx is set for an interaction, absent for an event, a trigger or a job
    reporter.send(error, { user: ctx?.user.id });
  });

  app.hooks.onReady((client) => {
    app.logger.info({ tag: client.user.tag }, "ready");
  });

  app.hooks.onShutdown(async () => {
    await reporter.flush();
  });
}
```

| Hook | Called |
| --- | --- |
| `afterInteraction` | After a handler completed without throwing. Not called when a guard refused, when a middleware stopped the interaction, or when the handler threw. |
| `onError` | Whenever something the framework runs throws: an interaction handler (`ctx` is set), an event listener, a trigger or a job (`ctx` is absent). |
| `onReady` | Once, when the client is ready. The hooks are awaited one after the other, before the scheduled jobs start. |
| `onShutdown` | During graceful shutdown, once the running jobs have stopped and before plugins are torn down and services disposed. |

A hook that throws never takes the bot down. A failing `afterInteraction`,
`onReady` or `onShutdown` hook is logged and the next ones still run. A failing
`afterInteraction` hook does not change what the user sees either, because the
handler has already answered. An error thrown inside an `onError` hook is
ignored.

`onError` hooks run before the `onError` of `defineBot`. How errors are caught
and answered is described on the [Errors](/api/errors/) page, and the full
startup and shutdown order on the [Lifecycle](/basics/lifecycle/) page.

## Share a resource

A plugin can open a resource in `setup`, register it as a service and close it
in `teardown`.

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
      app.logger.info({}, "postgres connected");
    },
    teardown: () => pool.end(),
  });
}
```

```ts
plugins: [postgres(env("DATABASE_URL"))],
```

Every handler can now read `ctx.services.db`, a `defineService` can list `"db"`
in its `deps`, and a feature can declare `requires: ["db"]`. Declare the type of
the token once, as shown in
[Type your services](/architecture/services/#type-your-services).

`provides` matters here: it is what tells the startup check that `"db"` will
exist. The rules are under
[Capability contracts](/architecture/services/#capability-contracts).

:::tip[Service or plugin]
For a plain shared resource with nothing cross-cutting about it, a
[`defineService`](/architecture/services/) with a `dispose` function is shorter.
Reach for a plugin when you also need hooks.
:::

## Publish a plugin

A plugin is a plain object, so a published plugin is an ordinary npm package.

```ts title="index.ts"
import { definePlugin, type PluginDefinition } from "@ix-xs/djs-bot";

export interface MyPluginOptions {
  apiKey: string;
}

export function myPlugin(options: MyPluginOptions): PluginDefinition {
  return definePlugin({
    name: "my-plugin",
    version: "1.0.0",
    setup(app) {
      app.logger.info({ keyLength: options.apiKey.length }, "my-plugin loaded");
    },
  });
}
```

Guidelines that keep a third-party plugin pleasant to use:

- Export a factory function that takes options, not a plugin built in advance.
- Keep `@ix-xs/djs-bot` in `peerDependencies`, never in `dependencies`.
- Declare `provides` when you register a service, so that consumers can list it
  in `requires`.
- Clean up in `teardown`: sockets, timers, pools.
- Never let your own error handling throw.

If the package also needs commands and events, not only hooks, ship a
[feature](/architecture/features/) instead, or a feature that bundles the
plugin.

## Reference

Every option, property and type, with what it accepts and returns, is in the API reference:

- `definePlugin()`: Defines a cross-cutting plugin (hooks, middleware, capabilities).
- `PluginDefinition`: A cross-cutting plugin.
- `PluginApp`: The restricted façade handed to plugins in `setup()`.
- `Logger`: Structured logger with level filtering and child bindings.
- `HookRegistrar`: Lets plugins register hooks without touching the core.
- `defineBot()`: Creates a `Bot`.
- `MiddlewareFn`: Middleware runs around every interaction; call `next()` to continue.
- `antiSpam()`: Rejects the interactions of a user who exceeds a per-window rate limit: commands, components and forms.
- `commandLogger()`: Logs a structured line for every interaction (with duration), using the per-interaction correlation logger.
- `errorReporter()`: Forwards every unhandled interaction error to your reporter (e.g. Sentry).
- `maintenance()`: Blocks all interactions with a maintenance notice, except for allow-listed users.

## See also

- [Services](/architecture/services/): the container a plugin registers into, and capability contracts.
- [Features](/architecture/features/): ship commands and events together with a plugin.
- [Guards](/commands/guards/): rules for some commands instead of all of them.
- [Errors](/api/errors/): the error boundary that `onError` hooks plug into.
- [Resilience](/production/resilience/): the rate limiter that `antiSpam` is built on.
