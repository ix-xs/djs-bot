---
title: "Lifecycle"
description: "What happens between bot.start() and the moment the process exits: loading, validation, connection, the ready phase and a graceful shutdown, in a fixed order."
sidebar:
  order: 5
---

`bot.start()` always runs the same phases in the same order. Knowing them tells
you where a startup error comes from, where to put code that must run once, and
what is cleaned up when the process stops.

## Startup at a glance

```
defineBot(config)      creates the bot, nothing else
bot.start()
  load                 discover -> register -> validate -> plugin setup
                       -> resolve services -> compute intents
  connect              create the client, attach listeners, log in
  ready                onReady hooks, jobs, presence rotation, health server, auto-deploy
  [running]            interactions, events, triggers, jobs
SIGINT / SIGTERM
  shutdown             jobs, hooks, plugins, services, store, client
```

Everything in `load` happens before the bot connects. A configuration mistake
(a missing service, a duplicate command name, a file that does not import)
stops the process there, with a coded error, instead of surfacing later in
front of users.

## Loading

`bot.load()` does all the work that needs no connection. `start()` calls it for
you. It runs once: later calls return immediately, and concurrent callers share
the same load.

1. **Discover.** The definitions given to `bot.use()` are collected, then each
   entry of `features`. Directories go through the loader: see
   [Project layout](/basics/project-layout/).
2. **Register.** Every definition is added to the registry, then the `plugins`
   of the configuration. Two different commands with the same name, or two
   components with the same id, stop the bot here.
3. **Register services.** Service definitions enter the container, followed by
   the ones the configuration provides: `store`, `audit` and `flags`.
4. **Validate.** Every capability a feature or a plugin lists in `requires`
   must be provided by a service, a feature or a plugin. Nothing may provide a
   capability that a plugin lists in `conflicts`.
5. **Set up plugins.** Each plugin's `setup` runs, one after the other, in
   registration order. This is where hooks and middleware are registered.
6. **Resolve services.** Every service is built, its dependencies first.
7. **Compute intents.** The gateway intents and partials are derived from your
   events and triggers. A warning is logged when a privileged intent is
   involved, because it also has to be enabled in the Developer Portal.

Because loading needs no token and no network, you can inspect the result
without connecting:

```bash
npx djs-bot explain    # commands, intents, triggers, jobs, services, plugins...
npx djs-bot doctor     # token, privileged intents, permissions
```

Both import your entry file with `DJSBOT_CLI=introspect`. In that mode
`start()` loads and returns without connecting. From your own code, the
equivalent is `await bot.load()` followed by `await bot.describe()`: see
[Configuration](/basics/configuration/#using-the-bot-object).

## Connecting and ready

After loading, `start()`:

1. Resolves the token (`token`, then `DISCORD_TOKEN`).
2. Hands over to the shard manager when `sharding` is enabled and this process
   is not a shard itself. The manager spawns the shards, and each shard runs
   these same phases: see [Sharding](/production/sharding/).
3. Creates the discord.js client with the computed intents and partials, your
   `client` options and the initial `presence`.
4. Attaches your event listeners, the trigger listener and the interaction
   router.
5. Installs the signal and crash handlers described below.
6. Logs in.

Calling `start()` a second time does nothing.

When Discord reports the client ready, the bot logs `Ready` with its tag, its
guild count and the framework version, then:

1. Runs the `onReady` hooks of your plugins, in order. A hook that throws is
   reported and does not stop the others.
2. Starts the scheduled jobs. On a sharded bot, a job runs on the first shard
   only unless it asks for all of them: see [Scheduled jobs](/events/jobs/).
3. Starts the presence rotation, if `presenceRotation` is set.
4. Starts the health server, if `health` is set.
5. Deploys the commands, if automatic deployment is on. It is on by default
   outside production. A failed deploy is logged and the bot keeps running:
   see [Deploying commands](/production/deploying/).

## While the bot runs

Every interaction goes through the same pipeline, inside an error boundary:

1. A `ctx` is created, with a new correlation id.
2. The [automatic deferral](/basics/automatic-deferral/) timer is armed, if one
   applies.
3. Plugin middleware runs (`beforeInteraction`). It wraps everything below, so
   a plugin can stop an interaction before any guard and time the whole thing.
4. The guards run in order, those of a command before those of its subcommand.
   The first refusal answers with an ephemeral error and stops the pipeline.
5. The handler runs.
6. The `afterInteraction` hooks run, only when the handler completed. A hook
   that throws is reported, without an error message for the user.

An error thrown anywhere in steps 3 to 5 goes to the error boundary: see
[Errors](/api/errors/). An error in an event listener, a trigger or a job is
logged and passed to the error hooks and to `onError`, without a `ctx`.

The process is also protected as a whole. An uncaught exception or an unhandled
promise rejection is logged and reported the same way, and the bot keeps
running.

## Shutting down

On `SIGINT` (Ctrl+C), `SIGTERM` or `SIGQUIT`, the bot calls `bot.shutdown()`
and exits with code 0. You can call `shutdown()` yourself too. It is safe to
call more than once.

In order:

1. **Jobs.** Timers stop, the `signal` of every running job is aborted, and the
   bot waits for those jobs to finish, 10 seconds at most.
2. **Timers and servers.** The presence rotation stops and the health server
   closes.
3. **Hooks.** The `onShutdown` hooks run, in order.
4. **Plugins.** Each plugin's `teardown` runs.
5. **Services.** Each service's `dispose` runs, most recently built first, so
   a service is disposed before the ones it depends on.
6. **Store.** The `store` of the configuration is closed.
7. **Client.** The discord.js client is destroyed, which disconnects the bot.

A hook, a `teardown` or a `dispose` that throws is logged and the following
ones still run, so one failing cleanup does not leave the rest open. After the
10 seconds, shutdown continues even if a job is still running.

## Where your code runs

| Moment | Put your code in | Page |
| --- | --- | --- |
| Once, before connecting | A service `factory`, or a plugin `setup` | [Services](/architecture/services/), [Plugins and hooks](/architecture/plugins/) |
| When the client is ready | An `onReady` hook | [Plugins and hooks](/architecture/plugins/) |
| Around every interaction | `beforeInteraction` and `afterInteraction` hooks | [Plugins and hooks](/architecture/plugins/) |
| On a schedule | A job | [Scheduled jobs](/events/jobs/) |
| When something throws | An `onError` hook, or `defineBot({ onError })` | [Errors](/api/errors/) |
| On shutdown | An `onShutdown` hook, a plugin `teardown`, a service `dispose` | [Plugins and hooks](/architecture/plugins/), [Services](/architecture/services/) |

A plugin sees most of these moments:

```ts title="src/features/lifecycle/lifecycle.plugin.ts"
import { definePlugin } from "@ix-xs/djs-bot";

export default definePlugin({
  name: "lifecycle-log",
  setup(app) {
    // Runs during load, before the client logs in.
    app.logger.info({}, "setting up");

    app.hooks.onReady((client) => {
      app.logger.info({ guilds: client.guilds.cache.size }, "connected");
    });
    app.hooks.onShutdown(() => {
      app.logger.info({}, "stopping");
    });
  },
  teardown(app) {
    // Runs during shutdown, after the onShutdown hooks.
    app.logger.info({}, "torn down");
  },
});
```

## Limits and errors

Each startup phase has its own error codes, all raised before the bot connects:

| Phase | Error | Cause |
| --- | --- | --- |
| Discover | [`DJSBOT_E060`](/api/errors/#djsbot_e060) | A file failed to import, or exports no definition. |
| Register | [`DJSBOT_E010`](/api/errors/#djsbot_e010) | Two commands share a name. |
| Register | [`DJSBOT_E011`](/api/errors/#djsbot_e011) | Two buttons, selects or modals share an id. |
| Validate | [`DJSBOT_E040`](/api/errors/#djsbot_e040) | A feature or a plugin requires a capability that nothing provides. |
| Validate | [`DJSBOT_E041`](/api/errors/#djsbot_e041) | A plugin conflicts with a capability that is provided. |
| Resolve services | [`DJSBOT_E030`](/api/errors/#djsbot_e030) | A service dependency is missing, or dependencies form a cycle. |
| Connect | [`DJSBOT_E001`](/api/errors/#djsbot_e001) | No token. |

Limits worth knowing:

- Running jobs get 10 seconds to finish during shutdown. A long job should
  watch `ctx.signal` and stop early.
- Shutdown waits for jobs, not for interaction handlers that are still running.
- `bot.client` throws until `start()` has created the client.

## See also

- [Configuration](/basics/configuration/): `load()`, `start()`, `shutdown()` and the other methods of the bot.
- [Project layout](/basics/project-layout/): what the discover step imports.
- [Plugins and hooks](/architecture/plugins/): the hooks that run at each phase.
- [Services](/architecture/services/): `factory`, `deps` and `dispose`.
- [CLI](/api/cli/): `explain` and `doctor`.
