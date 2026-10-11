---
title: "Services"
description: "A service is a shared object your handlers need: a database client, an API wrapper, a piece of business logic. Define it once with defineService and read it from ctx.services anywhere, fully typed, with no global variable and no import cycle."
sidebar:
  order: 1
---

Services are held by a small, explicit container. There are no decorators and no
`reflect-metadata`: a service has a name (its token), lists the tokens it
depends on, and is built once when the bot starts.

## A first service

```ts title="src/features/db/db.service.ts"
import { defineService, env } from "@ix-xs/djs-bot";
import { Pool } from "pg";

export default defineService("db", {
  factory: async () => {
    const pool = new Pool({ connectionString: env("DATABASE_URL") });
    await pool.query("select 1"); // fail at startup if the database is unreachable
    return pool;
  },
  dispose: (pool) => pool.end(),
});
```

The first argument is the token. `factory` builds the instance and may be
async. The loader picks up any file whose name ends with `.service` (see
[Project layout](/basics/project-layout/)).

The instance is then available as `ctx.services.db`:

```ts title="src/features/tickets/count.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "tickets",
  description: "How many tickets are open",
  run: async (ctx) => {
    const { rows } = await ctx.services.db.query("select count(*) from tickets where open");
    await ctx.reply(`Open tickets: ${rows[0].count}`);
  },
});
```

Every `ctx` carries the same `services`: commands, context menus, buttons, select
menus, modals, events, triggers, jobs, guards and autocomplete handlers. Plugin
hooks receive that `ctx` too.

Each service is a singleton. All of them are built at startup, before the bot
connects, so a database that cannot be reached stops the launch and not the
first command that needs it.

## Depend on other services

List the tokens a service needs in `deps`. They are built first and passed to
`factory` as one object, keyed by token.

```ts title="src/features/tickets/tickets.service.ts"
import { defineService } from "@ix-xs/djs-bot";
import { TicketService } from "./ticket-service.js";

export default defineService("tickets", {
  deps: ["db", "store"],
  factory: ({ db, store }) => new TicketService(db, store),
});
```

The order of the files does not matter: the container sorts the graph itself.
A token that does not exist, or two services that depend on each other, stop the
startup with a clear error (see [Limits and errors](#limits-and-errors)).

`store` in this example is one of the three tokens the framework registers
itself, when the matching option of `defineBot` is set:

| Token | Registered when | Type | Page |
| --- | --- | --- | --- |
| `store` | `defineBot({ store })` | `KVStore` | [Store](/data/store/) |
| `audit` | `defineBot({ audit })` | `AuditLog` | [Audit trail](/data/audit/) |
| `flags` | `defineBot({ flags })` | `FeatureFlags` | [Feature flags](/data/flags/) |

A [plugin](/architecture/plugins/) can register more tokens with
`app.services.register(token, value)`. Plugins are set up before services are
built, so a service can list such a token in its `deps`.

## Type your services

Out of the box, a token you defined yourself is `unknown`, so nothing is ever
silently `any`. Declare your tokens once by augmenting the `ServiceMap`
interface:

```ts title="src/types.d.ts"
import type { Pool } from "pg";
import type { TicketService } from "./features/tickets/ticket-service.js";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap {
    db: Pool;
    tickets: TicketService;
  }
}
```

From then on `ctx.services.tickets.open(...)` completes and type-checks
everywhere, and the object a factory receives is typed the same way:

```ts
defineService("tickets", {
  deps: ["db", "store"],
  factory: ({ db, store }) => new TicketService(db, store), // db: Pool, store: KVStore
});
```

`store`, `audit` and `flags` are declared by the framework. You get
`ctx.services.store` typed with nothing to write.

:::caution[Keep an import in that file]
The file that augments `ServiceMap` must contain at least one `import` or
`export`. Without one, TypeScript reads `declare module` as a replacement for
the whole package and every other import from `"@ix-xs/djs-bot"` breaks.
:::

## Release on shutdown

`dispose` receives the instance when the bot shuts down gracefully. Use it to
close a connection pool or to flush a buffer.

```ts
defineService("db", {
  factory: () => new Pool({ connectionString: env("DATABASE_URL") }),
  dispose: (pool) => pool.end(),
});
```

Services are disposed in the reverse order of their creation, so a service is
always released before the ones it depends on: `tickets` first, then `db`. A
`dispose` that throws is logged and the others still run. The whole shutdown
sequence is on the [Lifecycle](/basics/lifecycle/) page.

Only services built by a `factory` are disposed this way. A value registered by
a plugin is released by the `teardown` of that plugin, and the framework closes
the `store` itself.

## Capability contracts

A [feature](/architecture/features/) or a [plugin](/architecture/plugins/) can
declare what it needs and what it offers, as plain strings called capabilities.
By convention a capability is a service token.

```ts
defineFeature({ name: "tickets", requires: ["db"], commands: [Open] });

definePlugin({
  name: "postgres",
  provides: ["db"],
  setup: (app) => app.services.register("db", pool),
});
```

The contracts are checked at startup, before any plugin is set up, any service
is built or the bot connects. A missing piece therefore stops the launch,
instead of failing later on the first interaction.

An entry of `requires` is satisfied by any of these:

- the token of a `defineService`;
- an entry in the `provides` of any plugin or feature;
- a built-in token whose option is set: `defineBot({ store })` satisfies
  `requires: ["store"]`.

Otherwise startup fails with [`DJSBOT_E040`](/api/errors/#djsbot_e040), which
names the feature or plugin and the missing capability.

Two details follow from the moment of the check:

- A value that a plugin registers in `setup` does not count on its own, because
  `setup` has not run yet. The plugin must also list the token in `provides`.
- `provides` is a declaration. The framework does not verify that a service of
  that name is registered afterwards.

A plugin can also list capabilities in `conflicts`. Startup then fails with
[`DJSBOT_E041`](/api/errors/#djsbot_e041) if one of them is the token of a
`defineService` or appears in a `provides`. Two plugins that provide the same
capability are not a conflict by themselves: declare `conflicts` to forbid it.

## Reference

### `defineService(token, options)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `token` | `string` | - | The name used to resolve and inject the service. First argument. |
| `deps` | `string[]` | `[]` | Tokens of the services this one needs. They are resolved first. |
| `factory` | `(deps) => T \| Promise<T>` | - | Builds the instance. `deps` is an object keyed by the tokens you listed, typed from `ServiceMap` (`unknown` for a token you did not declare). |
| `dispose` | `(instance: T) => unknown` | none | Called with the instance during graceful shutdown. May be async. |

Returns a `ServiceDefinition<T>` (`kind: "service"`, `name`, `deps`, `factory`,
`dispose`), to export from a `.service` file or to list in a
[feature](/architecture/features/).

### `ServiceMap`

The interface behind `ctx.services`. It declares `store: KVStore`,
`audit: AuditLog` and `flags: FeatureFlags`, and any other token as `unknown`.
Augment it as shown in [Type your services](#type-your-services).

`ctx.services` is a live, read-only view of the container:

| Operation | Result |
| --- | --- |
| `ctx.services.db` | The instance. Throws [`DJSBOT_E031`](/api/errors/#djsbot_e031) if the token is not registered, including a built-in token whose option is not set. |
| `"db" in ctx.services` | `true` when the token is registered. Use it for an optional service. |
| `Object.keys(ctx.services)` | The registered tokens. |

### `Container`

The container behind all of this is exposed as `bot.container`. You rarely need
it, but nothing is hidden.

| Method | Returns | Description |
| --- | --- | --- |
| `register(def)` | `void` | Registers a `ServiceDefinition`. |
| `registerValue(token, value)` | `void` | Registers an already built value. This is what `app.services.register` calls. |
| `has(token)` | `boolean` | Whether a token is known, as a definition or as a value. |
| `tokens()` | `string[]` | Every registered token. |
| `resolve(token)` | `Promise<unknown>` | Resolves one service, building its dependencies on demand. Throws `DJSBOT_E031` for an unknown token and `DJSBOT_E030` on a cycle. |
| `resolveAll()` | `Promise<void>` | Builds every definition. Called once at startup. |
| `disposeAll(onError?)` | `Promise<void>` | Runs every `dispose`, most recently built first. A failure is passed to `onError(error, token)` and does not stop the others. Called on shutdown. |
| `view()` | `ServiceMap` | The read-only view exposed as `ctx.services`. |

```ts
await bot.load(); // discovers the files and builds the services, without connecting
console.log(bot.container.tokens()); // ["db", "tickets", "store"]
const db = await bot.container.resolve("db");
```

## Limits and errors

- **Unknown token.** A typo in `deps` stops the startup with
  [`DJSBOT_E031`](/api/errors/#djsbot_e031). Reading a token that does not exist
  on `ctx.services` throws the same error at that moment. The message lists the
  tokens that do exist, which usually reveals the typo:

  ```text
  BotError [DJSBOT_E031]: Unknown service: service "databse"
    ↳ Requested a service that was never registered. Known services: db, tickets, store.
  ```

- **Cycle.** Two services that depend on each other, directly or not, stop the
  startup with [`DJSBOT_E030`](/api/errors/#djsbot_e030). The message names the
  chain (`a -> b -> a`).
- **A factory that throws** stops the startup with its own error.
- **A duplicate token is a warning, not an error.** If two definitions use the
  same token, the last one registered replaces the other, and the bot logs
  `Two services share this token; the one registered last is used` at startup.
- **Is my service registered?** `npx djs-bot explain` prints every loaded
  definition and the service tokens, without connecting. See [CLI](/api/cli/).

## See also

- [Plugins and hooks](/architecture/plugins/): register a shared resource together with hooks.
- [Features](/architecture/features/): bundle services with the commands that use them.
- [The ctx object](/basics/context/): everything else a handler receives.
- [Store](/data/store/): the built-in key-value service.
- [Testing](/production/testing/): replace a service with a fake in a test.
