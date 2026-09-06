---
title: "FAQ"
description: "Short answers to the questions that come up before you start, and while you build."
sidebar:
  order: 2
---

## Before you start

### Do I need to know discord.js?

No, but it helps. The framework sits **on top** of discord.js and never hides
it: `ctx.interaction`, `ctx.client`, `ctx.guild` and `ctx.member` are the real
discord.js objects, so every discord.js guide still applies. You only learn the
extra layer, not a replacement for it.

### Can I add this to an existing discord.js bot?

Yes. Register definitions explicitly and keep your existing client code
alongside while you migrate:

```ts
export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: [MyNewCommand, MyNewEvent],
});
```

Move one command at a time. Nothing forces a big-bang rewrite.

### What do I need installed?

Node **22 or newer** (the SQLite store uses `node:sqlite`), plus
`@ix-xs/djs-bot` and `discord.js`. `tsx` is optional and lets `dev` and `start`
run TypeScript with no build step.

### Is TypeScript required?

Not strictly, but the entire point of the framework is the typing: typed
options, typed customId params, typed services. In plain JavaScript it still
works and you still get the routing, guards, DI and CLI, you just lose the
compile-time safety.

## Commands

### Global or guild commands?

| | Global | Guild |
| --- | --- | --- |
| Where | Every server the bot is in | The listed servers only |
| Propagation | Up to an hour | Instant |
| Declare with | nothing (the default) | `guilds: ["id"]` |

Use guild commands for admin tools and for development, global for everything
your users need.

### How do I make a command admin-only?

Both layers, together:

```ts
defaultMemberPermissions: PermissionFlagsBits.Administrator,   // Discord hides it
guards: [hasPermission(PermissionFlagsBits.Administrator)],    // your bot enforces it
```

The first hides the command in the UI, but a server admin can override it in
Server Settings. The guard cannot be overridden.

### How many options can a command have?

25 per command or subcommand, and Discord requires required options first (the
framework orders them for you). A command can hold 25 subcommands, and a group
can hold 25 subcommands.

### Choices or autocomplete?

`choices` for a fixed list of at most 25 values, rendered by Discord itself.
`autocomplete` for anything dynamic, user-specific or longer. They are mutually
exclusive.

## Components

### Why encode params in the customId instead of using a Map?

Because your bot restarts. A `Map` keyed by message id is empty after a deploy,
and every old button becomes dead. The customId travels with the message, so a
button posted six months ago still works after any number of restarts. When the
payload is too big for 100 characters, keep a short key and store the rest.

### How long do buttons stay alive?

Registered components (`defineButton`) work **forever**, restart included.
`paginate` and `confirm` use their own collector and stop at their `timeout`
(2 minutes and 1 minute by default), disabling the controls when they end.

### Can I use embeds and Components V2 in the same message?

No. A message with the `IsComponentsV2` flag cannot carry `content` or `embeds`.
Pick one per message.

## Data

### Which store should I use?

`memoryStore()` for tests and ephemeral state, `sqliteStore()` for anything that
must survive a restart. Write a `KVStore` adapter when you outgrow those; the
interface is eight methods.

### Do I have to use the built-in store?

No. It is only a convenience. Register Prisma, Drizzle, Mongo or a raw pool as a
service and use that instead:

```ts
defineService("db", { factory: () => new PrismaClient() });
```

The store exists so small bots need no database at all, and so features like
flags and audit have somewhere to write.

### Where should I put my data files?

Anywhere outside your source tree, for example `data/bot.sqlite`, and add
`data/` to `.gitignore`. Create the directory before first run.

## Production

### How do I host it?

Anything that runs Node 22: a VPS with systemd or pm2, Docker, Fly, Railway,
Render. See [Going live](/djs-bot/tutorial/going-live/) for a complete walk
through.

### When do I need sharding?

At **2500 servers**, where Discord requires it. Below that it adds complexity
for nothing. When you get there, `sharding: "auto"` handles it.

### How do I know the bot is healthy?

Enable the health server and point your monitor at it:

```ts
health: 3000,
```

`/healthz` for liveness, `/readyz` for readiness, `/metrics` for counters. See
[Health checks](/djs-bot/api/health/).

### Should I run deploy on every start?

No. In production, deploy from CI on release, not on boot. `autoDeploy`
defaults to on in development and off in production for exactly this reason:
deploying on every restart wastes rate limit and makes rollbacks confusing.

## The framework

### How is this different from a template repository?

A template is a snapshot you fork and then maintain forever. This is a
dependency you upgrade. Routing, deployment diffing, intent computation, the
error boundary, DI and the CLI are maintained upstream rather than copy-pasted
into your project.

### Does it lock me in?

Every escape hatch stays open: `ctx.interaction` and `ctx.client` are raw
discord.js, definitions are plain objects, services are yours, and you can
always drop to `client.on(...)` through a `defineEvent`. There is no proprietary
runtime to unwind.

### Is it production ready?

It is 1.0.0, semver-stable, with a typed public API, an error catalogue and a
test suite. Version 1.x will not break your code.

### Where do I report a bug or ask for a feature?

[Issues](https://github.com/ix-xs/djs-bot/issues) for bugs,
[Discussions](https://github.com/ix-xs/djs-bot/discussions) for questions and
ideas. Include the error code and the output of `npx djs-bot explain`.
