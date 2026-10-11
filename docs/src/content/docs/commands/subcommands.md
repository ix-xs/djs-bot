---
title: "Subcommands"
description: "Subcommands split one slash command into several actions, such as /config view and /config set. Each one has its own typed options and its own handler, and the framework routes to the right one."
sidebar:
  order: 3
---

## A first subcommand

Put the actions under `subcommands`, keyed by name, and build each one with
`subcommand()`.

```ts title="features/config/config.command.ts"
import { defineCommand, subcommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "config",
  description: "Manage server configuration",

  // /config view    and    /config set key:<...> value:<...>
  subcommands: {
    view: subcommand({
      description: "Show the config",
      run: (ctx) => ctx.reply.info("Current config: ..."),
    }),
    set: subcommand({
      description: "Set a value",
      options: {
        key: s.string({ description: "Key", required: true }),
        value: s.string({ description: "Value", required: true }),
      },
      run: (ctx) => ctx.reply.success(`**${ctx.options.key}** = \`${ctx.options.value}\``),
    }),
  },
});
```

- Routing is automatic. There is no `switch (interaction.options.getSubcommand())`
  to write: the right `run` is called with the right options.
- Each subcommand has its own `options`, so each handler's `ctx.options` is
  typed precisely. `view` has none, `set` has `key` and `value`.
- A command with subcommands needs no `run` of its own.

Options work exactly as on a flat command, autocomplete included: see
[Options and autocomplete](/commands/options/).

## Groups

A group is a folder of subcommands. It adds one level:
`/config role add` and `/config role remove`.

```ts title="features/config/config.command.ts"
import { defineCommand, subcommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "config",
  description: "Manage server configuration",

  subcommands: {
    view: subcommand({
      description: "Show the config",
      run: (ctx) => ctx.reply.info("Current config: ..."),
    }),
  },

  // /config role add role:<@role>    and    /config role remove role:<@role>
  groups: {
    role: {
      description: "Manage auto-roles",
      subcommands: {
        add: subcommand({
          description: "Add an auto-role",
          options: { role: s.role({ description: "Role", required: true }) },
          run: (ctx) => ctx.reply.success(`Added ${ctx.options.role}`),
        }),
        remove: subcommand({
          description: "Remove an auto-role",
          options: { role: s.role({ description: "Role", required: true }) },
          run: (ctx) => ctx.reply.success(`Removed ${ctx.options.role}`),
        }),
      },
    },
  },
});
```

A group is a plain object with a `description` and its `subcommands`. There is
no builder for it and it has no handler. A command can mix direct subcommands
and groups, as above.

Discord allows two levels and no more: `/command subcommand` and
`/command group subcommand`. A group cannot contain another group.

## Guards and deferral

Guards can sit on the command, on a subcommand, or on both. The command's
guards run first, then the subcommand's. Put what applies to everything on the
command and the exceptions on the leaves:

```ts title="features/config/config.command.ts"
import {
  defineCommand,
  subcommand,
  s,
  inGuild,
  hasPermission,
  cooldown,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";

export default defineCommand({
  name: "config",
  description: "Manage server configuration",
  guards: [inGuild()],                                        // every subcommand
  subcommands: {
    view: subcommand({
      description: "Show the config",
      run: (ctx) => ctx.reply.info("Current config: ..."),
    }),
    reset: subcommand({
      description: "Reset everything",
      guards: [hasPermission(PermissionFlagsBits.ManageGuild), cooldown("1m")],   // this one only
      defer: "ephemeral",
      run: (ctx) => ctx.reply.success("Configuration reset."),
    }),
  },
});
```

`defer` follows the same idea: a subcommand's `defer` replaces the command's,
which replaces the bot-wide default. See
[Automatic deferral](/basics/automatic-deferral/).

Everything else is set on the command and applies to the whole tree, because
Discord knows only one command: `defaultMemberPermissions`, `nsfw`,
`integrationTypes`, `contexts` and `guilds`. A subcommand that needs a stricter
permission than its siblings takes a [guard](/commands/guards/).

## Reference

### `subcommand(input)`

Takes a `SubcommandInput` and returns a `SubcommandDefinition`. Its name is the
key you store it under in `subcommands`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `description` | `string` | required | Shown under the subcommand in Discord. 1-100 characters. |
| `run` | `(ctx) => unknown` | required | The handler, sync or async. `ctx.options` is typed from `options`. |
| `options` | `OptionMap` | `{}` | Options of this subcommand only, built with `s.*`. |
| `guards` | `Guard[]` | `[]` | Checked before `run`, after the parent command's guards. |
| `defer` | `DeferOption` | the command's `defer` | Overrides the parent command's setting. See [Automatic deferral](/basics/automatic-deferral/). |
| `nameLocalizations` | `LocalizationMap` | - | Subcommand name per locale. See [Localized names](/commands/slash-commands/#localized-names). |
| `descriptionLocalizations` | `LocalizationMap` | - | Description per locale. |

The handler receives the same `CommandContext` as a flat command, described in
[The ctx object](/basics/context/).

### `subcommands`

A field of [`defineCommand`](/commands/slash-commands/#definecommandinput):
`Record<string, SubcommandDefinition>`. The keys are the subcommand names.

### `groups`

A field of `defineCommand`: `Record<string, SubcommandGroupDefinition>`. The
keys are the group names. A group is:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `description` | `string` | required | Shown under the group in Discord. 1-100 characters. |
| `subcommands` | `Record<string, SubcommandDefinition>` | required | The subcommands of the group, by name. |

`SubcommandInput`, `SubcommandDefinition` and `SubcommandGroupDefinition` are
exported as types.

## Limits and errors

Checked by `defineCommand` when the file is imported:

| Rule | Limit | Error |
| --- | --- | --- |
| Name of a subcommand or a group | 1-32 characters, lowercase, letters, digits, `-` and `_` | [`DJSBOT_E012`](/api/errors/#djsbot_e012) |
| Description of a subcommand or a group | 1-100 characters | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Subcommands and groups of one command, together | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Subcommands of one group | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Options of one subcommand | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Names, descriptions and choices of the whole command | 8000 characters | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |

:::caution[The base command stops existing]
Once a command has subcommands or groups, `/config` alone can no longer be
run: Discord only offers the leaves. A top-level `options` or `run` on the same
command is not deployed and never called.
:::

If Discord sends a subcommand the running bot does not have (the deployed tree
is out of date), the user gets the `unknownSubcommand` message, which you can
reword in [Wording and theme](/basics/wording-and-theme/). Deploying again
fixes it.

## See also

- [Slash commands](/commands/slash-commands/)
- [Options and autocomplete](/commands/options/)
- [Guards](/commands/guards/)
- [Testing](/production/testing/)
