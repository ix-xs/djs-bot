---
title: "Slash commands"
description: "A slash command is what a user runs by typing / in Discord. defineCommand declares its name, its options and its handler in one object, and the handler receives options that are already resolved and typed."
sidebar:
  order: 1
---

## A first command

```ts title="features/general/ping.command.ts"
import { defineCommand } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ping",
  description: "Check that the bot answers",
  run: (ctx) => ctx.reply("Pong."),
});
```

- `name` is what the user types after `/`. `description` is shown next to it in
  Discord's command picker.
- `run` is the handler. It receives a single [`ctx` object](/basics/context/)
  and may be `async`.
- The file name ends in `.command.ts`, which is how the loader finds it: see
  [Project layout](/basics/project-layout/). Importing the file registers
  nothing by itself, the loader collects what the file exports.

A command exists in Discord only once it has been deployed: see
[Deploying commands](/production/deploying/).

## Typed options

Declare what the command accepts with the `s` builders. `ctx.options` is
inferred from that declaration, so there is nothing to cast and nothing to look
up by name.

```ts title="features/profile/profile.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "profile",
  description: "Show a user profile",
  options: {
    target: s.user({ description: "Whose profile", required: true }),
    detailed: s.boolean({ description: "Verbose output" }),
    format: s.string({
      description: "Output format",
      choices: [
        { name: "Compact", value: "compact" },
        { name: "Full", value: "full" },
      ],
    }),
  },
  run: async (ctx) => {
    // ctx.options.target:   User                  (required, so never undefined)
    // ctx.options.detailed: boolean | undefined   (optional)
    // ctx.options.format:   string | undefined
    await ctx.reply.info(`Profile of ${ctx.options.target}`);
  },
});
```

`required: true` does two things at once: Discord refuses to send the command
without the option, and TypeScript removes `undefined` from its type. Every
option type, its settings and autocomplete are covered in
[Options and autocomplete](/commands/options/).

## Who can run it

Three settings limit a command, and they work at different levels.

```ts title="features/moderation/ban.command.ts"
import {
  defineCommand,
  s,
  inGuild,
  hasPermission,
  botHasPermission,
  PermissionFlagsBits,
} from "@ix-xs/djs-bot";

export default defineCommand({
  name: "ban",
  description: "Ban a member",
  contexts: ["guild"],
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  guards: [
    inGuild(),
    hasPermission(PermissionFlagsBits.BanMembers),
    botHasPermission(PermissionFlagsBits.BanMembers),
  ],
  options: {
    target: s.user({ description: "Who to ban", required: true }),
    reason: s.string({ description: "Why", maxLength: 200 }),
  },
  async run(ctx) {
    await ctx.guild!.members.ban(ctx.options.target, { reason: ctx.options.reason });
    await ctx.audit("member.ban", { targetId: ctx.options.target.id });
    return ctx.reply.success(`Banned ${ctx.options.target.tag}`);
  },
});
```

- `contexts` tells Discord where the command may be used at all. Here it never
  appears in DMs. See [Install contexts](/commands/install-contexts/).
- `defaultMemberPermissions` makes Discord hide the command from members who
  lack the permission. Server admins can change that rule in their settings.
- `guards` are checked by the bot itself, every time, before `run`. Nobody can
  override them. See [Guards](/commands/guards/), which also explains why you
  usually want both.

`nsfw: true` marks a command as age-restricted. Discord applies the
restriction, the bot has nothing to check.

`ctx.audit` records who did what. It does nothing until an
[audit trail](/data/audit/) is configured.

## Localized names

Discord can show a command under a different name and description for each
client language. Give the translations next to the originals:

```ts title="features/general/help.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "help",
  description: "Show help",
  nameLocalizations: { fr: "aide", de: "hilfe", "es-ES": "ayuda" },
  descriptionLocalizations: { fr: "Afficher l'aide", de: "Hilfe anzeigen" },
  options: {
    topic: s.string({
      description: "Topic",
      nameLocalizations: { fr: "sujet" },
      descriptionLocalizations: { fr: "Le sujet" },
    }),
  },
  run: (ctx) => ctx.reply.info(ctx.options.topic ?? "Pick a topic."),
});
```

A French user then types `/aide sujet:...`. Your code does not change: the
command is still routed as `help` and the option is still `ctx.options.topic`.

- The keys are discord.js `Locale` strings: `"fr"`, `"de"`, `"es-ES"`,
  `"pt-BR"`, `"ja"` and so on. Spanish is `es-ES`, not `es`.
- Localizations exist on commands, options and
  [subcommands](/commands/subcommands/). [Context menus](/commands/context-menus/)
  have no description, so they take `nameLocalizations` only.
- A localized name follows the same rule as the original: 1-32 characters,
  lowercase, no spaces. Discord rejects the deployment otherwise.
- Localizations are part of what is deployed, so adding a translation
  redeploys the command.

:::note[Localization is not translation]
`nameLocalizations` changes what the command picker shows. It does not
translate what your handler replies: that is the job of `ctx.t()`, described in
[Internationalisation](/data/i18n/). The two are independent.
:::

## Reference

### `defineCommand(input)`

Takes a `CommandInput` and returns a `CommandDefinition`, a plain object tagged
`kind: "command"`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | required | What users type after `/`. Lowercase, 1-32 characters. |
| `description` | `string` | required | Shown in the command picker. 1-100 characters. |
| `options` | `OptionMap` | `{}` | Typed options, built with `s.*`. Drives `ctx.options`. Leave out when using subcommands. See [Options and autocomplete](/commands/options/). |
| `run` | `(ctx) => unknown` | - | The handler, sync or async. Optional only when the command has subcommands. |
| `guards` | `Guard[]` | `[]` | Preconditions checked before `run`, and before any subcommand. See [Guards](/commands/guards/). |
| `subcommands` | `Record<string, SubcommandDefinition>` | - | Subcommands, keyed by name. See [Subcommands](/commands/subcommands/). |
| `groups` | `Record<string, SubcommandGroupDefinition>` | - | Subcommand groups, keyed by name. |
| `defer` | `DeferOption` | `defaults.defer` | Acknowledges the interaction for a slow handler. See [Automatic deferral](/basics/automatic-deferral/). |
| `defaultMemberPermissions` | `PermissionResolvable` | - | Permissions a member needs to see and use the command by default. |
| `nsfw` | `boolean` | - | Marks the command as age-restricted. |
| `integrationTypes` | `("guild" \| "user")[]` | set by Discord | Where the command can be installed. See [Install contexts](/commands/install-contexts/). |
| `contexts` | `("guild" \| "botDm" \| "privateChannel")[]` | set by Discord | Where the command can be used. |
| `dmPermission` | `boolean` | - | Deprecated by Discord in favour of `contexts`. Use `contexts: ["guild"]` to keep a command out of DMs. |
| `nameLocalizations` | `LocalizationMap` | - | Command name per locale, for example `{ fr: "aide" }`. |
| `descriptionLocalizations` | `LocalizationMap` | - | Description per locale. |
| `guilds` | `string[]` | - | Deploy the command to these guild ids only. Leave out for a global command. See [Deploying commands](/production/deploying/). |

The handler receives a `CommandContext`: everything every handler gets, plus
`ctx.options` (typed from `options`) and `ctx.showModal`. All of it is described
in [The ctx object](/basics/context/). What `run` returns is ignored. A returned
promise is awaited, and anything it throws goes to the error boundary described
in [Errors](/api/errors/).

`CommandInput` and `CommandDefinition` are exported as types, for code that
builds or inspects commands.

## Limits and errors

`defineCommand` checks the definition as soon as the file is imported. A
mistake stops the bot at startup with an error that names the field, where
Discord would only have answered `400 Invalid Form Body` at deploy time.

| Rule | Limit | Error |
| --- | --- | --- |
| Name of a command, subcommand, group or option | 1-32 characters, lowercase, letters, digits, `-` and `_`, no spaces | [`DJSBOT_E012`](/api/errors/#djsbot_e012) |
| Description, longest localization included | 1-100 characters | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Options of one command | 25 | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Names, descriptions and choices of one command, added up | 8000 characters | [`DJSBOT_E015`](/api/errors/#djsbot_e015) |
| Slash commands in one scope (global, or one guild) | 100 | [`DJSBOT_E015`](/api/errors/#djsbot_e015), raised by the deploy |
| Two slash commands with the same name | not allowed | [`DJSBOT_E010`](/api/errors/#djsbot_e010) |

The limits on choices, lengths and file types are listed in
[Options and autocomplete](/commands/options/#limits-and-errors). If you reach
100 commands, group related ones as [subcommands](/commands/subcommands/) or
scope some to specific guilds with `guilds`.

When Discord sends a command the running bot does not know (the deployed list
is older or newer than the code), the user gets the `unknownCommand` message,
which you can reword in [Wording and theme](/basics/wording-and-theme/).
Deploying again fixes it.

## See also

- [Options and autocomplete](/commands/options/)
- [Subcommands](/commands/subcommands/)
- [Guards](/commands/guards/)
- [The ctx object](/basics/context/)
- [Deploying commands](/production/deploying/)
