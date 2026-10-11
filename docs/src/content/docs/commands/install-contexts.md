---
title: "Install contexts"
description: "A Discord app can be added to a server or to a user account, and each command can be limited to servers, to the bot's DMs or to other private conversations. Two fields on a command decide both."
sidebar:
  order: 6
---

Discord separates two questions that are easy to confuse:

- **Where is the command installed?** On a server (every member gets it there)
  or on a user account (that person gets it everywhere they go). This is
  `integrationTypes`.
- **Where can it be used?** In servers, in the DM with the bot, or in other
  DMs and group DMs. This is `contexts`.

## A command usable anywhere

```ts title="features/notes/note.command.ts"
import { defineCommand, s } from "@ix-xs/djs-bot";

export default defineCommand({
  name: "note",
  description: "A personal note command you can use anywhere",
  integrationTypes: ["guild", "user"],              // installable on servers and on user accounts
  contexts: ["guild", "botDm", "privateChannel"],   // usable in servers, bot DMs and group DMs
  options: { text: s.string({ description: "Text", required: true }) },
  run: (ctx) => ctx.reply.info(ctx.options.text, { ephemeral: true }),
});
```

Someone who adds the app to their own account can now run `/note` in any
server, in a DM with a friend or in a group DM, whether or not the bot is a
member there.

Both fields work the same way on `defineCommand`, `defineUserCommand` and
`defineMessageCommand`:

```ts title="features/general/userinfo.user.ts"
import { defineUserCommand } from "@ix-xs/djs-bot";

export default defineUserCommand({
  name: "User info",
  integrationTypes: ["guild", "user"],
  run: (ctx) =>
    ctx.reply.info(`Joined: ${ctx.targetMember?.joinedAt?.toDateString() ?? "not a member here"}`),
});
```

## Choosing the values

| You want | Write |
| --- | --- |
| A server command that never shows up in DMs | `contexts: ["guild"]` |
| A command for the DM with the bot only | `contexts: ["botDm"]` |
| A personal tool that follows the user everywhere | `integrationTypes: ["user"]`, `contexts: ["guild", "botDm", "privateChannel"]` |
| Both: installed on servers and on accounts | `integrationTypes: ["guild", "user"]` |

`contexts: ["guild"]` replaces the older `dmPermission: false`, which Discord
has deprecated. `dmPermission` is still accepted and sent as is, but new code
should use `contexts`.

When you leave a field out, the framework sends nothing for it and Discord
applies its own default, which depends on how the application is configured.

For users to add the app to their account at all, user install has to be
enabled for the application in the Discord Developer Portal, on the
Installation page.

## Handlers outside your servers

A command installed on a user account can run in a server the bot never
joined, or in a DM between two people. The interaction still reaches your
handler, but the bot knows much less about the place:

| Property | In a server the bot is not in |
| --- | --- |
| `ctx.guildId` | Set |
| `ctx.guild` | `null` |
| `ctx.member` | `null` |
| `ctx.targetMember` (user commands) | `null` |
| `ctx.channel` | May be `null`. `ctx.channelId` is set. |
| `ctx.user`, `ctx.reply` | As usual |

In a DM or a group DM, `ctx.guildId` is `null` as well.

This changes what some [guards](/commands/guards/) do. `inGuild()` only looks
at the guild id, so it passes in a server the bot is not in. `hasRole()` and
`guildOwnerOnly()` need the member or the server and refuse there.
`hasPermission()` keeps working, because Discord sends the member's permissions
with the interaction.

Write such handlers so that they do not need the server: reply to the
interaction, and avoid fetching channels, members or roles the bot cannot see.

## Reference

### `integrationTypes`

`InstallContext[]`. Where the command can be installed. Sent to Discord as
`integration_types`.

| Value | Discord name | Meaning |
| --- | --- | --- |
| `"guild"` | `GuildInstall` | Installed on a server, for its members. |
| `"user"` | `UserInstall` | Installed on a user account, for that user everywhere. |

### `contexts`

`InteractionContext[]`. Where the command can be used. Sent to Discord as
`contexts`.

| Value | Discord name | Meaning |
| --- | --- | --- |
| `"guild"` | `Guild` | In servers. |
| `"botDm"` | `BotDM` | In the DM between the user and the bot. |
| `"privateChannel"` | `PrivateChannel` | In other DMs and in group DMs. |

### `dmPermission`

`boolean`. Whether a global command is available in DMs. Deprecated by Discord
in favour of `contexts`.

`InstallContext` and `InteractionContext` are exported as types.

## Limits and errors

:::caution[Global commands only]
`integrationTypes`, `contexts` and `dmPermission` exist only on global
commands. Discord accepts them on a guild command and then drops them. So they
have no effect on a command that sets `guilds`, nor on anything deployed to a
development guild: test them with a global deployment. See
[Deploying commands](/production/deploying/).
:::

- Both fields are part of what the deploy compares. Changing them redeploys the
  command. A command that leaves them out is not redeployed because of the
  defaults Discord filled in.
- The values are checked by the TypeScript types only. There is no
  definition-time error code for them.
- These settings apply to a whole command. A
  [subcommand](/commands/subcommands/) cannot have its own.

## See also

- [Slash commands](/commands/slash-commands/)
- [Context menus](/commands/context-menus/)
- [Guards](/commands/guards/)
- [Deploying commands](/production/deploying/)
