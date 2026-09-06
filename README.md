<div align="center">

# @ix-xs/djs-bot

**A TypeScript-first, production-ready framework for Discord bots - built on [discord.js](https://discord.js.org).**

_Write features, not plumbing._

[![npm version](https://img.shields.io/npm/v/@ix-xs/djs-bot.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@ix-xs/djs-bot)
[![npm downloads](https://img.shields.io/npm/dm/@ix-xs/djs-bot.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@ix-xs/djs-bot)
[![CI](https://img.shields.io/github/actions/workflow/status/ix-xs/djs-bot/ci.yml?branch=main&label=CI&logo=github)](https://github.com/ix-xs/djs-bot/actions)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![node](https://img.shields.io/badge/node-%3E%3D22-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org)
[![types](https://img.shields.io/badge/types-included-3178c6?logo=typescript&logoColor=white)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

**[Documentation](https://ix-xs.github.io/djs-bot/)** ·
[Tutorial](https://ix-xs.github.io/djs-bot/tutorial/what-you-need/) ·
[API reference](https://ix-xs.github.io/djs-bot/api/overview/) ·
[Recipes](https://ix-xs.github.io/djs-bot/recipes/moderation/) ·
[Troubleshooting](https://ix-xs.github.io/djs-bot/help/troubleshooting/)

</div>

```bash
npm install @ix-xs/djs-bot discord.js
```

Requires **Node 22+** (a dependency uses the built-in `node:sqlite`).

---

`djs-bot` turns the 15 things you rewire in every Discord bot - command loading,
interaction routing, `customId` parsing, intent calculation, command deployment,
error handling, cooldowns, permissions, config, logging, graceful shutdown - into
a small, explicit, fully-typed framework. It never hides discord.js, and every
automatic behaviour is inspectable with `djs-bot explain`.

```ts
import { defineBot, defineCommand, env } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: "./src/features", // auto-discovered
  intents: "auto",            // derived from your events
}).use(
  defineCommand({
    name: "ping",
    description: "Check the bot is alive",
    run: (ctx) => ctx.reply.success("Pong! 🏓"),
  }),
);
```

## Why

| Pain | djs-bot |
| --- | --- |
| `customId` strings you `split("_")` and pray | **Typed customId router** - declare params, `Button.build({ ... })` is type-checked, `ctx.params` is decoded and typed |
| "My event never fires" (forgot an intent) | **Intent autopilot** - `intents: "auto"` derives intents & partials from your events, and warns about privileged ones |
| Copy-pasted `deploy-commands.js`, ghost commands, 429s | **Diff deployer** - declarative: adds/updates/**removes** to match your code; mix **global + per-server** commands (`guilds: [...]`), with `--dry-run` |
| "This application did not respond" | **Error boundaries** - every interaction is wrapped; failures are logged with a correlation id and answered |
| Decorator magic you can't debug | **No side-effect loading** - files export `define*()` objects; nothing registers by importing. `djs-bot explain` shows it all |
| Bots are impossible to unit-test | **Test harness** - invoke handlers with no token, no network |
| "Frameworks are slow" | **~1.4 µs** per-interaction routing overhead - see [benchmarks](./benchmarks) |
| Rebuilding the same helpers every project | **Batteries included** - subcommands, context menus, autocomplete, native selects, user-install, i18n (`ctx.t`), key-value stores, audit trail, per-guild feature flags, health checks & metrics, rate limiters & circuit breakers, message triggers, sharding, `paginate()`/`confirm()`, presence rotation, `assets`/`voice`, `ui` Components-V2 builders, and a smart TTL cache |

## Install

Requires **Node 22 or newer** (a dependency uses the built-in `node:sqlite`).

```bash
npm install @ix-xs/djs-bot discord.js
# for running raw TypeScript in dev (recommended):
npm install -D tsx typescript
```

Scaffold a starter in seconds:

```bash
npx djs-bot init
```

Works the same in **TypeScript** and **plain JavaScript** (CommonJS or ESM) - the
package ships full `.d.ts` declarations, so JS editors get autocomplete and inline
docs too. See [examples/](./examples) for a runnable bot in each language.

## Documentation

Everything lives at **[ix-xs.github.io/djs-bot](https://ix-xs.github.io/djs-bot/)**:

| Section | For |
| --- | --- |
| [Quick start](https://ix-xs.github.io/djs-bot/getting-started/) | A working bot in five steps |
| [Tutorial](https://ix-xs.github.io/djs-bot/tutorial/what-you-need/) | Zero to a deployed bot, no prior experience assumed |
| [Guides](https://ix-xs.github.io/djs-bot/guide/basics/install-project-layout/) | One topic at a time: commands, components, events, data, ops |
| [API reference](https://ix-xs.github.io/djs-bot/api/overview/) | Every export, option and error code |
| [Recipes](https://ix-xs.github.io/djs-bot/recipes/moderation/) | Complete features to copy: moderation, tickets, role menus, levelling, hosting |
| [Troubleshooting](https://ix-xs.github.io/djs-bot/help/troubleshooting/) | Symptom, cause, fix |
| [Glossary](https://ix-xs.github.io/djs-bot/help/glossary/) | Every Discord and framework term in plain language |

The guides are generated from [USAGE.md](./USAGE.md), which is also readable on
its own if you prefer a single file.

> Also in this repo: official plugins ([`@ix-xs/djs-bot/plugins`](./src/plugins)),
> [VS Code snippets](./editors/vscode), and the [docs site](./docs) itself.
> Hacking on the framework? See [CONTRIBUTING.md](./CONTRIBUTING.md) - every task
> runs from the repo root (`npm run check`, `npm run docs`, `npm run bench`, …).

## Official plugins

First-party plugins live at the `@ix-xs/djs-bot/plugins` subpath:

```ts
import { defineBot } from "@ix-xs/djs-bot";
import { antiSpam, commandLogger, errorReporter, maintenance } from "@ix-xs/djs-bot/plugins";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  plugins: [antiSpam({ max: 5, window: "10s" }), commandLogger(), errorReporter({ report: sendToSentry })],
});
```

`antiSpam` · `commandLogger` · `errorReporter` · `maintenance` - all small,
readable examples of the plugin API.

## Table of contents

- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
- [Commands](#commands)
- [Typed buttons & the customId router](#typed-buttons--the-customid-router)
- [Select menus & modals](#select-menus--modals)
- [Events & intent autopilot](#events--intent-autopilot)
- [Guards](#guards)
- [Services & dependency injection](#services--dependency-injection)
- [Jobs](#jobs)
- [Plugins](#plugins)
- [Features](#features)
- [Configuration](#configuration)
- [The CLI](#the-cli)
- [Testing](#testing)
- [Production](#production)
- [Error codes](#error-codes)

## Quick start

```
src/
  index.ts                 # defineBot(...)
  features/
    ping/ping.command.ts
    tickets/
      open.command.ts
      close.button.ts
      tickets.service.ts
    welcome/welcome.event.ts
```

`src/index.ts`:

```ts
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
  intents: "auto",
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD") },
});

export default bot;

// Start only when run directly; the CLI imports this file for tooling.
if (!process.env.DJSBOT_CLI) void bot.start();
```

Then:

```bash
npx djs-bot dev        # watch + instant guild deploy
npx djs-bot explain    # see everything that's loaded
npx djs-bot doctor     # diagnose config, intents, permissions
```

## Core concepts

Everything is a plain object created by a `define*()` factory, tagged with a
`kind`. Files are **discovered** by name convention (`*.command.ts`,
`*.button.ts`, …) but **routed** by `kind` - so importing a file never has a
side effect.

| Factory | Creates | Discovered from |
| --- | --- | --- |
| `defineBot` | the application | your entry file |
| `defineCommand` | a slash command | `*.command.ts` |
| `defineEvent` | a gateway listener | `*.event.ts` |
| `defineButton` | a button + typed customId | `*.button.ts` |
| `defineSelectMenu` | a string select menu | `*.select.ts` |
| `defineModal` | a modal | `*.modal.ts` |
| `defineService` | an injectable service | `*.service.ts` |
| `defineJob` | a scheduled job | `*.job.ts` |
| `definePlugin` | a cross-cutting plugin | passed to `plugins` |
| `defineFeature` | a bundle of the above | `*.feature.ts` |

## Commands

Options are declared with the `s` builders and become a **fully-typed**
`ctx.options`:

```ts
import { defineCommand, s, inGuild, hasPermission, cooldown, PermissionFlagsBits } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ban",
  description: "Ban a member",
  options: {
    target: s.user({ description: "Who to ban", required: true }),
    reason: s.string({ description: "Why", maxLength: 200 }),
    days:   s.integer({ description: "Days of messages to delete", min: 0, max: 7 }),
  },
  guards: [inGuild(), hasPermission(PermissionFlagsBits.BanMembers), cooldown("10s")],
  run: async (ctx) => {
    // ctx.options.target: User, ctx.options.reason?: string, ctx.options.days?: number
    await ctx.guild!.members.ban(ctx.options.target, { reason: ctx.options.reason });
    await ctx.reply.success(`Banned ${ctx.options.target}.`);
  },
});
```

Option builders: `s.string`, `s.integer`, `s.number`, `s.boolean`, `s.user`,
`s.member`, `s.channel`, `s.role`, `s.mentionable`, `s.attachment`.

**Reply helpers** on every interaction context:

```ts
await ctx.reply("plain text or InteractionReplyOptions");
await ctx.reply.success("Done!");            // green embed
await ctx.reply.error("Nope.");              // red embed, ephemeral by default
await ctx.reply.info("FYI", { ephemeral: true });
await ctx.reply.defer({ ephemeral: true });  // for slow handlers
await ctx.reply.followUp("more");
await ctx.reply.editReply("updated");
```

## Typed buttons & the customId router

Declare the params a button carries; `build()` and `ctx.params` are both typed,
and the framework encodes/decodes them into the 100-char customId for you.

```ts
import { defineButton, p, ButtonStyle } from "@ix-xs/djs-bot";

export const CloseTicket = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string, ownerId: p.string },
  run: async (ctx) => {
    if (ctx.user.id !== ctx.params.ownerId) return void ctx.reply.error("Not your ticket.");
    await ctx.services.tickets.close(ctx.params.ticketId);
    await ctx.update.disable(); // disable the button on the source message
    await ctx.reply.success("Closed. 🔒", { ephemeral: true });
  },
});
```

Building one somewhere else is type-checked - you can't forget a param:

```ts
import { ActionRowBuilder, type ButtonBuilder } from "discord.js";

const button = CloseTicket.build(
  { ticketId, ownerId: ctx.user.id },
  { label: "Close", style: ButtonStyle.Danger, emoji: "🔒" },
);
const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
await ctx.reply({ content: "🎫 Ticket opened", components: [row] });
```

Param codecs: `p.string`, `p.number`, `p.boolean`. If the encoded id would
exceed Discord's 100-char limit you get a coded error (`DJSBOT_E020`) instead of
a silent runtime failure.

## Select menus & modals

```ts
import { defineSelectMenu, defineModal, field, p } from "@ix-xs/djs-bot";

export const Roles = defineSelectMenu({
  id: "roles:pick",
  params: { messageId: p.string },
  run: (ctx) => ctx.reply.success(`You picked: ${ctx.values.join(", ")}`),
});

export const Feedback = defineModal({
  id: "feedback:submit",
  title: "Feedback",
  fields: {
    subject: field.short({ label: "Subject", required: true, maxLength: 80 }),
    body:    field.paragraph({ label: "Details", maxLength: 1000 }),
  },
  run: (ctx) => ctx.reply.success(`Thanks: ${ctx.fields.subject}`), // ctx.fields typed
});

// Open the modal from a command/button:
await ctx.interaction.showModal(Feedback.build());
```

## Events & intent autopilot

```ts
import { defineEvent } from "@ix-xs/djs-bot";

export default defineEvent("guildMemberAdd", async (member, ctx) => {
  // Because this event exists, the GuildMembers intent is added automatically.
  ctx.logger.info({ id: member.id }, "joined");
});
```

With `intents: "auto"`, djs-bot inspects your registered events and enables
exactly the gateway intents and partials they need - and warns you when a
**privileged** intent (GuildMembers, MessageContent, GuildPresences) must be
toggled in the Developer Portal. Prefer explicit control? Pass an array instead.

## Guards

Guards are composable, typed preconditions. A failing guard short-circuits and
replies with its reason.

```ts
import { guard, pass, fail, inGuild, hasPermission, botHasPermission, cooldown, ownerOnly } from "@ix-xs/djs-bot";

export const isPremium = guard("isPremium", async (ctx) =>
  (await ctx.services.billing.isPremium(ctx.guildId)) ? pass() : fail("Premium only."),
);

// guards: [inGuild(), hasPermission("ManageGuild"), cooldown("1m", { scope: "guild" }), isPremium]
```

Built-ins: `inGuild`, `dmOnly`, `hasPermission`, `botHasPermission`, `inChannel`,
`ownerOnly`, `cooldown`.

## Services & dependency injection

A tiny, explicit container - no decorators, no `reflect-metadata`. Declare deps
as tokens; they're resolved in order at boot and available as `ctx.services`.

```ts
import { defineService } from "@ix-xs/djs-bot";

export const Db = defineService("db", { factory: () => createDb() });

export const Tickets = defineService("tickets", {
  deps: ["db"],
  factory: ({ db }) => new TicketsService(db as Db),
});

// Type ctx.services end to end by augmenting ServiceMap:
declare module "@ix-xs/djs-bot" {
  interface ServiceMap {
    db: Db;
    tickets: TicketsService;
  }
}
```

## Jobs

Cron expressions and durations are both supported. Jobs get an `AbortSignal`
that fires on shutdown, and a concurrency limit (default: no overlap).

```ts
import { defineJob } from "@ix-xs/djs-bot";

export default defineJob({
  name: "nightly-cleanup",
  schedule: "0 3 * * *", // or "30s", "5m", "1h"
  run: async (ctx) => {
    await ctx.services.db.purgeExpired();
  },
});
```

## Plugins

Cross-cutting extensions register middleware and hooks through a restricted
`app` façade - they never patch the core.

```ts
import { definePlugin } from "@ix-xs/djs-bot";

export const requestLogger = definePlugin({
  name: "request-logger",
  version: "1.0.0",
  setup(app) {
    app.hooks.beforeInteraction(async (ctx, next) => {
      const start = Date.now();
      await next();
      ctx.logger.info({ ms: Date.now() - start }, "interaction handled");
    });
  },
});

// defineBot({ plugins: [requestLogger] })
```

Plugins declare `requires` / `provides` / `conflicts`; djs-bot validates the
capability graph at boot and fails **loudly** (`DJSBOT_E040` / `E041`) rather
than silently.

## Features

A feature bundles commands, events, components, services and jobs into a
reusable, publishable unit with its own contract.

```ts
import { defineFeature } from "@ix-xs/djs-bot";
import * as commands from "./commands";

export default defineFeature({
  name: "giveaways",
  requires: ["db"],        // the host must provide a `db` service
  commands: Object.values(commands),
});

// defineBot({ features: ["./src/features", giveaways] })
```

## Configuration

Everything is configured in the object you pass to `defineBot` - fully typed:

```ts
import { defineBot, env } from "@ix-xs/djs-bot";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  clientId: env.optional("DISCORD_CLIENT_ID"),
  features: "./src/features",
  intents: "auto",
  plugins: [],
  deploy: { devGuildId: env.optional("DISCORD_DEV_GUILD"), autoDeploy: true },
  logger: { level: "info", pretty: process.env.NODE_ENV !== "production" },
  presence: { activities: [{ name: "/help" }] },
  onError: (err, ctx) => ctx?.reply.error("Something broke - we're on it."),
});
```

`env(name, fallback?)` reads from the environment **and** a `.env` file, throwing
a clear error when a required variable is missing. `env.optional(name)` returns
`undefined` instead.

## The CLI

```
djs-bot dev [entry]            Start with watch + instant guild deploy
djs-bot start [entry]          Start in production mode
djs-bot deploy [entry]         Diff & deploy commands (adds/updates/removes)  (--dry-run, --guild <id>)
djs-bot clear [entry]          Remove all commands from a scope  (--global | --guild <id>)
djs-bot doctor [entry]         Diagnose config, intents & permissions
djs-bot explain [entry]        Print what's loaded and why (incl. deployment plan)
djs-bot generate <type> <name> Scaffold a command/event/button/modal/select/service/job/feature/trigger
djs-bot init                   Scaffold a minimal starter
```

`dev`/`start` run your entry (using `tsx` automatically if installed, so raw
`.ts` works). `deploy`/`doctor`/`explain` import your entry in introspection
mode (`DJSBOT_CLI=introspect`) - they never connect to the gateway.

## Testing

Unit-test handlers with **no token and no network** using the harness:

```ts
import { createHarness } from "@ix-xs/djs-bot/testing";
import Echo from "../src/features/echo/echo.command.js";
import { CloseTicket } from "../src/features/tickets/close.button.js";

const h = createHarness();

test("echo replies", async () => {
  const { replies } = await h.command(Echo, { options: { text: "hi" } });
  expect(replies[0]).toEqual({ type: "reply", content: "hi" });
});

test("only the owner can close", async () => {
  const { replies } = await h.button(CloseTicket, {
    userId: "someone-else",
    params: { ticketId: "t1", ownerId: "owner" },
  });
  expect(replies[0].type).toBe("error");
});
```

## Production

Prod-readiness is built in, not an afterthought:

- **Structured logging** - JSON in production, pretty in dev, with a
  `correlationId` on every interaction.
- **Error boundaries** - a handler that throws is logged and answered; the
  process stays alive (via `node-comfort`'s `dontCrash`).
- **Graceful shutdown** - `SIGTERM`/`SIGINT` stop the scheduler, run
  `onShutdown` hooks, tear down plugins and destroy the client.
- **Diff deploys** - commands are only pushed when they actually change.
- **Cooldowns, rate limits & permissions** - first-class guards (`cooldown`,
  `rateLimit`, `hasPermission`, …).
- **Resilience primitives** - `retry`, `timeout`, `createCircuitBreaker` and
  `createRateLimiter` for hardening calls to databases and third-party APIs.
- **Health & metrics** - a zero-dependency `/healthz` `/readyz` `/metrics` server
  for Docker/Kubernetes.
- **Persistence, audit & flags** - a pluggable `KVStore`, a queryable audit trail,
  and per-guild feature flags - all optional, all typed.

## Error codes

Every framework error carries a stable `DJSBOT_Exxx` code, an actionable hint,
and is grep-able in your logs. Highlights: `E001` missing token, `E010`
duplicate command, `E011` duplicate component id, `E012` invalid command/option
name, `E013` invalid component id, `E020` customId too long, `E030` service
cycle, `E040` unmet feature/plugin contract, `E070` privileged intent required.
The full table is in [USAGE.md](./USAGE.md#27-error-handling--codes).

---

Built with ❤️ on top of [discord.js](https://discord.js.org) and
[`@ix-xs/node-comfort`](https://www.npmjs.com/package/@ix-xs/node-comfort). MIT licensed.
