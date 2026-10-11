---
title: "Project layout"
description: "How a bot is organised on disk: one entry file, one folder per feature, and file suffixes that tell the loader what to import."
sidebar:
  order: 1
---

A bot is one entry file that calls `defineBot`, plus a folder of small files that
each export a definition (a command, a button, an event...). You point the bot at
the folder and the loader finds the files by their name. To create this structure
in one command, see [Quick start](/quick-start/).

## A typical project

Group files by feature, not by type: everything about tickets lives in
`features/tickets/`, whatever it is. The folder is only for you; the loader
looks at the file suffix.

```
src/
  index.ts                       # defineBot(...)
  features/
    ping/ping.command.ts         # slash command
    config/config.command.ts     # command with subcommands
    tickets/
      open.command.ts
      close.button.ts            # button
      tickets.service.ts         # injectable service
      tickets.feature.ts         # optional defineFeature() bundle
      helpers.ts                 # no suffix: never imported by the loader
    moderation/
      userinfo.user.ts           # user context menu
      report.message.ts          # message context menu
    fun/
      pong.trigger.ts            # message auto-responder
    welcome/welcome.event.ts     # gateway event
    cleanup/cleanup.job.ts       # scheduled job
```

The entry file gives the folder to `features`:

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";

const bot = defineBot({
  token: env("DISCORD_TOKEN"),
  features: `${import.meta.dirname}/features`,
});

export default bot;

// Start only when run directly (the CLI imports this file for tooling).
if (!process.env.DJSBOT_CLI) void bot.start();
```

Each file exports the result of a `define*()` function:

```ts title="src/features/ping/ping.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check the bot is alive",
  run: (ctx) => ctx.reply("Pong."),
});
```

Everything `defineBot` accepts is described in
[Configuration](/basics/configuration/).

## File suffixes

The loader imports a file only when its name, without the extension, ends with
one of these twelve suffixes:

| Suffix | Holds | Defined with | Page |
| --- | --- | --- | --- |
| `.command` | A slash command | `defineCommand` | [Slash commands](/commands/slash-commands/) |
| `.user` | A user context menu | `defineUserCommand` | [Context menus](/commands/context-menus/) |
| `.message` | A message context menu | `defineMessageCommand` | [Context menus](/commands/context-menus/) |
| `.event` | A gateway event listener | `defineEvent` | [Events and intents](/events/events-and-intents/) |
| `.trigger` | A message auto-responder | `defineTrigger` | [Message triggers](/events/triggers/) |
| `.button` | A button | `defineButton` | [Buttons](/components/buttons/) |
| `.select` | A select menu | `defineSelectMenu` and the native variants | [Select menus](/components/select-menus/) |
| `.modal` | A modal (form) | `defineModal` | [Modals](/components/modals/) |
| `.service` | An injectable service | `defineService` | [Services](/architecture/services/) |
| `.job` | A scheduled job | `defineJob` | [Scheduled jobs](/events/jobs/) |
| `.plugin` | A plugin | `definePlugin` | [Plugins and hooks](/architecture/plugins/) |
| `.feature` | A bundle of definitions | `defineFeature` | [Features](/architecture/features/) |

Accepted extensions are `.ts`, `.mts`, `.cts`, `.js`, `.mjs` and `.cjs`, so the
same folder works from `src/` during development and from `dist/` once compiled.
Declaration files (`.d.ts`) are skipped.

Because only suffixed files are imported, helpers (`utils.ts`, `guards.ts`,
`types.ts`) can sit right next to your definitions. The suffix has to be the
last part of the name: `ping.command.ts` is loaded, `ping.command.test.ts` is
not.

## How discovery works

When `features` is a directory, the loader:

1. Walks it recursively, at any depth. Folders named `node_modules` are skipped.
2. Keeps the files that carry a suffix and sorts them by path.
3. Imports them all concurrently, because startup time on a large bot is mostly
   module loading.
4. Collects every definition each file exports, default export and named
   exports alike, and registers them in the sorted order. Startup is fast and
   still deterministic.

Two rules follow from this design.

**The suffix decides whether a file is loaded, never what it registers.**
Routing follows the `kind` of each exported definition, which `define*()` sets
for you. A file may therefore export several definitions, of different kinds:

```ts title="src/features/tickets/close.button.ts"
import { ButtonStyle, defineButton, defineCommand, p, ui } from "@ix-xs/djs-bot";

export const CloseTicket = defineButton({
  id: "ticket:close",
  params: { ticketId: p.string },
  label: "Close",
  style: ButtonStyle.Danger,
  run: (ctx) => ctx.update({ content: `Ticket ${ctx.params.ticketId} closed.`, components: [] }),
});

export const CloseCommand = defineCommand({
  name: "close",
  description: "Close the current ticket",
  run: (ctx) =>
    ctx.reply({
      content: "Close this ticket?",
      components: [ui.row(CloseTicket.build({ ticketId: ctx.channelId ?? "unknown" }))],
    }),
});
```

Arrays and plain objects of definitions are found too, so
`export default [CommandA, CommandB]` works.

**Importing a file registers nothing.** A file only exports objects; the loader
collects them. There are no import side effects, so load order can never change
behaviour, and you can always trace what the bot does back to an explicit
definition. `npx djs-bot explain` prints the result: see [CLI](/api/cli/).

:::caution[Relative paths start at the working directory]
`features: "./features"` is resolved from the directory the process was started
in, not from the entry file. Build the path from `import.meta.dirname`, as in
the example above, and it points to the right folder from `src/` and from
`dist/`, whatever the working directory.
:::

## Registering without a folder

The folder is a convenience, not an obligation. `features` also accepts the
definitions themselves, and you can mix both forms:

```ts title="src/index.ts"
import { defineBot, env } from "@ix-xs/djs-bot";
import ping from "./commands/ping.js";
import { CloseTicket } from "./tickets/close.js";

export default defineBot({
  token: env("DISCORD_TOKEN"),
  features: [`${import.meta.dirname}/features`, ping, CloseTicket],
});
```

`bot.use(...)` adds definitions after the bot was created, on top of
`features`. It is chainable and has to be called before the bot loads:

```ts
bot.use(ping, CloseTicket, someService);
```

Registering the same definition twice is harmless: a command can live in its
own `*.command.ts` file and also be listed in a `*.feature.ts` bundle.
Definitions given to `bot.use()` are registered first, then the entries of
`features` in the order you wrote them.

## Reference

### `FeatureSource`

The type of one entry of `features`. The option takes one of them, or an array
of them.

| Form | Type | Description |
| --- | --- | --- |
| A directory | `string` | Discovered by the loader as described above. Relative paths start at the working directory. |
| A definition | `Registrable` | Any `define*()` result, including a `defineFeature()` bundle. |
| A list | `Registrable[]` | Several definitions at once. |

### `Registrable`

Any object the registry accepts. The loader recognises one by its `kind`
property and ignores every other export.

| `kind` | Created by |
| --- | --- |
| `"command"` | `defineCommand` |
| `"userCommand"` | `defineUserCommand` |
| `"messageCommand"` | `defineMessageCommand` |
| `"event"` | `defineEvent` |
| `"trigger"` | `defineTrigger` |
| `"button"` | `defineButton` |
| `"select"` | `defineSelectMenu`, `defineUserSelect`, `defineRoleSelect`, `defineChannelSelect`, `defineMentionableSelect` |
| `"modal"` | `defineModal` |
| `"service"` | `defineService` |
| `"job"` | `defineJob` |
| `"plugin"` | `definePlugin` |
| `"feature"` | `defineFeature` |

## Limits and errors

| Situation | Result |
| --- | --- |
| A suffixed file fails to import (syntax error, missing module) | [`DJSBOT_E060`](/api/errors/#djsbot_e060), with the file and the original message. |
| A suffixed file exports no definition | [`DJSBOT_E060`](/api/errors/#djsbot_e060). A matched file with nothing usable is almost always a mistake, such as a forgotten `export`. |
| Two different commands share a name | [`DJSBOT_E010`](/api/errors/#djsbot_e010). |
| Two different buttons, selects or modals share an id | [`DJSBOT_E011`](/api/errors/#djsbot_e011). |
| The directory does not exist | Nothing is loaded and no error is raised. A bot that starts with no commands usually has a wrong `features` path. |

All of these happen while the bot loads, before it connects to Discord: see
[Lifecycle](/basics/lifecycle/).

## See also

- [Quick start](/quick-start/): install the package and scaffold this layout.
- [Configuration](/basics/configuration/): every option of `defineBot`.
- [Features](/architecture/features/): bundle related definitions into a reusable pack.
- [Services](/architecture/services/): share state between the files of a feature.
- [CLI](/api/cli/): `explain` and `doctor` show what was discovered.
