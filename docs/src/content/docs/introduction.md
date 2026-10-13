---
title: "Introduction"
description: "What djs-bot is, what it takes off your hands, what stays yours, and where to start reading."
sidebar:
  order: 1
---

djs-bot is a framework for Discord bots, written for TypeScript and built on
top of [discord.js](https://discord.js.org). You describe what your bot does,
one file per feature, and the framework does the wiring: it finds the files,
registers the commands with Discord, routes each interaction to its handler
and hands that handler values that are already typed.

It does not replace discord.js. The client, the guilds, the members and the
builders you use are the real discord.js objects, so everything you know about
discord.js still applies, and every guide written for it still works.

## What a feature looks like

A slash command is one file that exports one definition:

```ts title="features/profile/profile.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "profile",
  description: "Show a user profile",
  options: {
    target: s.user({ description: "Whose profile", required: true }),
    detailed: s.boolean({ description: "Verbose output" }),
  },
  run: async (ctx) => {
    // ctx.options.target:   User                  (required, so never undefined)
    // ctx.options.detailed: boolean | undefined   (optional)
    await ctx.reply.info(`Profile of ${ctx.options.target}`);
  },
});
```

There is nothing else to write. The file name ends in `.command.ts`, which is
how the loader finds it. The options are declared once, and `ctx.options` is
typed from that declaration. The command is deployed to Discord by the
framework, and only when it has changed.

Buttons, select menus, forms, context menus, events, scheduled jobs and
services follow the same pattern: a `define...` function, in a file of its
own.

## What it takes off your hands

| You no longer write | The framework does it | Read more |
| --- | --- | --- |
| Casts and `null` checks on options | Options, customId parameters and form fields are typed from their declaration | [Options](/commands/options/) |
| A deploy script | Commands are compared with what Discord holds, and only the differences are sent | [Deploying commands](/production/deploying/) |
| The list of gateway intents | Intents are computed from the events you listen to | [Events and intents](/events/events-and-intents/) |
| `split("_")` on a button id | A button carries typed data, and the click comes back decoded | [Buttons](/components/buttons/) |
| A `defer()` in every slow handler | A handler that takes too long is acknowledged for you | [Automatic deferral](/basics/automatic-deferral/) |
| A `try/catch` around every handler | A handler that throws is logged and answered, and the bot stays up | [Lifecycle](/basics/lifecycle/) |
| Permission checks copied from file to file | Guards are declared next to the command they protect | [Guards](/commands/guards/) |

It also comes with what a bot needs once real people use it: a key-value
[store](/data/store/), [scheduled jobs](/events/jobs/),
[translations](/data/i18n/), structured [logs](/production/logging/),
[health checks](/production/health/), [sharding](/production/sharding/), and a
[test harness](/production/testing/) that runs a command with no token and no
network.

A [command line](/api/cli/) drives the whole of it: `djs-bot dev` runs the bot
and restarts it when a file changes, `djs-bot doctor` checks your setup, and
`djs-bot deploy` publishes your commands.

## What stays yours

- **discord.js.** `ctx.interaction`, `ctx.client`, `ctx.guild` and
  `ctx.member` are the real objects. Anything discord.js can do, you can do
  from a handler.
- **Your data.** The built-in store covers settings, counters and small
  records. For anything larger, bring your own database and expose it as a
  [service](/architecture/services/).
- **Hosting.** The framework runs wherever Node runs. Where and how to keep
  the bot online is covered in [Hosting](/recipes/hosting/).
- **The way out.** Definitions are plain objects and there is no runtime of
  its own to undo. You can add djs-bot to an existing bot one command at a
  time, and remove it the same way.

## What you need

| | |
| --- | --- |
| Node | 22.13 or newer |
| discord.js | 14.27 or newer |
| Language | TypeScript, or JavaScript (CommonJS or ES modules) |

TypeScript is not required, but most of what the framework gives you is in
the types. In JavaScript you keep the routing, the guards and the command
line, and your editor still autocompletes from the bundled declarations.

## How this documentation is organised

One page per topic, grouped by what you are trying to do. A topic page opens
with a working example, and ends with a reference of its options and the
errors you can meet.

| Section | What you find there |
| --- | --- |
| Start | The [quick start](/quick-start/) and the [tutorial](/tutorial/what-you-need/) |
| [Basics](/basics/project-layout/) | Project layout, configuration, the `ctx` object, the life of a bot |
| [Commands](/commands/slash-commands/) | Slash commands, options, subcommands, context menus, guards |
| [Components](/components/buttons/) | Buttons, select menus, forms, Components V2, pagination |
| [Events](/events/events-and-intents/) | Gateway events, message triggers, scheduled jobs |
| [Architecture](/architecture/features/) | Features, services, plugins |
| [Data](/data/store/) | Store, cache, translations, feature flags, audit trail |
| [Messages](/messages/embeds-and-attachments/) | Embeds, attachments, mentions, timestamps |
| [Production](/production/deploying/) | Deploying, logs, health, sharding, resilience, tests |
| [Recipes](/recipes/moderation/) | Complete features to copy: moderation, tickets, role menu, levelling |
| Reference | [Every export](/api/exports/), [every error](/api/errors/), the [CLI](/api/cli/), [troubleshooting](/help/troubleshooting/), the [FAQ](/help/faq/) and a [glossary](/help/glossary/) |

## Where to start

- **You have never made a Discord bot.** Follow the
  [tutorial](/tutorial/what-you-need/). It starts from nothing, covers the
  Discord side too, and ends with a bot that is online.
- **You know Node and you have a Discord application.** The
  [quick start](/quick-start/) takes about five minutes.
- **You already have a discord.js bot.** Read
  [Project layout](/basics/project-layout/), then move one command at a time:
  the [FAQ](/help/faq/#can-i-add-this-to-an-existing-discordjs-bot) shows how.
