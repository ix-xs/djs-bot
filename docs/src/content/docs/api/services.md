---
title: "Services & dependency injection"
description: "defineService, the Container, typing ctx.services, and the built-in service tokens."
sidebar:
  order: 7
---

A **service** is any shared object your handlers need: a database client, an API
wrapper, a cache, business logic. Declare it once, and it is injected into every
`ctx.services` - no singletons, no import cycles, no `reflect-metadata`.

## `defineService`

```ts
defineService(token: string, options: {
  deps?: string[];
  factory: (deps) => T | Promise<T>;
  dispose?: (instance: T) => unknown;
})
```

| Field | Type | Description |
| --- | --- | --- |
| `token` | `string` | Unique name used to resolve and inject the service. |
| `deps` | `string[]` | Other tokens injected into `factory`. Default `[]`. |
| `factory` | `(deps) => T \| Promise<T>` | Builds the instance. `deps` is an object keyed by the tokens you listed, typed from your `ServiceMap`. Can be async. |
| `dispose` | `(instance) => unknown` | Called on graceful shutdown. Close a pool, flush a buffer. |

```ts title="features/db/db.service.ts"
import { defineService } from "@ix-xs/djs-bot";

export default defineService("db", {
  async factory() {
    const client = new Client({ url: env("DATABASE_URL") });
    await client.connect();
    return client;
  },
  dispose: (client) => client.end(),
});
```

With dependencies:

```ts title="features/tickets/tickets.service.ts"
export default defineService("tickets", {
  deps: ["db", "store"],
  factory: ({ db, store }) => new TicketService(db, store),   // typed, no cast
});
```

Services are resolved **in topological order at boot**, each instantiated
exactly once (singletons). A missing token throws
[`DJSBOT_E031`](/api/errors/#djsbot_e031); a cycle throws
[`DJSBOT_E030`](/api/errors/#djsbot_e030) naming the chain
(`a -> b -> a`).

On shutdown, `dispose` hooks run in **reverse** order of creation: a service is
always released before the ones it depends on. A hook that throws is logged and
the others still run.

## Using services

Every context exposes them:

```ts
run: async (ctx) => {
  const rows = await ctx.services.db.query("select 1");
  await ctx.services.tickets.open(ctx.user.id);
}
```

They are equally available in events, jobs, triggers, guards, autocomplete
handlers and plugins.

## Typing `ctx.services`

Augment `ServiceMap` **once** in your project and everything becomes fully
typed, everywhere:

```ts title="src/types.d.ts"
import type { Db } from "./db.js";
import type { TicketService } from "./features/tickets/service.js";

declare module "@ix-xs/djs-bot" {
  interface ServiceMap {
    db: Db;
    tickets: TicketService;
  }
}
```

Now `ctx.services.tickets.open(...)` autocompletes and type-checks, and the
`deps` object a factory receives is typed the same way:

```ts
defineService("tickets", {
  deps: ["db"],
  factory: ({ db }) => new TicketService(db),   // db: Db
});
```

A token you did not declare is `unknown`, so nothing is ever silently `any`.

`store`, `audit` and `flags` are declared by the framework: you get
`ctx.services.store.increment(...)` typed with no setup at all.

## Built-in service tokens

The framework registers these for you when the matching configuration is present:

| Token | Registered when | Type |
| --- | --- | --- |
| `store` | `defineBot({ store })` | [`KVStore`](/api/store/) |
| `audit` | `defineBot({ audit })` | [`AuditLog`](/api/audit/) |
| `flags` | `defineBot({ flags })` | [`FeatureFlags`](/api/flags/) |

Plugins can register more with `app.services.register(token, value)` - see
[Plugins](/api/plugins/).

## `Container`

The container behind all of this is exposed as `bot.container`. You rarely need
it, but nothing is hidden:

| Method | Description |
| --- | --- |
| `register(def)` | Registers a `ServiceDefinition`. |
| `registerValue(token, value)` | Registers an already-built value. |
| `has(token)` | Whether a token is known. |
| `tokens()` | Every registered token. |
| `resolve(token)` | Resolves one service, building its dependency graph on demand. |
| `resolveAll()` | Eagerly resolves every definition (called once at boot). |
| `disposeAll(onError?)` | Runs every `dispose` hook, newest first (called on shutdown). |
| `view()` | The live, read-only `ServiceMap` exposed as `ctx.services`. |

```ts
await bot.load();
console.log(bot.container.tokens());          // ["store", "db", "tickets", …]
const db = await bot.container.resolve("db");
```

Reading an unknown token throws [`DJSBOT_E031`](/api/errors/#djsbot_e031) and
lists the tokens that do exist, which usually reveals the typo at once:

```
BotError [DJSBOT_E031]: Unknown service: service "databse"
  ↳ Requested a service that was never registered. Known services: store, db, tickets.
```

## Capability contracts

Features and plugins can declare what they need and what they offer:

```ts
defineFeature({ name: "tickets", requires: ["db"], commands: [Open] });
definePlugin({ name: "postgres", provides: ["db"], setup: (app) => app.services.register("db", client) });
```

At boot the framework verifies every `requires` is satisfied by a `provides`, by
a registered service, or by built-in configuration - failing fast with
[`DJSBOT_E040`](/api/errors/#djsbot_e040) instead of crashing later on
the first interaction. Two plugins providing the same capability raise
[`DJSBOT_E041`](/api/errors/#djsbot_e041).

## Inspecting the graph

```bash
npx djs-bot explain
```

prints every loaded definition, the resolved service tokens and the deployment
plan - the fastest way to answer "is my service actually registered?".
